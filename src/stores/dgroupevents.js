import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { useAuthStore } from './auth'
import { getWeekEndDate, parseWeekId } from '../utils/weeklyMeetingUtils'

const DEFAULT_DGROUP_BG = '/DGBG.jpg'

function getMeetingWeekEndCutoff(meeting) {
  if (!meeting) return null

  let baseDate = meeting.meetingDate || null
  if (!baseDate && meeting.meetingWeekId) {
    const parsed = parseWeekId(meeting.meetingWeekId)
    baseDate = parsed?.endDate || parsed?.startDate || null
  }

  if (!baseDate) return null

  const saturday = getWeekEndDate(baseDate)
  saturday.setHours(23, 59, 59, 999)
  return saturday
}

function isMeetingAutoEnded(meeting, now = new Date()) {
  if (!meeting) return false
  if (meeting.ended) return true

  const cutoff = getMeetingWeekEndCutoff(meeting)
  if (!cutoff) return false

  return now.getTime() > cutoff.getTime()
}

export const useDgroupEventsStore = defineStore('dgroupevents', () => {
  // minimal state
  const isLoading = ref(false)

  // Helper to get meetings collection for a dgroup
  // Structure: branches/{branchId}/dgroupEvents/{dgroupLeaderId}/meetings/{meetingDate}
  const getDgroupCollection = (dgroupleaderId) => {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupleaderId) return null
      return collection(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupleaderId, 'meetings'
      )
    }

  /**
   * Create or overwrite a scheduled dgroup event (document id = meetingWeekId like 260308-14)
   * payload should include at least meetingWeekId (YYMMDD-DD format) or meetingDate (YYYY-MM-DD to convert)
   */
  async function createDgroupEvent(dgroupLeaderId, payload) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !payload) {
      return { status: 'error', message: 'Missing branch, dgroupLeaderId, or payload' }
    }

    try {
      const col = getDgroupCollection(dgroupLeaderId)
      if (!col) return { status: 'error', message: 'Invalid branch or dgroupLeaderId' }

      // Use weekId if available, otherwise use meetingDate
      const meetingId = payload.meetingWeekId || payload.meetingDate
      if (!meetingId) {
        return { status: 'error', message: 'Missing meetingWeekId or meetingDate in payload' }
      }

      // Prefer explicit doc path to avoid any collection reference ambiguity
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)
      console.debug('createDgroupEvent: writing to', `branches/${authStore.branchId}/dgroupEvents/${dgroupLeaderId}/meetings/${meetingId}`)

      const dgLeaderName = `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim()

      const docData = {
        dgroupLeaderId: dgroupLeaderId,
        meetingDate: payload.meetingDate,
        meetingWeekId: payload.meetingWeekId || meetingId,
        meetingTime: payload.meetingTime || '',
        venue: payload.venue || '',
        photoURL: payload.photoURL || DEFAULT_DGROUP_BG,
        // store meeting title under `meetingTitle` (preferred)
        meetingTitle: payload.meetingTitle || payload.description || '',
        dgroupLeader: payload.dgroupLeader || dgLeaderName || '',
        attendees: payload.attendees || {},
        guests: typeof payload.guests === 'number' ? payload.guests : 0,
        evangelized: typeof payload.evangelized === 'number' ? payload.evangelized : 0,
        campusDmember: typeof payload.campusDmember === 'number' ? payload.campusDmember : 0,
        ended: !!payload.ended,
        locked: !!payload.locked,
        submittedAt: serverTimestamp()
      }

      await setDoc(refDoc, docData)
      return { status: 'success', message: 'Dgroup event scheduled.' }
    } catch (error) {
      console.error('createDgroupEvent error:', error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Get upcoming dgroup events for a given dgroupLeaderId (meetingDate >= today)
   * Returns array sorted by meetingDate ascending
   */
  async function getUpcomingDgroupEvents(dgroupLeaderId) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId) return []
    try {
      const today = new Date().toISOString().split('T')[0]
      const colRef = collection(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings')
      const q = query(colRef, where('meetingDate', '>=', today), orderBy('meetingDate', 'asc'))
      const snap = await getDocs(q)
      const now = new Date()
      const results = []
      snap.forEach(d => {
        const item = { id: d.id, ...d.data() }
        if (!isMeetingAutoEnded(item, now)) {
          results.push(item)
        }
      })
      return results
    } catch (error) {
      console.error('getUpcomingDgroupEvents error:', error)
      return []
    }
  }

  /**
   * Get today's dgroup event for a given dgroupLeaderId (meetingDate == today)
   */
  async function getTodayDgroupEvent(dgroupLeaderId) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId) return null
    try {
      const today = new Date().toISOString().split('T')[0]
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', today)
      const snap = await getDoc(refDoc)
      if (!snap.exists()) return null
      const item = { id: snap.id, ...snap.data() }
      if (isMeetingAutoEnded(item)) {
        return null
      }
      return item
    } catch (error) {
      console.error('getTodayDgroupEvent error:', error)
      return null
    }
  }

  /**
   * Update (or create) a meeting document with attendance and stats
   * meetingId should be a week ID (YYMMDD-DD format) or date (YYYY-MM-DD string)
   */
  async function updateDgroupMeeting(dgroupLeaderId, meetingId, updates) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingId) return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingId' }
    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)
      const snap = await getDoc(refDoc)
      // Only update allowed meeting fields to avoid overwriting schedule data
      const allowed = ['attendees', 'guests', 'evangelized', 'campusDmember', 'locked', 'submittedBy', 'submittedById', 'loggingDate', 'submittedAt', 'isResubmitted']
      const updateObj = { submittedAt: serverTimestamp() }
      allowed.forEach((k) => {
        if (updates[k] !== undefined) updateObj[k] = updates[k]
      })

      if (snap.exists()) {
        await updateDoc(refDoc, updateObj)
      } else {
        // create doc with minimal required fields plus the updates
        await setDoc(refDoc, { dgroupLeaderId, meetingId, photoURL: DEFAULT_DGROUP_BG, ...updateObj })
      }
      return { status: 'success' }
    } catch (error) {
      console.error('updateDgroupMeeting error:', error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Edit a scheduled dgroup event details (leader scheduling fields only)
   * meetingId should be a week ID (YYMMDD-DD format) or date (YYYY-MM-DD string)
   */
  async function editDgroupEvent(dgroupLeaderId, meetingId, updates) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingId) {
      return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingId' }
    }

    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)
      const allowed = ['meetingTime', 'venue', 'meetingTitle', 'photoURL']
      const updateObj = { submittedAt: serverTimestamp() }
      allowed.forEach((k) => {
        if (updates[k] !== undefined) updateObj[k] = updates[k]
      })

      if (Object.keys(updateObj).length <= 1) {
        return { status: 'error', message: 'No valid fields to update.' }
      }

      await updateDoc(refDoc, updateObj)
      return { status: 'success', message: 'Dgroup event updated.' }
    } catch (error) {
      console.error('editDgroupEvent error:', error)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * Delete a scheduled dgroup event by meeting ID
   * meetingId should be a week ID (YYMMDD-DD format) or date (YYYY-MM-DD string)
   */
  async function deleteDgroupEvent(dgroupLeaderId, meetingId) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingId) {
      return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingId' }
    }
    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)
      await deleteDoc(refDoc)
      return { status: 'success', message: 'Dgroup event deleted.' }
    } catch (error) {
      console.error('deleteDgroupEvent error:', error)
      return { status: 'error', message: error.message }
    }
  }

  return {
    isLoading,
    createDgroupEvent,
    getUpcomingDgroupEvents,
    getTodayDgroupEvent
    ,
    // real-time listener: callback receives array of docs [{id, ...data}]
    listenToDgroupMeetings,
    // allow updating an existing meeting doc with attendance/stats
    updateDgroupMeeting,
    editDgroupEvent,
    deleteDgroupEvent
  }
})

/**
 * Real-time listener for meetings under a dgroup.
 * Returns an unsubscribe function.
 */
function listenToDgroupMeetings(dgroupLeaderId, callback) {
  const authStore = useAuthStore()
  if (!authStore.branchId || !dgroupLeaderId) return () => {}
  const pendingAutoEndWrites = new Set()

  try {
    const colRef = collection(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings')
    const q = query(colRef, orderBy('meetingDate', 'asc'))
    const unsub = onSnapshot(q, snap => {
      const now = new Date()
      const results = []

      snap.forEach(d => {
        const item = { id: d.id, ...d.data() }
        const shouldAutoEndNow = isMeetingAutoEnded(item, now)

        if (shouldAutoEndNow && !item.ended && !pendingAutoEndWrites.has(d.id)) {
          pendingAutoEndWrites.add(d.id)
          updateDoc(d.ref, {
            ended: true,
            endedReason: 'auto_saturday_2359',
            endedAt: serverTimestamp()
          })
            .catch((err) => {
              console.error('Auto-end dgroup meeting failed:', err)
            })
            .finally(() => {
              pendingAutoEndWrites.delete(d.id)
            })
        }

        if (shouldAutoEndNow) {
          item.ended = true
        }

        results.push(item)
      })

      try { callback(results) } catch (e) { console.error('dgroupevents callback error', e) }
    }, err => {
      if (err?.code !== 'permission-denied') {
        console.error('listenToDgroupMeetings onSnapshot error:', err)
      }
    })
    return unsub
  } catch (e) {
    console.error('listenToDgroupMeetings error:', e)
    return () => {}
  }
}