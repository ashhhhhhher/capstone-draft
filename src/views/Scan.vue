<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import Modal from '../components/dgmComponents/Modal.vue'

// --- Stores ---
const membersStore = useMembersStore()
const { members } = storeToRefs(membersStore)
const { currentEvent } = storeToRefs(useEventsStore())
const attendanceStore = useAttendanceStore()
const authStore = useAuthStore()

// --- Refs ---
const manualIdInput = ref('')
const scanResult = ref({ status: null, message: '' })
let scannerInstance = null

// --- Volunteer Role Handling ---
const showVolunteerPrompt = ref(false)
const pendingMember = ref(null) // Member waiting for role selection
const isProcessing = ref(false)

// List of all standard ministries for selection
const standardMinistries = ['Host Team', 'Live Prod', 'Exalt', 'Welcome', 'DGM']

// ---Computed check for event type ---
const isAttendanceEvent = computed(() => {
  return currentEvent.value && (currentEvent.value.eventType === 'service' || currentEvent.value.eventType === 'b1g_event')
})

// --- Core Logic ---
async function processMemberId(memberId) {
  const trimmedId = memberId.trim()
  
  // 1. Check if an event is active
  if (!currentEvent.value) {
    scanResult.value = { status: 'error', message: 'No active event.' }
    return
  }
  // 2. Check if this event type records attendance
  if (!isAttendanceEvent.value) {
    scanResult.value = { status: 'error', message: `Attendance is not recorded for this event type (${currentEvent.value.name}).` }
    return
  }
  
  const member = members.value.find(m => m.id === trimmedId)
  
  if (!member) {
    scanResult.value = { status: 'error', message: `Member ID "${trimmedId}" not found.` }
    return
  }

  // If this is a B1G event, only members whose ageCategory is 'B1G' may attend
  if (currentEvent.value && currentEvent.value.eventType === 'b1g_event') {
    const ageCat = member.finalTags?.ageCategory
    if (ageCat !== 'B1G') {
      const message = ageCat === 'Elevate' ? 'Member is not under B1G.' : 'Member is not eligible for B1G events.'
      scanResult.value = { status: 'error', message }
      return
    }
  }

  // --- DYNAMIC VOLUNTEER CHECK ---
  // If member is a volunteer, pause and ask for role
  if (member.finalTags && member.finalTags.isVolunteer) {
    pendingMember.value = member
    showVolunteerPrompt.value = true
    if (scannerInstance) {
       scannerInstance.pause(true) // Pause scanning while modal is open
    }
    return
  }

  // Otherwise, mark as regular (N/A)
  await finalizeAttendance(member, 'N/A')
}

// --- Finalize Attendance ---
async function finalizeAttendance(member, ministryRole) {
  isProcessing.value = true
  const currentEventId = currentEvent.value.id
  // prefer name from auth store (current logged-in user's profile), then member record
  const name = authStore.userProfile?.displayName || member.displayName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown'
  const result = await attendanceStore.markAttendance(member.id, currentEventId, ministryRole, name)

  if (result.status === 'success') {
    const ministryMsg = ministryRole !== 'N/A' ? ` (Serving: ${ministryRole})` : ''
    scanResult.value = { 
      status: 'success', 
      message: `Welcome, ${member.firstName}! Attendance recorded.${ministryMsg}` 
    }
  } else if (result.status === 'warning') {
    scanResult.value = { 
      status: 'warning', 
      message: `${member.firstName} is already marked present.` 
    }
  } else {
    scanResult.value = { 
      status: 'error', 
      message: `Database error for ${member.firstName}. Please try again.` 
    }
  }
  
  // Cleanup
  manualIdInput.value = ''
  pendingMember.value = null
  showVolunteerPrompt.value = false
  isProcessing.value = false

  // Resume Scanner if paused
  if (scannerInstance && scannerInstance.getState() === 3) { // 3 = PAUSED
     scannerInstance.resume()
  }
  
  setTimeout(() => {
    scanResult.value = { status: null, message: '' }
  }, 4000)
}

