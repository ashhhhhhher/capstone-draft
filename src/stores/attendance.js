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

  function fetchAttendanceForEvent(eventId) {
    if (!eventId) return (currentEventAttendees.value = [])
    const attendanceCol = getEventAttendanceCollection(eventId)
    if (!attendanceCol) return

    onSnapshot(attendanceCol, (snapshot) => {
      currentEventAttendees.value = snapshot.docs.map(d => ({ memberId: d.id, ...d.data() }))
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
    fetchDgroupMeetings,
    getAttendanceByDate, 
    markAttendance,
    logDgroupMeeting,
    updateAttendanceMinistry
  }
})