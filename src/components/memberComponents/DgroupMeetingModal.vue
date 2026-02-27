<script setup>
import { ref, computed } from 'vue'
import Modal from '../dgmComponents/Modal.vue'
import DatePicker from '../dgmComponents/DatePicker.vue'
import { useAuthStore } from '../../stores/auth'
import { db } from '../../firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const emit = defineEmits(['close','scheduled'])
const authStore = useAuthStore()

const scheduleDate = ref('')
const scheduleTime = ref('')
const scheduleVenue = ref('')
const scheduleTitle = ref('')
const scheduleStatus = ref({ type: '', message: '' })
const isSubmitting = ref(false)

const isLeader = computed(() => !!authStore.userProfile?.finalTags?.isDgroupLeader)

function close() { emit('close') }

async function handleScheduleSubmit() {
  if (!isLeader.value) {
    scheduleStatus.value = { type: 'error', message: 'Only Dgroup leaders can schedule meetings.' }; return
  }
  if (!scheduleDate.value || !scheduleTime.value || !scheduleVenue.value) {
    scheduleStatus.value = { type: 'error', message: 'Please fill required fields.' }; return
  }

  isSubmitting.value = true
  const profile = authStore.userProfile
  const dgroupId = profile?.dgroupId 
  const lid = profile?.id || authStore.user?.uid
  const leaderName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
  const leaderDocId = `${leaderName.replace(/\s+/g, '')}_${lid}`

  if (!dgroupId) {
    scheduleStatus.value = { type: 'error', message: 'Dgroup ID missing from your profile.' }
    isSubmitting.value = false; return
  }

  const eventDocId = `meeting_${Date.now()}`

  try {
    // 1. Update Leader Metadata Doc (Summary) - NEW PATH: branches/baguio/...
    await setDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId), {
      status: 'active',
      activeMeeting: eventDocId,
      meetingDate: scheduleDate.value,
      docType: 'leader_summary',
      lastActivity: serverTimestamp()
    }, { merge: true })

    // 2. Create Meeting Doc inside the Meetings subcollection
    await setDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId, 'Meetings', eventDocId), {
      meetingDate: scheduleDate.value,
      meetingTime: scheduleTime.value,
      venue: scheduleVenue.value,
      meetingTitle: scheduleTitle.value || 'Weekly Dgroup',
      status: 'pending',
      lastUpdated: serverTimestamp(),
      leaderName: leaderName,
      leaderId: lid,
      dgroupId: dgroupId,
      docType: 'event_entry',
      meetingId: eventDocId
    }, { merge: true })

    emit('scheduled', { id: eventDocId, date: scheduleDate.value })
    close()
  } catch (e) {
    console.error("Schedule Error:", e)
    scheduleStatus.value = { type: 'error', message: 'Failed to save to Firestore.' }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Modal @close="close">
    <div class="form-container">
      <div class="form-header"><h2>Schedule Weekly Dgroup Meeting</h2></div>
      <div class="separator"></div>
      <div v-if="scheduleStatus.message" class="status-banner" :class="scheduleStatus.type"><span>{{ scheduleStatus.message }}</span></div>
      <form class="form-body" @submit.prevent="handleScheduleSubmit">
        <div class="form-group"><label>Date</label><DatePicker v-model="scheduleDate" required /></div>
        <div class="form-group"><label>Time</label><input type="time" v-model="scheduleTime" required /></div>
        <div class="form-group"><label>Venue</label><input v-model="scheduleVenue" required /></div>
        <div class="form-group"><label>Meeting Title</label><input v-model="scheduleTitle" placeholder="e.g. Life Study" /></div>
        <div class="actions">
          <button type="button" class="cancel" @click="close">Cancel</button>
          <button type="submit" class="confirm" :disabled="!isLeader || isSubmitting">{{ isSubmitting ? 'Scheduling...' : 'Schedule Meeting' }}</button>
        </div>
      </form>
      <div class="click-outside-hint">click outside to close</div>
    </div>
  </Modal>
</template>

<style scoped>
.separator{height:1px;background-color:#ECEFF1;margin:16px 0;width:100%}
.form-container{padding:8px 12px;position:relative}
.form-header h2{margin:0;font-size:18px;color:#263238;font-weight:700}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-weight:700;font-size:12px;margin-bottom:4px;color:#37474F}
.form-group input{width:100%;padding:10px;border-radius:6px;border:1px solid #E0E0E0;box-sizing:border-box;font-size:14px}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.cancel{background:#fff;border:1px solid #E0E0E0;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500}
.confirm{background:#1976D2;color:white;padding:8px 16px;border-radius:6px;border:none;font-weight:700;cursor:pointer}
.confirm:disabled{opacity:0.6;cursor:not-allowed}
.status-banner{padding:8px;border-radius:6px;margin-bottom:8px;font-size:13px}
.status-banner.error{background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2}
.click-outside-hint{text-align:center;font-size:11px;color:#90A4AE;margin-top:15px}
</style>