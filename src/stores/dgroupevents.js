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
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { useAuthStore } from './auth'

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
   * Create or overwrite a scheduled dgroup event (document id = meetingDate YYYY-MM-DD)
   * payload should include at least meetingDate (YYYY-MM-DD string)
   */
  async function createDgroupEvent(dgroupLeaderId, payload) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !payload || !payload.meetingDate) {
      return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingDate' }
    }

    try {
      const col = getDgroupCollection(dgroupLeaderId)
      if (!col) return { status: 'error', message: 'Invalid branch or dgroupLeaderId' }

      const meetingId = payload.meetingDate
      // Prefer explicit doc path to avoid any collection reference ambiguity
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)
      console.debug('createDgroupEvent: writing to', `branches/${authStore.branchId}/dgroupEvents/${dgroupLeaderId}/meetings/${meetingId}`)

      const dgLeaderName = `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim()

      const docData = {
        dgroupLeaderId: dgroupLeaderId,
        meetingDate: payload.meetingDate,
        meetingTime: payload.meetingTime || '',
        venue: payload.venue || '',
        // store meeting title under `meetingTitle` (preferred)
        meetingTitle: payload.meetingTitle || payload.description || '',
        dgroupLeader: payload.dgroupLeader || dgLeaderName || '',
        attendees: payload.attendees || {},
        guests: typeof payload.guests === 'number' ? payload.guests : 0,
        evangelized: typeof payload.evangelized === 'number' ? payload.evangelized : 0,
        conversations: typeof payload.conversations === 'number' ? payload.conversations : 0,
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
      const results = []
      snap.forEach(d => results.push({ id: d.id, ...d.data() }))
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
      return { id: snap.id, ...snap.data() }
    } catch (error) {
      console.error('getTodayDgroupEvent error:', error)
      return null
    }
  }

  /**
   * Update (or create) a meeting document with attendance and stats
   * meetingDate should be YYYY-MM-DD string
   */
  async function updateDgroupMeeting(dgroupLeaderId, meetingDate, updates) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingDate) return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingDate' }
    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingDate)
      const snap = await getDoc(refDoc)
      // Only update allowed meeting fields to avoid overwriting schedule data
      const allowed = ['attendees', 'guests', 'evangelized', 'conversations', 'locked', 'ended', 'submittedBy', 'submittedById']
      const updateObj = { submittedAt: serverTimestamp() }
      allowed.forEach((k) => {
        if (updates[k] !== undefined) updateObj[k] = updates[k]
      })

      if (snap.exists()) {
        await updateDoc(refDoc, updateObj)
      } else {
        // create doc with minimal required fields plus the updates
        await setDoc(refDoc, { dgroupLeaderId, meetingDate, ...updateObj })
      }
      return { status: 'success' }
    } catch (error) {
      console.error('updateDgroupMeeting error:', error)
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
    updateDgroupMeeting
  }
})

/**
 * Real-time listener for meetings under a dgroup.
 * Returns an unsubscribe function.
 */
async function listenToDgroupMeetings(dgroupLeaderId, callback) {
  const authStore = useAuthStore()
  if (!authStore.branchId || !dgroupLeaderId) return () => {}
  try {
    const colRef = collection(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings')
    const q = query(colRef, orderBy('meetingDate', 'asc'))
    const unsub = onSnapshot(q, snap => {
      const results = []
      snap.forEach(d => results.push({ id: d.id, ...d.data() }))
      try { callback(results) } catch (e) { console.error('dgroupevents callback error', e) }
    }, err => {
      console.error('listenToDgroupMeetings onSnapshot error:', err)
    })
    return unsub
  } catch (e) {
    console.error('listenToDgroupMeetings error:', e)
    return () => {}
  }
}