// --- Volunteer Modal Actions ---
async function handleVolunteerSelection(ministry) {
  if (!pendingMember.value) return
  
  // 1. Update Profile if this ministry is new for them
  const member = pendingMember.value;
  // Make sure volunteerMinistry array exists
  const currentMinistries = member.finalTags.volunteerMinistry || [];
  
  if (!currentMinistries.includes(ministry)) {
      // Create a copy of the array and add
      const updatedMinistries = [...currentMinistries, ministry];
      
      const updatedMemberData = {
          ...member,
          finalTags: {
              ...member.finalTags,
              volunteerMinistry: updatedMinistries
          }
      };
      
      try {
          await membersStore.updateMember(updatedMemberData);
          console.log(`Updated ${member.firstName}'s profile with new ministry: ${ministry}`);
      } catch (e) {
          console.error("Failed to update member ministry tag during scan", e);
      }
  }

  // 2. Mark Attendance
  finalizeAttendance(pendingMember.value, ministry)
}

function handleRegularAttendance() {
  if (!pendingMember.value) return
  finalizeAttendance(pendingMember.value, 'N/A')
}

function cancelVolunteerPrompt() {
  pendingMember.value = null
  showVolunteerPrompt.value = false
  if (scannerInstance && scannerInstance.getState() === 3) {
     scannerInstance.resume()
  }
}


// --- Scanner Functions ---
function onScanSuccess(decodedText, decodedResult) {
  // If modal is open, ignore scans (safety check)
  if (showVolunteerPrompt.value) return 
  processMemberId(decodedText)
}
function onScanError(errorMessage) {
}

function handleManualSubmit() {
  if (!manualIdInput.value) return
  processMemberId(manualIdInput.value)
}

// --- Lifecycle Hooks ---
onMounted(() => {
  if (isAttendanceEvent.value) {
    startScanner()
  }
})

function startScanner() {
  const scannerConfig = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    supportedScanTypes: [0]
  }
  scannerInstance = new Html5QrcodeScanner("qr-reader", scannerConfig, false)
  scannerInstance.render(onScanSuccess, onScanError)
}

onUnmounted(() => {
  if (scannerInstance) {
    scannerInstance.clear().catch(error => {
      console.error("Failed to clear scanner.", error)
    })
  }
})
</script>

<template>
  <div class="scan-container">
    <div class="scan-header">
      <h1>Scan Attendance</h1>
      <p v-if="currentEvent" class="current-event-text">
        Active Event: <strong>{{ currentEvent.name }}</strong>
      </p>
      <p v-else class="current-event-text-error">
        <strong>No Active Event Found</strong>
      </p>
    </div>

    <!--  Conditional rendering of scanner -->
    <div v-if="isAttendanceEvent" class="scanner-wrapper">
      <div id="qr-reader"></div>
    </div>
    <div v-else class="scanner-disabled">
      <p>Attendance is not recorded for this event type.</p>
    </div>
    
    <div v-if="scanResult.status" class="result-box-wrapper">
      <div 
        class="result-box" 
        :class="{
          'is-success': scanResult.status === 'success',
          'is-error': scanResult.status === 'error',
          'is-warning': scanResult.status === 'warning'
        }"
      >
        <p>{{ scanResult.message }}</p>
      </div>
    </div>
    
    <div class="divider">
      <span>OR</span>
    </div>

    <div class="manual-input-wrapper">
      <h3>Manual ID Entry</h3>
      <p>If the scanner isn't working, type the member's ID below.</p>
      <form class="manual-form" @submit.prevent="handleManualSubmit">
        <input 
          type="text" 
          class="manual-input"
          placeholder="e.g., Q-100001"
          v-model="manualIdInput"
          :disabled="!isAttendanceEvent || showVolunteerPrompt"
        >
        <button type="submit" class="submit-btn" :disabled="!isAttendanceEvent || showVolunteerPrompt">
          Submit ID
        </button>
      </form>
    </div>

    <!-- VOLUNTEER SELECTION MODAL -->
    <Modal v-if="showVolunteerPrompt" @close="cancelVolunteerPrompt">
       <div class="volunteer-prompt">
          <h3>Volunteer Detected</h3>
          <p class="member-name">{{ pendingMember?.firstName }} {{ pendingMember?.lastName }}</p>
          <p class="question">How are they attending today?</p>
          
          <div class="ministry-options">
             <!-- Regular Attendance -->
             <button class="role-btn regular" @click="handleRegularAttendance">
               Attending as Regular
             </button>
             
             <div class="divider-small">OR SERVING IN</div>

             <!-- All Standard Ministry Options -->
             <div class="ministry-grid">
                <button 
                  v-for="min in standardMinistries" 
                  :key="min"
                  class="role-btn ministry"
                  @click="handleVolunteerSelection(min)"
                >
                  {{ min }}
                </button>
             </div>
          </div>

          <button class="cancel-link" @click="cancelVolunteerPrompt">Cancel Scan</button>
       </div>
    </Modal>
  </div>
