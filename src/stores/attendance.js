import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collectionGroup,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { useAuthStore } from './auth'
import { useMembersStore } from './members'

export const useAttendanceStore = defineStore('attendance', () => {

  // --- State ---
  const currentEventAttendees = ref([])
  const allAttendance = ref([])
  const isLoading = ref(false)
  let allAttendanceUnsub = null

  // --- Helpers ---
  const getEventAttendanceCollection = (eventId) => {
    const authStore = useAuthStore()

    if (!authStore.branchId || !eventId) {
      console.error('Branch ID or Event ID missing')
      return null
    }

    return collection(
      db,
      'branches',
      authStore.branchId,
      'events',
      eventId,
      'attendance'
    )
  }

  // --- Actions ---

  /**
   * Log Weekly DGroup Meeting
   * Path: branches/{branchId}/dgroupAttendance/{dgroupId_date}
   */
  async function logDgroupMeeting(meetingData) {
    const authStore = useAuthStore()
    if (!authStore.branchId) {
      return { status: 'error', message: 'Branch ID missing' }
    }

    try {
      // Document ID format: DG-ID_YYYY-MM-DD
      const docId = `${meetingData.dgroupId}_${meetingData.meetingDate}`
      
      const meetingRef = doc(
        db, 
        'branches', 
        authStore.branchId, 
        'dgroupAttendance', 
        docId
      )

      await setDoc(meetingRef, {
        ...meetingData,
        submittedAt: serverTimestamp(),
        submittedBy: authStore.userProfile?.firstName + ' ' + authStore.userProfile?.lastName,
        submittedById: authStore.userProfile?.id || 'unknown'
      })

      return { status: 'success', message: 'DGroup attendance recorded.' }
    } catch (error) {
      console.error("DGroup Log Error:", error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Fetch attendance for a specific event
   */
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
   * Mark attendance safely (prevents duplicates)
   * UPDATED: Accepts specific ministry role for this event
   */
  async function markAttendance(memberId, eventId, ministry = 'N/A', name = null) {
    if (!memberId || !eventId) {
      return { status: 'error', message: 'Missing member or event ID' }
    }

    const authStore = useAuthStore()

    try {
      const attendanceRef = doc(
        db,
        'branches',
        authStore.branchId,
        'events',
        eventId,
        'attendance',
        memberId
      )

      // ✅ Check if already scanned
      const existingDoc = await getDoc(attendanceRef)
      if (existingDoc.exists()) {
        return { status: 'warning', message: 'Already marked present.' }
      }

      // Resolve member name if not provided: try local members store, then Firestore
      let resolvedName = name
      try {
        if (!resolvedName) {
          const membersStore = useMembersStore()
          const local = (membersStore.members || []).find(m => m.id === memberId)
          if (local) resolvedName = local.displayName || `${local.firstName || ''} ${local.lastName || ''}`.trim() || null
        }
      } catch (err) {
        console.warn('Members store lookup failed:', err)
      }

      if (!resolvedName) {
        try {
          const memberRef = doc(db, 'branches', authStore.branchId, 'members', memberId)
          const memberSnap = await getDoc(memberRef)
          if (memberSnap.exists()) {
            const md = memberSnap.data()
            resolvedName = md.displayName || `${md.firstName || ''} ${md.lastName || ''}`.trim() || null
          }
        } catch (err) {
          console.warn('Failed to fetch member for name fallback:', err)
        }
      }

      if (!resolvedName) resolvedName = 'Unknown'

      // ✅ Create attendance record with Dynamic Ministry
      // ministry defaults to 'N/A' (Regular attendance) if not provided
      await setDoc(attendanceRef, {
        timestamp: new Date(),
        name: resolvedName,
        checkedInBy: authStore.user?.uid || null,
        ministry: ministry 
      })

      return { status: 'success', message: 'Attendance recorded.' }

    } catch (error) {
      console.error('Attendance write error:', error)
      return { status: 'error', message: 'Database error.' }
    }
  }

  /**
   * Update an existing attendance record (e.g. to fix a mistake in ministry assignment)
   */
  async function updateAttendanceMinistry(memberId, eventId, newMinistry) {
    if (!memberId || !eventId) return;
    
    const authStore = useAuthStore()
    try {
      const attendanceRef = doc(
        db,
        'branches',
        authStore.branchId,
        'events',
        eventId,
        'attendance',
        memberId
      )
      
      await updateDoc(attendanceRef, {
        ministry: newMinistry
      })
      
    } catch (error) {
      console.error('Error updating attendance ministry:', error)
    }
  }

  return {
    currentEventAttendees,
    allAttendance,
    isLoading,
    fetchAttendanceForEvent,
    fetchAllAttendance,
    markAttendance,
    logDgroupMeeting, // <--- Exporting the new action
    updateAttendanceMinistry
  }
})