<script setup>
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-vue-next'

// The 'result' prop will contain { success, status, member }
defineProps({
  result: Object
})

const emit = defineEmits(['close'])
</script>

<template>
  <div class="result-container">
    
    <!-- Success: Checked In -->
    <template v-if="result.status === 'checked_in'">
      <CheckCircle :size="64" class="icon success" />
      <h2 class="success">Check-In Successful!</h2>
      <p>Welcome, <strong>{{ result.member.firstName }} {{ result.member.lastName }}</strong>!</p>
    </template>
    
    <!-- Warning: Already Present -->
    <template v-else-if="result.status === 'already_present'">
      <AlertTriangle :size="64" class="icon warning" />
      <h2 class="warning">Already Checked In</h2>
      <p><strong>{{ result.member.firstName }} {{ result.member.lastName }}</strong> is already marked as present.</p>
    </template>

    <!-- Error: Not Found -->
    <template v-else-if="result.status === 'not_found'">
      <XCircle :size="64" class="icon error" />
      <h2 class="error">Member Not Found</h2>
      <p>The scanned QR code is not valid or not in the system.</p>
    </template>

    <button class="done-btn" @click="emit('close')">Scan Next</button>
  </div>
</template>

<style scoped>
.result-container {
  text-align: center;
  padding: 16px;
}
.icon {
  margin-bottom: 16px;
}
.icon.success { color: #4CAF50; }
.icon.warning { color: #FFC107; }
.icon.error { color: #F44336; }

h2 { margin-top: 0; }
h2.success { color: #4CAF50; }
h2.warning { color: #FFC107; }
h2.error { color: #F44336; }

p { font-size: 16px; line-height: 1.5; color: #333; }

.done-btn {
  width: 100%;
  padding: 14px;
  margin-top: 16px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>