</template>

<style scoped>
.scan-container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}
.scan-header h1 {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
}
.current-event-text, .current-event-text-error {
  text-align: center;
  font-size: 16px;
  margin-bottom: 24px;
}
.current-event-text strong {
  color: #0D47A1;
}
.current-event-text-error strong {
  color: #D32F2F;
}

.scanner-wrapper {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #ddd;
  background-color: #f0f0f0;
}
#qr-reader {
  width: 100%;
}
:deep(#qr-reader__dashboard_section_csr) {
  display: none;
}

.scanner-disabled {
  width: 100%;
  border-radius: 12px;
  background: #ECEFF1;
  text-align: center;
  padding: 60px 20px;
  box-sizing: border-box;
  color: #546E7A;
  font-weight: 600;
  font-size: 16px;
}

/* --- Result Box Styles --- */
.result-box-wrapper {
  margin-top: 24px;
}
.result-box {
  padding: 16px;
  border-radius: 8px;
  font-weight: 600;
  text-align: center;
}
.result-box.is-success {
  background-color: #E8F5E9;
  color: #2E7D32;
  border: 1px solid #A5D6A7;
}
.result-box.is-error {
  background-color: #FFEBEE;
  color: #C62828;
  border: 1px solid #EF9A9A;
}
.result-box.is-warning {
  background-color: #FFF8E1;
  color: #FFA000;
  border: 1px solid #FFECB3;
}

.divider {
  text-align: center;
  margin: 32px 0;
  color: #78909C;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 16px;
}
.divider::before, .divider::after {
  content: '';
  flex-grow: 1;
  height: 1px;
  background-color: #CFD8DC;
}

/* --- Manual Input --- */
.manual-input-wrapper {
  text-align: center;
}
.manual-input-wrapper h3 {
  margin-top: 0;
  margin-bottom: 8px;
}
.manual-input-wrapper p {
  margin-top: 0;
  margin-bottom: 20px;
  color: #546E7A;
}
.manual-form {
  display: flex;
  gap: 12px;
}
.manual-input {
  flex-grow: 1;
  padding: 12px;
  border: 1px solid #B0BEC5;
  border-radius: 8px;
  font-size: 16px;
}
.submit-btn {
  padding: 12px 20px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.submit-btn:disabled, .manual-input:disabled {
  background-color: #90A4AE;
  cursor: not-allowed;
  opacity: 0.7;
}

/* --- Volunteer Prompt Modal --- */
.volunteer-prompt {
  text-align: center;
  padding: 10px;
}
.volunteer-prompt h3 {
  margin: 0;
  color: #1565C0;
  font-size: 20px;
}
.member-name {
  font-size: 22px;
  font-weight: 800;
  margin: 8px 0;
  color: #37474F;
}
.question {
  color: #78909C;
  margin-bottom: 24px;
}

.ministry-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-btn {
  padding: 14px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform 0.1s;
}
.role-btn:active { transform: scale(0.98); }

.role-btn.regular {
  background-color: #ECEFF1;
  color: #455A64;
  border: 1px solid #CFD8DC;
}
.role-btn.ministry {
  background-color: #1976D2;
  color: white;
  box-shadow: 0 4px 10px rgba(25, 118, 210, 0.2);
}

.ministry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.divider-small {
  font-size: 12px;
  color: #B0BEC5;
  font-weight: 700;
  margin: 8px 0;
  letter-spacing: 1px;
}

.cancel-link {
  background: none;
  border: none;
  color: #EF5350;
  font-weight: 600;
  margin-top: 24px;
  cursor: pointer;
  text-decoration: underline;
}
</style>