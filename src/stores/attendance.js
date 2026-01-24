import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collectionGroup,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { useAuthStore } from './auth'
import { useMembersStore } from './members'

export const useAttendanceStore = defineStore('attendance', () => {

  // --- State ---
  const currentEventAttendees = ref([])
  const allAttendance = ref([])
  const dgroupMeetings = ref([]) 
  const isLoading = ref(false)
  let allAttendanceUnsub = null
  let dgroupMeetingsUnsub = null

  // --- Helpers ---
  const getEventAttendanceCollection = (eventId) => {
    const authStore = useAuthStore()
    if (!authStore.branchId || !eventId) return null
    return collection(db, 'branches', authStore.branchId, 'events', eventId, 'attendance')
  }

  // --- Actions ---

  /**
   * NEW/UPDATED: Fetch attendance records by date
   * This is what the DGroup Weekly Log uses to auto-check members
   */
  async function getAttendanceByDate(dateString) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return []

    try {
      const q = query(
        collectionGroup(db, 'attendance'),
        where('dateOnly', '==', dateString)
      )

      const snapshot = await getDocs(q)
      const records = []
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data()
        // Filter to ensure we only get records for this branch
        if (docSnap.ref.path.includes(`branches/${authStore.branchId}`)) {
          records.push({
            memberId: docSnap.id, 
            ...data
          })
        }
      })
      return records
    } catch (error) {
      console.error("Error fetching attendance by date:", error)
      return []
    }
  }

  function fetchAttendanceForEvent(eventId) {
    if (!eventId) {
      currentEventAttendees.value = []
      return
    }

    isLoading.value = true

    const attendanceCol = getEventAttendanceCollection(eventId)
    if (!attendanceCol) return

    onSnapshot(
      attendanceCol,
      (snapshot) => {
        const attendees = []
        snapshot.forEach((docSnap) => {
          attendees.push({
            memberId: docSnap.id,
            ...docSnap.data()
          })
        })
        currentEventAttendees.value = attendees
        isLoading.value = false
      },
      (error) => {
        console.error('Attendance fetch error:', error)
        isLoading.value = false
      }
    )
  }

  /**
   * Fetch all attendance records for the current branch using a collectionGroup
   * Listens to all subcollections named 'attendance' and filters by branchId
   */
  function fetchAllAttendance() {
    const authStore = useAuthStore()

    if (!authStore.branchId) {
      allAttendance.value = []
      return Promise.resolve(allAttendance.value)
    }

    // avoid creating multiple listeners
    if (allAttendanceUnsub) return Promise.resolve(allAttendance.value)

    isLoading.value = true

    return new Promise((resolve, reject) => {
      allAttendanceUnsub = onSnapshot(
        collectionGroup(db, 'attendance'),
        (snapshot) => {
          const records = []
          snapshot.forEach((docSnap) => {
            // path: branches/{branchId}/events/{eventId}/attendance/{memberId}
            const pathParts = docSnap.ref.path.split('/')
            // basic guard for expected structure
            if (pathParts.length >= 6 && pathParts[0] === 'branches') {
              const branchId = pathParts[1]
              const eventId = pathParts[3]
              if (branchId !== authStore.branchId) return

              records.push({
                eventId,
                memberId: docSnap.id,
                ...docSnap.data()
              })
            }
          })
          allAttendance.value = records
          isLoading.value = false
          resolve(allAttendance.value)
        },
        (error) => {
          console.error('All attendance fetch error:', error)
          isLoading.value = false
          reject(error)
        }
      )
    })
  }
  /**
   * Log Weekly DGroup Meeting
   */
  async function logDgroupMeeting(meetingData) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return { status: 'error', message: 'Branch ID missing' }

    try {
      const docId = `${meetingData.dgroupId}_${meetingData.meetingDate}`
      const meetingRef = doc(db, 'branches', authStore.branchId, 'dgroupAttendance', docId)

      await setDoc(meetingRef, {
        ...meetingData,
        submittedAt: serverTimestamp(),
        submittedBy: `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim(),
        submittedById: authStore.userProfile?.id || 'unknown'
      })

      return { status: 'success', message: 'DGroup attendance recorded.' }
    } catch (error) {
      console.error("DGroup Log Error:", error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Mark attendance safely (UPDATED with dateOnly for cross-event querying)
   */
  async function markAttendance(memberId, eventId, ministry = 'N/A', memberTag = 'DM', name = null) {
    if (!memberId || !eventId) return { status: 'error', message: 'Missing member or event ID' }

    const authStore = useAuthStore()
    const today = new Date().toISOString().split('T')[0] 

    try {
      const attendanceRef = doc(db, 'branches', authStore.branchId, 'events', eventId, 'attendance', memberId)
      const existingDoc = await getDoc(attendanceRef)
      if (existingDoc.exists()) return { status: 'warning', message: 'Already marked present.' }

      let resolvedName = name
      if (!resolvedName) {
        const membersStore = useMembersStore()
        const local = (membersStore.members || []).find(m => m.id === memberId)
        if (local) resolvedName = local.displayName || `${local.firstName} ${local.lastName}`
      }

      await setDoc(attendanceRef, {
        timestamp: serverTimestamp(),
        dateOnly: today, // Crucial for auto-sync
        memberTag: memberTag,
        name: resolvedName || 'Unknown',
        checkedInBy: authStore.user?.uid || null,
        ministry: ministry 
      })

      return { status: 'success', message: 'Attendance recorded.' }
    } catch (error) {
      console.error('Attendance write error:', error)
      return { status: 'error', message: 'Database error.' }
    }
  }

  function fetchDgroupMeetings() {
    const authStore = useAuthStore()
    if (!authStore.branchId) return
    if (dgroupMeetingsUnsub) dgroupMeetingsUnsub()

    const q = query(collection(db, 'branches', authStore.branchId, 'dgroupAttendance'), orderBy('meetingDate', 'desc'))
    dgroupMeetingsUnsub = onSnapshot(q, (snapshot) => {
      dgroupMeetings.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  async function updateAttendanceMinistry(memberId, eventId, newMinistry) {
    const authStore = useAuthStore()
    const attendanceRef = doc(db, 'branches', authStore.branchId, 'events', eventId, 'attendance', memberId)
    await updateDoc(attendanceRef, { ministry: newMinistry })
  }

  return {
    currentEventAttendees,
    allAttendance,
    dgroupMeetings,
    isLoading,
    fetchAttendanceForEvent,
    fetchAllAttendance,
    fetchDgroupMeetings,
    getAttendanceByDate, 
    markAttendance,
    logDgroupMeeting,
    updateAttendanceMinistry
  }
})