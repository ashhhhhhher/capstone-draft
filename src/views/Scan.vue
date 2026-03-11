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
const standardMinistries = ['DGM', 'Live Prod', 'Exalt', 'Media', 'Events']

const isAttendanceEvent = computed(() => {
  return currentEvent.value && (currentEvent.value.eventType === 'service' || currentEvent.value.eventType === 'b1g_event' || currentEvent.value.eventType === 'ccf_event')
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
  const member = pendingMember.value
    finalizeAttendance(member, ministry)
}

// When a member who is currently tagged as a volunteer is scanned butchosen as regular,
// update their profile so exports will place them under Regulars going forward.
async function handleRegularAttendance() {
  if (!pendingMember.value) return
  // Do NOT modify the member's persistent volunteer tag when they are marked as regular for this event.
  // We only record per-event attendance (ministry='N/A') so their profile volunteer status remains until an admin changes it.
  await finalizeAttendance(pendingMember.value, 'N/A')
}
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
      <div class="header-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="header-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      </div>
      <h1>Scan Attendance</h1>
      <div v-if="currentEvent" class="event-badge active">
        <span class="pulse-dot"></span>
        Active: <strong>{{ currentEvent.name }}</strong>
      </div>
      <div v-else class="event-badge inactive">
        <strong>No Active Event</strong>
      </div>
    </div>

    <div v-if="isAttendanceEvent" class="scanner-wrapper">
      <div id="qr-reader"></div>
    </div>
    <div v-else class="scanner-disabled">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="disabled-icon">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      <p>Attendance is disabled for this event type.</p>
    </div>
    
    <div v-if="scanResult.status" class="result-box-wrapper">
      <div class="result-box" :class="'is-'+scanResult.status">
        <svg v-if="scanResult.status === 'success'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <svg v-if="scanResult.status === 'error'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <svg v-if="scanResult.status === 'warning'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <p>{{ scanResult.message }}</p>
      </div>
    </div>
    
    <div class="divider"><span>OR ENTER MANUALLY</span></div>

    <div class="manual-input-wrapper">
      <form class="manual-form" @submit.prevent="handleManualSubmit">
        <div class="input-group">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="input-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <input type="text" class="manual-input" placeholder="e.g. Q-100" v-model="manualIdInput" :disabled="!isAttendanceEvent || showVolunteerPrompt">
        </div>
        <button type="submit" class="submit-btn" :disabled="!isAttendanceEvent || showVolunteerPrompt">
          Check In
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
        </button>
      </form>
    </div>

    <Modal v-if="showVolunteerPrompt" @close="cancelVolunteerPrompt">
      <div class="volunteer-prompt animated-entry">
        <div class="volunteer-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="volunteer-star">
            <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" />
          </svg>
        </div>
        <h3>Welcome, Volunteer!</h3>
        <p class="member-name">{{ pendingMember?.firstName }} {{ pendingMember?.lastName }}</p>
        <p class="prompt-subtitle">How are you joining us today?</p>

        <div class="ministry-options">
          <div class="ministry-section">
            <span class="section-label">Serving In</span>
            <div class="ministry-grid">
              <button v-for="min in standardMinistries" :key="min" class="role-btn ministry" @click="handleVolunteerSelection(min)">
                <span class="min-name">{{ min }}</span>
              </button>
            </div>
          </div>

          <div class="divider-small"><span>OR</span></div>

          <button class="role-btn regular" @click="handleRegularAttendance">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            Attending as Regular
          </button>
        </div>
        <button class="cancel-link" @click="cancelVolunteerPrompt">Cancel Check-in</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
/* Main Container */
.scan-container {
  padding: 30px 20px;
  max-width: 560px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #334155;
}

/* Header */
.scan-header {
  text-align: center;
  margin-bottom: 28px;
}
.header-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: #EFF6FF;
  color: #2563EB;
  border-radius: 16px;
  margin-bottom: 12px;
}
.header-icon {
  width: 32px;
  height: 32px;
}
.scan-header h1 {
  font-size: 26px;
  font-weight: 800;
  color: #0F172A;
  margin: 0 0 10px 0;
  letter-spacing: -0.5px;
}
.event-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}
.event-badge.active {
  background-color: #F0FDF4;
  color: #166534;
  border: 1px solid #BBF7D0;
}
.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #22C55E;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
.event-badge.inactive {
  background-color: #FEF2F2;
  color: #991B1B;
  border: 1px solid #FECACA;
}

