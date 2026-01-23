<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import Modal from '../components/dgmComponents/Modal.vue'

const membersStore = useMembersStore()
const { members } = storeToRefs(membersStore)
const { currentEvent } = storeToRefs(useEventsStore())
const attendanceStore = useAttendanceStore()

const manualIdInput = ref('')
const scanResult = ref({ status: null, message: '' })
let scannerInstance = null
const showVolunteerPrompt = ref(false)
const pendingMember = ref(null)
const isProcessing = ref(false)
const standardMinistries = ['Host Team', 'Live Prod', 'Exalt', 'Welcome', 'DGM']

const isAttendanceEvent = computed(() => {
  return currentEvent.value && (currentEvent.value.eventType === 'service' || currentEvent.value.eventType === 'b1g_event')
})

async function processMemberId(memberId) {
  const trimmedId = memberId.trim()
  if (!currentEvent.value) return scanResult.value = { status: 'error', message: 'No active event.' }
  if (!isAttendanceEvent.value) return scanResult.value = { status: 'error', message: `No recording for ${currentEvent.value.name}.` }
  
  const member = members.value.find(m => m.id === trimmedId)
  if (!member) return scanResult.value = { status: 'error', message: `ID "${trimmedId}" not found.` }

  if (currentEvent.value.eventType === 'b1g_event' && member.finalTags?.ageCategory === 'Elevate') {
    scanResult.value = { status: 'error', message: `Elevate restricted from B1G events.` }
    return setTimeout(() => scanResult.value = { status: null, message: '' }, 4000)
  }

  if (member.status === 'archived') await membersStore.checkAndAutoRestore(member.id);

  if (member.finalTags?.isVolunteer) {
    pendingMember.value = member
    showVolunteerPrompt.value = true
    if (scannerInstance) scannerInstance.pause(true)
    return
  }
  await finalizeAttendance(member, 'N/A')
}

async function finalizeAttendance(member, ministryRole) {
  isProcessing.value = true
  // AUTOMATION: Pass the member's specific tag (DL/DM) to the store
  // If they are a leader, we pass 'DL', otherwise default to 'DM'
  const tag = member.finalTags?.isDgroupLeader ? 'DL' : 'DM'
  
  const result = await attendanceStore.markAttendance(member.id, currentEvent.value.id, ministryRole, tag)

  let successMsg = `Welcome, ${member.firstName}! Attendance recorded.`;
  if (ministryRole !== 'N/A') successMsg += ` (${ministryRole})`;
  if (member.status === 'archived') successMsg += ` [Restored]`;

  if (result.status === 'success') scanResult.value = { status: 'success', message: successMsg }
  else if (result.status === 'warning') scanResult.value = { status: 'warning', message: `${member.firstName} already marked.` }
  else scanResult.value = { status: 'error', message: `Error for ${member.firstName}.` }
  
  manualIdInput.value = ''; pendingMember.value = null; showVolunteerPrompt.value = false; isProcessing.value = false;
  if (scannerInstance && scannerInstance.getState() === 3) scannerInstance.resume()
  setTimeout(() => scanResult.value = { status: null, message: '' }, 4000)
}

async function handleVolunteerSelection(ministry) {
  if (!pendingMember.value) return
  const member = pendingMember.value;
  const currentMinistries = member.finalTags.volunteerMinistry || [];
  if (!currentMinistries.includes(ministry)) {
    try {
      await membersStore.updateMember({ ...member, finalTags: { ...member.finalTags, volunteerMinistry: [...currentMinistries, ministry] }});
    } catch (e) { console.error(e) }
  }
  finalizeAttendance(pendingMember.value, ministry)
}

const handleRegularAttendance = () => finalizeAttendance(pendingMember.value, 'N/A')
const cancelVolunteerPrompt = () => { showVolunteerPrompt.value = false; if (scannerInstance?.getState() === 3) scannerInstance.resume() }
const onScanSuccess = (text) => { if (!showVolunteerPrompt.value) processMemberId(text) }
const onScanError = () => {}
const handleManualSubmit = () => { if (manualIdInput.value) processMemberId(manualIdInput.value) }

onMounted(() => { if (isAttendanceEvent.value) startScanner() })
function startScanner() {
  scannerInstance = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250, rememberLastUsedCamera: true, supportedScanTypes: [0] }, false)
  scannerInstance.render(onScanSuccess, onScanError)
}
onUnmounted(() => { if (scannerInstance) scannerInstance.clear().catch(e => console.error(e)) })
</script>

