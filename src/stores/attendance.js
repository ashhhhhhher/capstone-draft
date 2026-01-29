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
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore'
import { useAuthStore } from './auth'
import { useMembersStore } from './members'

export const useAttendanceStore = defineStore('attendance', () => {

  // --- State ---
  const currentEventAttendees = ref([])
  const allAttendance = ref([])
  const dgroupMeetings = ref([]) 
  const isLoading = ref(false)
  
  // New States
  const speakersList = ref([]) // Master list for the dropdown
  const currentGroupHasLogged = ref(false) // UI Locking state
  
  let allAttendanceUnsub = null
  let dgroupMeetingsUnsub = null
  let speakersUnsub = null

  // --- Helpers ---
  const getEventAttendanceCollection = (eventId) => {
    const authStore = useAuthStore()
    if (!authStore.branchId || !eventId) return null
    return collection(db, 'branches', authStore.branchId, 'events', eventId, 'attendance')
  }

  // --- Actions ---

  /**
   * SPEAKER MANAGEMENT
   */
  function fetchSpeakers() {
    const authStore = useAuthStore()
    if (!authStore.branchId) return
    if (speakersUnsub) speakersUnsub()

    const speakersCol = collection(db, 'branches', authStore.branchId, 'speakers')
    const q = query(speakersCol, orderBy('name', 'asc'))

    speakersUnsub = onSnapshot(q, (snapshot) => {
      speakersList.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  async function addNewSpeaker(name) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !name) return
    try {
      const speakerRef = doc(collection(db, 'branches', authStore.branchId, 'speakers'))
      await setDoc(speakerRef, { name: name.trim() })
    } catch (error) {
      console.error("Error saving new speaker:", error)
    }
  }

  async function deleteSpeaker(id) {
    const authStore = useAuthStore()
    try {
      await deleteDoc(doc(db, 'branches', authStore.branchId, 'speakers', id))
    } catch (error) {
      console.error("Error deleting speaker:", error)
    }
  }

  /**
   * WEEKLY LOCKING LOGIC
   */
  async function checkIfLogged(dgroupId, ministryWeekKey) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupId) return false

    try {
      const q = query(
        collection(db, 'branches', authStore.branchId, 'dgroupAttendance'),
        where('dgroupId', '==', dgroupId),
        where('ministryWeek', '==', ministryWeekKey),
        limit(1)
      )
      const snapshot = await getDocs(q)
      const exists = !snapshot.empty
      currentGroupHasLogged.value = exists
      return exists
    } catch (error) {
      console.error("Error checking weekly log status:", error)
      return false
    }
  }

  /**
   * Log Weekly DGroup Meeting
   */
  async function logDgroupMeeting(meetingData) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return { status: 'error', message: 'Branch ID missing' }

    try {
      // Use ministryWeek in ID to prevent accidental double-logging
      const docId = `${meetingData.dgroupId}_${meetingData.ministryWeek || meetingData.meetingDate}`
      const meetingRef = doc(db, 'branches', authStore.branchId, 'dgroupAttendance', docId)

      await setDoc(meetingRef, {
        ...meetingData,
        submittedAt: serverTimestamp(),
        submittedBy: `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim(),
        submittedById: authStore.userProfile?.id || 'unknown'
      })

      currentGroupHasLogged.value = true // Lock the UI immediately
      return { status: 'success', message: 'DGroup attendance recorded.' }
    } catch (error) {
      console.error("DGroup Log Error:", error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Fetch attendance records by date
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
        if (docSnap.ref.path.includes(`branches/${authStore.branchId}`)) {
          records.push({
            memberId: docSnap.id, 
            ...docSnap.data()
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

    onSnapshot(attendanceCol, (snapshot) => {
      const attendees = []
      snapshot.forEach((docSnap) => {
        attendees.push({ memberId: docSnap.id, ...docSnap.data() })
      })
      currentEventAttendees.value = attendees
      isLoading.value = false
    }, (error) => {
      console.error('Attendance fetch error:', error)
      isLoading.value = false
    })
  }

  function fetchAllAttendance() {
    const authStore = useAuthStore()
    if (!authStore.branchId) {
      allAttendance.value = []
      return Promise.resolve(allAttendance.value)
    }
    if (allAttendanceUnsub) return Promise.resolve(allAttendance.value)
    isLoading.value = true

    return new Promise((resolve, reject) => {
      allAttendanceUnsub = onSnapshot(collectionGroup(db, 'attendance'), (snapshot) => {
        const records = []
        snapshot.forEach((docSnap) => {
          const pathParts = docSnap.ref.path.split('/')
          if (pathParts.length >= 6 && pathParts[0] === 'branches') {
            const branchId = pathParts[1]
            const eventId = pathParts[3]
            if (branchId !== authStore.branchId) return
            records.push({ eventId, memberId: docSnap.id, ...docSnap.data() })
          }
        })
        allAttendance.value = records
        isLoading.value = false
        resolve(allAttendance.value)
      }, (error) => {
        console.error('All attendance fetch error:', error)
        isLoading.value = false
        reject(error)
      })
    })
  }

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
        dateOnly: today,
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
    speakersList,
    currentGroupHasLogged,
    fetchAttendanceForEvent,
    fetchAllAttendance,
    fetchDgroupMeetings,
    fetchSpeakers,
    addNewSpeaker,
    deleteSpeaker,
    checkIfLogged,
    getAttendanceByDate, 
    markAttendance,
    logDgroupMeeting,
    updateAttendanceMinistry
  }
})