/* Scanner Area */
.scanner-wrapper {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 3px solid #F1F5F9;
  background: #FFF;
  margin-bottom: 10px;
}
:deep(#qr-reader__dashboard_section_csr) { display: none; }
:deep(#qr-reader) { border: none !important; }

.scanner-disabled {
  border-radius: 20px;
  background: #F8FAFC;
  border: 2px dashed #CBD5E1;
  text-align: center;
  padding: 50px 20px;
  color: #64748B;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.disabled-icon {
  width: 40px;
  height: 40px;
  color: #94A3B8;
}
.scanner-disabled p {
  margin: 0;
  font-weight: 500;
  font-size: 15px;
}

/* Result Box */
.result-box-wrapper { margin-top: 20px; animation: slideDown 0.3s ease-out; }
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.result-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid transparent;
}
.result-box svg { width: 20px; height: 20px; flex-shrink: 0; }
.is-success { background: #F0FDF4; color: #15803D; border-color: #BBF7D0; }
.is-error { background: #FEF2F2; color: #B91C1C; border-color: #FECACA; }
.is-warning { background: #FFFbeb; color: #B45309; border-color: #FDE68A; }

/* Dividers */
.divider {
  text-align: center;
  margin: 30px 0;
  color: #94A3B8;
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.divider::before, .divider::after {
  content: '';
  flex-grow: 1;
  height: 1px;
  background: #E2E8F0;
}

/* Manual Input */
.manual-input-wrapper {
  background: #FFF;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid #E2E8F0;
}
.manual-form {
  display: flex;
  gap: 12px;
}
.input-group {
  position: relative;
  flex-grow: 1;
}
.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: #94A3B8;
}
.manual-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 2px solid #E2E8F0;
  border-radius: 10px;
  font-size: 15px;
  color: #1E293B;
  transition: all 0.2s;
  box-sizing: border-box;
}
.manual-input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.submit-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  background: #2563EB;
  color: white;
  font-weight: 600;
  font-size: 15px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) { background: #1D4ED8; }
.submit-btn:active:not(:disabled) { transform: scale(0.97); }
.submit-btn:disabled { background: #94A3B8; cursor: not-allowed; opacity: 0.7; }
.btn-icon { width: 18px; height: 18px; }

/* Volunteer Prompt Modal Content */
.animated-entry { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.volunteer-prompt {
  text-align: center;
  padding: 10px;
}
.volunteer-icon-wrapper {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #FEF08A, #F59E0B);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 16px -4px rgba(245, 158, 11, 0.3);
}
.volunteer-star { width: 32px; height: 32px; color: #FFF; }
.volunteer-prompt h3 {
  margin: 0;
  font-size: 20px;
  color: #64748B;
  font-weight: 600;
}
.member-name {
  font-size: 28px;
  font-weight: 800;
  margin: 4px 0 8px;
  color: #0F172A;
  letter-spacing: -0.5px;
}
.prompt-subtitle {
  color: #64748B;
  font-size: 15px;
  margin: 0 0 24px;
}

.ministry-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #F8FAFC;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
}
.section-label {
  display: block;
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 700;
  color: #64748B;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}
.ministry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

/* Beautiful Role Buttons */
.role-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.role-btn:active { transform: scale(0.96); }

/* Ministry Buttons (Primary) */
.role-btn.ministry {
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
}
.role-btn.ministry:hover {
  background: linear-gradient(135deg, #60A5FA, #3B82F6);
  transform: translateY(-2px);
  box-shadow: 0 8px 12px -2px rgba(37, 99, 235, 0.3);
}

/* Regular Button (Secondary Outline) */
.role-btn.regular {
  gap: 8px;
  background: #FFF;
  color: #475569;
  border: 2px solid #CBD5E1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.role-btn.regular:hover {
  border-color: #94A3B8;
  color: #1E293B;
  background: #F8FAFC;
}
.role-btn.regular svg { width: 20px; height: 20px; }

.divider-small {
  display: flex;
  align-items: center;
  text-align: center;
  color: #94A3B8;
  font-size: 11px;
  font-weight: 700;
  margin: 4px 0;
}
.divider-small::before, .divider-small::after {
  content: '';
  flex: 1;
  border-bottom: 1px dashed #CBD5E1;
}
.divider-small span { padding: 0 10px; }

.cancel-link {
  background: none;
  border: none;
  color: #94A3B8;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}
.cancel-link:hover { color: #EF4444; text-decoration: underline; }
</style>