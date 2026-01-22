<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'

// --- Stores ---
const { members } = storeToRefs(useMembersStore())
const { currentEvent } = storeToRefs(useEventsStore())
const attendanceStore = useAttendanceStore()

// --- Refs ---
const manualIdInput = ref('')
const scanResult = ref({ status: null, message: '' })
let scannerInstance = null

// ---Computed check for event type ---
const isAttendanceEvent = computed(() => {
  return currentEvent.value && currentEvent.value.eventType === 'service'
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
  
  const currentEventId = currentEvent.value.id
  const member = members.value.find(m => m.id === trimmedId)
  
  if (!member) {
    scanResult.value = { status: 'error', message: `Member ID "${trimmedId}" not found.` }
    return
  }

  const result = await attendanceStore.markAttendance(trimmedId, currentEventId)

  if (result.status === 'success') {
    scanResult.value = { 
      status: 'success', 
      message: `Welcome, ${member.firstName} ${member.lastName}! Attendance recorded.` 
    }
  } else if (result.status === 'warning') {
    scanResult.value = { 
      status: 'warning', 
      message: `${member.firstName} ${member.lastName} is already marked present.` 
    }
  } else {
    scanResult.value = { 
      status: 'error', 
      message: `Database error for ${member.firstName}. Please try again.` 
    }
  }
  
  manualIdInput.value = ''
  
  setTimeout(() => {
    scanResult.value = { status: null, message: '' }
  }, 5000)
}

// --- Scanner Functions ---
function onScanSuccess(decodedText, decodedResult) {
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
          :disabled="!isAttendanceEvent"
        >
        <button type="submit" class="submit-btn" :disabled="!isAttendanceEvent">
          Submit ID
        </button>
      </form>
    </div>
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

/* Style for disabled scanner */
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
/*  Disabled state */
.submit-btn:disabled, .manual-input:disabled {
  background-color: #90A4AE;
  cursor: not-allowed;
  opacity: 0.7;
}
</style>