<template>
  <div class="scan-container">
    <div class="scan-header">
      <h1>Scan Attendance</h1>
      <p v-if="currentEvent" class="current-event-text">Active: <strong>{{ currentEvent.name }}</strong></p>
      <p v-else class="current-event-text-error"><strong>No Active Event</strong></p>
    </div>

    <div v-if="isAttendanceEvent" class="scanner-wrapper"><div id="qr-reader"></div></div>
    <div v-else class="scanner-disabled"><p>Attendance disabled for this event type.</p></div>
    
    <div v-if="scanResult.status" class="result-box-wrapper">
      <div class="result-box" :class="'is-'+scanResult.status"><p>{{ scanResult.message }}</p></div>
    </div>
    
    <div class="divider"><span>OR</span></div>

    <div class="manual-input-wrapper">
      <form class="manual-form" @submit.prevent="handleManualSubmit">
        <input type="text" class="manual-input" placeholder="Enter ID (e.g. Q-100)" v-model="manualIdInput" :disabled="!isAttendanceEvent || showVolunteerPrompt">
        <button type="submit" class="submit-btn" :disabled="!isAttendanceEvent || showVolunteerPrompt">Submit</button>
      </form>
    </div>

    <Modal v-if="showVolunteerPrompt" @close="cancelVolunteerPrompt">
      <div class="volunteer-prompt">
        <h3>Volunteer Detected</h3>
        <p class="member-name">{{ pendingMember?.firstName }} {{ pendingMember?.lastName }}</p>
        <div class="ministry-options">
          <button class="role-btn regular" @click="handleRegularAttendance">Regular Attendance</button>
          <div class="divider-small">OR SERVING IN</div>
          <div class="ministry-grid">
            <button v-for="min in standardMinistries" :key="min" class="role-btn ministry" @click="handleVolunteerSelection(min)">{{ min }}</button>
          </div>
        </div>
        <button class="cancel-link" @click="cancelVolunteerPrompt">Cancel</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.scan-container { padding: 20px; max-width: 600px; margin: 0 auto; }
.scan-header { text-align: center; margin-bottom: 20px; }
.scan-header h1 { font-size: 28px; font-weight: 700; margin-bottom: 5px; }
.current-event-text { color: #0D47A1; font-size: 14px; }
.current-event-text-error { color: #D32F2F; font-size: 14px; }
.scanner-wrapper { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #ddd; background: #f0f0f0; }
:deep(#qr-reader__dashboard_section_csr) { display: none; }
.scanner-disabled { border-radius: 12px; background: #ECEFF1; text-align: center; padding: 40px 20px; color: #546E7A; font-weight: 600; }
.result-box-wrapper { margin-top: 20px; }
.result-box { padding: 12px; border-radius: 8px; font-weight: 600; text-align: center; border: 1px solid transparent; }
.is-success { background: #E8F5E9; color: #2E7D32; border-color: #A5D6A7; }
.is-error { background: #FFEBEE; color: #C62828; border-color: #EF9A9A; }
.is-warning { background: #FFF8E1; color: #FFA000; border-color: #FFECB3; }
.divider { text-align: center; margin: 25px 0; color: #78909C; display: flex; align-items: center; gap: 15px; }
.divider::before, .divider::after { content: ''; flex-grow: 1; height: 1px; background: #CFD8DC; }
.manual-form { display: flex; gap: 10px; }
.manual-input { flex-grow: 1; padding: 12px; border: 1px solid #B0BEC5; border-radius: 8px; }
.submit-btn { padding: 12px 20px; background: #1976D2; color: white; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; }
.submit-btn:disabled { background: #90A4AE; cursor: not-allowed; }
.volunteer-prompt { text-align: center; padding: 5px; }
.member-name { font-size: 20px; font-weight: 800; margin: 5px 0; color: #37474F; }
.ministry-options { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
.role-btn { padding: 12px; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; transition: transform 0.1s; }
.role-btn:active { transform: scale(0.98); }
.role-btn.regular { background: #ECEFF1; color: #455A64; border: 1px solid #CFD8DC; }
.role-btn.ministry { background: #1976D2; color: white; }
.ministry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.divider-small { font-size: 11px; color: #B0BEC5; font-weight: 700; margin: 5px 0; }
.cancel-link { background: none; border: none; color: #EF5350; margin-top: 15px; cursor: pointer; text-decoration: underline; }
</style>