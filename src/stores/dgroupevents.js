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
  const getDgroupCollection = (dgroupleaderId) => {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupleaderId) return null
      return collection(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupleaderId, 'meetings'
      )
    }

  /**
   * Create or overwrite a scheduled dgroup event
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
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingId)

      const dgLeaderName = `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`.trim()

      // Calculate EN and BN purely from attendees (Member status)
      let calculatedEN = 0;
      let calculatedBN = 0;

      if (payload.attendees) {
        Object.values(payload.attendees).forEach(att => {
          if (att.isPresent && att.tag === 'EN') calculatedEN++;
          if (att.isPresent && att.tag === 'BN') calculatedBN++;
        });
      }

      const docData = {
        dgroupLeaderId: dgroupLeaderId,
        meetingDate: payload.meetingDate,
        meetingTime: payload.meetingTime || '',
        venue: payload.venue || '',
        meetingTitle: payload.meetingTitle || payload.description || '',
        dgroupLeader: payload.dgroupLeader || dgLeaderName || '',
        attendees: payload.attendees || {},
        guests: typeof payload.guests === 'number' ? payload.guests : 0,
        evangelized: typeof payload.evangelized === 'number' ? payload.evangelized : 0,
        campusDmember: typeof payload.campusDmember === 'number' ? payload.campusDmember : 0,
        elevateNew: calculatedEN,
        b1gNew: calculatedBN,
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
   * Update meeting document. EN and BN are derived from attendee tags.
   */
  async function updateDgroupMeeting(dgroupLeaderId, meetingDate, updates) {
    const authStore = useAuthStore()
    if (!authStore.branchId || !dgroupLeaderId || !meetingDate) return { status: 'error', message: 'Missing branch, dgroupLeaderId, or meetingDate' }
    try {
      const refDoc = doc(db, 'branches', authStore.branchId, 'dgroupEvents', dgroupLeaderId, 'meetings', meetingDate)
      const snap = await getDoc(refDoc)
      
      const allowed = ['attendees', 'guests', 'evangelized', 'campusDmember', 'locked', 'ended', 'submittedBy', 'submittedById']
      const updateObj = { submittedAt: serverTimestamp() }
      allowed.forEach((k) => {
        if (updates[k] !== undefined) updateObj[k] = updates[k]
      })

      // Fix member store: derive status counts from attendees
      if (updates.attendees) {
        let calculatedEN = 0;
        let calculatedBN = 0;
        Object.values(updates.attendees).forEach(att => {
          if (att.isPresent && att.tag === 'EN') calculatedEN++;
          if (att.isPresent && att.tag === 'BN') calculatedBN++;
        });
        updateObj.elevateNew = calculatedEN;
        updateObj.b1gNew = calculatedBN;
      }

      if (snap.exists()) {
        await updateDoc(refDoc, updateObj)
      } else {
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
    getTodayDgroupEvent,
    listenToDgroupMeetings,
    updateDgroupMeeting
  }
})

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