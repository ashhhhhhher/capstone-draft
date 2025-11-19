<script setup>
import QrcodeVue from 'vue-qrcode'

defineProps({
  memberData: Object
})

const emit = defineEmits(['close'])
</script>

<template>
  <div class="success-container">
    <h2>Registration Successful!</h2>
    <p>
      The profile for <strong>{{ memberData.firstName }} {{ memberData.lastName }}</strong> has been created.
    </p>

    <div class="qr-code-wrapper">
      <!-- This is the correct component tag and prop -->
      <QrcodeVue 
        :value="memberData.id" 
        :size="220"
      />
      <p class="qr-id">Member ID: {{ memberData.id }}</p>
    </div>

    <p class="instructions">
      The member can use this QR code for attendance.
    </p>

    <button class="done-btn" @click="emit('close')">Done</button>
  </div>
</template>

<style scoped>
.success-container { text-align: center; padding: 16px; }
h2 { color: #0D47A1; margin-top: 0; }
p { font-size: 16px; line-height: 1.5; color: #333; }
.qr-code-wrapper { margin: 24px 0; display: inline-block; border: 1px solid #eee; padding: 16px; border-radius: 12px; }
.qr-id { font-size: 12px; color: #777; margin: 8px 0 0 0; word-break: break-all; }
.instructions { font-size: 14px; color: #546E7A; }
.done-btn { width: 100%; padding: 14px; margin-top: 16px; background-color: #1976D2; color: white; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; }
</style>