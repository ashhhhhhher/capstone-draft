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
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore'
import { useAuthStore } from './auth'
import { useMembersStore } from './members'
import { useDgroupEventsStore } from './dgroupevents'
import { useEventsStore } from './events'

export const useAttendanceStore = defineStore('attendance', () => {

  const currentEventAttendees = ref([])
  const allAttendance = ref([]) 
  const dgroupMeetings = ref([]) 
  const isLoading = ref(false)
  const speakersList = ref([]) 
  const currentGroupHasLogged = ref(false) 

  const getEventAttendanceCollection = (eventId) => {
    const authStore = useAuthStore()
    if (!authStore.branchId || !eventId) return null
    return collection(db, 'branches', authStore.branchId, 'events', eventId, 'attendance')
  }

  // 🚀 Fetch all attendance for a date range (Used by Admins for Insights)
  async function fetchAttendanceByDateRange(startDate, endDate) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return []
    
    isLoading.value = true;
    try {
      const q = query(
        collectionGroup(db, 'attendance'),
        where('dateOnly', '>=', startDate),
        where('dateOnly', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      const records = [];
      
      snapshot.forEach((docSnap) => {
        const pathParts = docSnap.ref.path.split('/');
        if (pathParts.length >= 6 && pathParts[0] === 'branches' && pathParts[1] === authStore.branchId) {
          const eventId = pathParts[3];
          records.push({ eventId, memberId: docSnap.id, ...docSnap.data() });
        }
      });
      return records;
    } catch (error) {
      console.error('Error fetching attendance by date range:', error);
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  // 🚀 OPTIMIZATION: Fetch ONLY the logged-in member's records for a specific year
  async function fetchMyAttendanceByDateRange(memberId, startDate, endDate) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !memberId) return []
    
    isLoading.value = true;
    try {
      const q = query(
        collectionGroup(db, 'attendance'),
        where('memberId', '==', memberId),
        where('dateOnly', '>=', startDate),
        where('dateOnly', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      const records = [];
      
      snapshot.forEach((docSnap) => {
        const pathParts = docSnap.ref.path.split('/');
        if (pathParts.length >= 6 && pathParts[0] === 'branches' && pathParts[1] === authStore.branchId) {
          const eventId = pathParts[3];
          records.push({ eventId, memberId: docSnap.id, ...docSnap.data() });
        }
      });
      return records;
    } catch (error) {
      console.error('Error fetching my attendance:', error);
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  // 🚀 Fetch "Last Seen" for a member (1-Read with smart fallback)
  async function fetchMemberLastAttendance(memberId, memberCreatedAt) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !memberId) return null;
    
    // 1. Try the ultra-fast indexed query for NEW records
    try {
      const q = query(
        collectionGroup(db, 'attendance'),
        where('memberId', '==', memberId), 
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
         return snapshot.docs[0].data();
      }
    } catch(e) {
      console.warn('Optimized query missing index or failed. Falling back to manual search...');
    }

    // 2. FALLBACK for OLD records (Missing 'memberId' field)
    try {
      const eventsStore = useEventsStore();
      if (eventsStore.allEvents.length === 0) {
        await eventsStore.fetchEvents();
      }

      // Sort events newest first
      const sortedEvents = [...eventsStore.allEvents].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Stop loop early if the event happened before they registered
      const createdDateStr = memberCreatedAt ? new Date(memberCreatedAt).toISOString().split('T')[0] : null;

      for (const event of sortedEvents) {
        if (createdDateStr && event.date < createdDateStr) {
           break; 
        }

        const attRef = doc(db, 'branches', authStore.branchId, 'events', event.id, 'attendance', memberId);
        const attSnap = await getDoc(attRef);
        
        if (attSnap.exists()) {
          return attSnap.data();
        }
      }
    } catch(e) {
       console.error("Fallback search failed:", e);
    }

    return null; 
  }

  async function fetchSpeakers(force = false) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return
    if (!force && speakersList.value.length > 0) return;

    try {
      const speakersCol = collection(db, 'branches', authStore.branchId, 'speakers')
      const q = query(speakersCol, orderBy('name', 'asc'))
      const snapshot = await getDocs(q)
      speakersList.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch(e) {
      console.error("Error fetching speakers:", e)
    }
  }

  async function addNewSpeaker(name) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !name) return
    try {
      const speakerRef = doc(collection(db, 'branches', authStore.branchId, 'speakers'))
      await setDoc(speakerRef, { name: name.trim() })
      speakersList.value.push({ id: speakerRef.id, name: name.trim() });
      speakersList.value.sort((a,b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error saving new speaker:", error)
    }
  }

  async function deleteSpeaker(id) {
    const authStore = useAuthStore()
    try {
      await deleteDoc(doc(db, 'branches', authStore.branchId, 'speakers', id))
      speakersList.value = speakersList.value.filter(s => s.id !== id);
    } catch (error) {
      console.error("Error deleting speaker:", error)
    }
  }

  async function logDgroupMeeting(meetingData) {
    const authStore = useAuthStore()
    if (!authStore.branchId) {
      return { status: 'error', message: 'Branch ID missing' }
    }

    if (!meetingData || !meetingData.dgroupLeaderId) {
      return { status: 'error', message: 'Missing dgroupLeaderId in meeting data' }
    }

    try {
      const membersStore = useMembersStore()
      const rawAttendees = meetingData.attendees || {}
      const attendanceMap = {}

      let existingReport = null
      let existingAttendees = {}
      const meetingWeekId = meetingData.meetingWeekId
      if (meetingWeekId) {
        try {
          existingReport = await getDgroupMeetingReport(meetingData.dgroupLeaderId, meetingWeekId)
          if (existingReport && existingReport.attendees) {
            existingAttendees = existingReport.attendees
          }
        } catch (e) {
          console.warn('Could not load existing attendance data:', e)
        }
      }

      const isResubmission = !!existingReport || !!meetingData.isResubmitted

      const memberIds = new Set([
        ...Object.keys(existingAttendees || {}),
        ...Object.keys(rawAttendees || {})
      ])

      memberIds.forEach(memberId => {
        const a = rawAttendees[memberId] || {}
        const existingData = existingAttendees[memberId]

        let displayName = a.name || ''
        if (!displayName) {
          const m = (membersStore.activeMembers || [])
            .find(x => x.id === memberId)
          if (m) displayName =
            `${m.firstName || ''} ${m.lastName || ''}`.trim()
        }

        const isPresent = !!(existingData?.isPresent || a.isPresent)
        const tag = existingData?.tag || a.tag || 'BDM'

        attendanceMap[memberId] = {
          isPresent: isPresent,
          name: displayName || 'Unknown',
          tag: tag
        }
      })

      const meetingIdForUpdate = meetingData.meetingWeekId || meetingData.meetingDate || new Date().toISOString().split('T')[0]

      const existingGuests = Number(existingReport?.guests || 0)
      const existingEvangelized = Number(existingReport?.evangelized || 0)
      const existingCampus = Number(existingReport?.campusDmember || 0)

      const incomingGuests = Number(meetingData.guests)
      const incomingEvangelized = Number(meetingData.evangelized)
      const incomingCampus = Number(meetingData.campusDmember)

      const mergedGuests = Number.isFinite(incomingGuests) ? incomingGuests : existingGuests
      const mergedEvangelized = Number.isFinite(incomingEvangelized) ? incomingEvangelized : existingEvangelized
      const mergedCampus = Number.isFinite(incomingCampus) ? incomingCampus : existingCampus

      const payload = {
        attendees: attendanceMap,
        guests: mergedGuests,
        evangelized: mergedEvangelized,
        campusDmember: mergedCampus,
        locked: !!meetingData.locked,
        submittedBy:
          `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim(),
        submittedById: authStore.userProfile?.id || 'unknown',
        loggingDate: meetingData.loggingDate || new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        isResubmitted: isResubmission
      }

      const dgroupStore = useDgroupEventsStore()

      const res = await dgroupStore.updateDgroupMeeting(
        meetingData.dgroupLeaderId,
        meetingIdForUpdate,
        payload
      )

      if (res && res.status === 'success') {
        currentGroupHasLogged.value = true
        return {
          status: 'success',
          message: isResubmission ? 'DGroup attendance updated.' : 'DGroup attendance recorded.'
        }
      }

      return {
        status: 'error',
        message: res?.message || 'Failed to update meeting.'
      }
    } catch (error) {
      console.error('DGroup Log Error:', error)
      return { status: 'error', message: error.message }
    }
  }

  async function getDgroupMeetingReport(dgroupLeaderId, meetingWeekId) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingWeekId) return null
    try {
      const doc = await getDgroupMeetingReportDoc(dgroupLeaderId, meetingWeekId)
      if (doc) {
        return doc
      }
      return null
    } catch (e) {
      console.error('Error fetching meeting report:', e)
      return null
    }
  }

  async function getDgroupMeetingReportDoc(dgroupLeaderId, meetingWeekId) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return null
    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingWeekId)
      const snap = await getDoc(refDoc)
      if (!snap.exists()) return null
      return { id: snap.id, ...snap.data() }
    } catch (e) {
      console.error('Error getting meeting report doc:', e)
      return null
    }
  }

  async function fetchAttendanceForEvent(eventId) {
    if (!eventId) {
      currentEventAttendees.value = []
      return
    }
    
    isLoading.value = true
    try {
      const attendanceCol = getEventAttendanceCollection(eventId)
      if (!attendanceCol) return
      
      const snapshot = await getDocs(attendanceCol);
      const attendees = []
      snapshot.forEach((docSnap) => {
        attendees.push({ memberId: docSnap.id, ...docSnap.data() })
      })
      currentEventAttendees.value = attendees
    } catch (error) {
      console.error('Attendance fetch error:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAllAttendance(force = false) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return [];
    if (!force && allAttendance.value.length > 0) return allAttendance.value;

    isLoading.value = true
    try {
      const snapshot = await getDocs(collectionGroup(db, 'attendance'));
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
      return allAttendance.value;
    } catch (error) {
      console.error('All attendance fetch error:', error)
      throw error;
    } finally {
      isLoading.value = false
    }
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

      const timestamp = serverTimestamp();
      
      const attData = {
        memberId: memberId, 
        timestamp: timestamp,
        dateOnly: today,
        memberTag: memberTag,
        name: resolvedName || 'Unknown',
        checkedInBy: authStore.user?.uid || null,
        ministry: ministry 
      }

      await setDoc(attendanceRef, attData)
      
      currentEventAttendees.value.push({
         memberId: memberId,
         ...attData,
         timestamp: new Date() 
      })

      if (allAttendance.value.length > 0) {
        allAttendance.value.push({ eventId, memberId, ...attData, timestamp: new Date() })
      }

      return { status: 'success', message: 'Attendance recorded.' }
    } catch (error) {
      console.error('Attendance write error:', error)
      return { status: 'error', message: 'Database error.' }
    }
  }

  async function fetchDgroupMeetings(force = false) {
    const authStore = useAuthStore()
    if (!authStore.branchId) return
    if (!force && dgroupMeetings.value.length > 0) return;

    try {
      const q = query(collection(db, 'branches', authStore.branchId, 'dgroupAttendance'), orderBy('meetingDate', 'desc'))
      const snapshot = await getDocs(q);
      dgroupMeetings.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch(e) {
      console.error("Error fetching DGroup Meetings: ", e);
    }
  }

  async function updateAttendanceMinistry(memberId, eventId, newMinistry) {
    const authStore = useAuthStore()
    const attendanceRef = doc(db, 'branches', authStore.branchId, 'events', eventId, 'attendance', memberId)
    await updateDoc(attendanceRef, { ministry: newMinistry })
    
    const idx = currentEventAttendees.value.findIndex(a => a.memberId === memberId);
    if(idx > -1) {
      currentEventAttendees.value[idx].ministry = newMinistry;
    }
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
    fetchAttendanceByDateRange, 
    fetchMyAttendanceByDateRange,
    fetchMemberLastAttendance, 
    fetchDgroupMeetings,
    fetchSpeakers,
    addNewSpeaker,
    deleteSpeaker,
    markAttendance,
    logDgroupMeeting,
    getDgroupMeetingReport,
    updateAttendanceMinistry
  }
})