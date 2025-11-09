<script setup>
import { computed } from 'vue'
import QrcodeVue from 'vue-qrcode'
import { LogOut } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

// Get the specific member profile object (which contains the Q-ID)
const memberProfile = computed(() => authStore.userProfile);

// CRITICAL FIX: Use the short Q-ID for the QR code value
const qrCodeValue = computed(() => memberProfile.value?.id || authStore.user?.uid);
const displayName = computed(() => memberProfile.value 
    ? `${memberProfile.value.firstName} ${memberProfile.value.lastName}` 
    : authStore.user?.email);

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="member-dashboard-container">
    <div class="dashboard-header">
      <div class="header-text">
        <h1>Welcome, {{ displayName }}</h1>
        <p>Elevate Baguio Member</p>
      </div>
      <button @click="handleLogout" class="logout-btn">
        <LogOut :size="18" />
        <span>Logout</span>
      </button>
    </div>

    <div class="qr-card">
      <h2>Your Attendance QR Code</h2>
      <p class="subtitle">Show this code to the admin at check-in.</p>

      <div class="qr-code-wrapper">
        <!-- Use the short Q-ID for the QR code -->
        <QrcodeVue 
          :value="qrCodeValue" 
          :size="250"
        />
        <p class="member-id-text">Member ID: {{ memberProfile?.id || 'Loading...' }}</p>
      </div>

      <div class="event-feed">
        <h3>Upcoming Events</h3>
        <div class="event-placeholder">
          <p>Upcoming events and CCF announcements will appear here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-dashboard-container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
}
.header-text h1 {
  margin: 0;
  font-size: 28px;
  color: #0D47A1;
}
.header-text p {
  margin: 4px 0 0 0;
  color: #546E7A;
}

.logout-btn {
  background: #ECEFF1;
  color: #37474F;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  height: fit-content;
  line-height: 1;
}

.qr-card {
  background: white;
  border-radius: 12px;
  padding: 30px 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  text-align: center;
}
.qr-card h2 {
  margin-top: 0;
  color: #333;
}
.subtitle {
  color: #546E7A;
  margin-bottom: 25px;
}
.qr-code-wrapper {
  display: inline-block;
  padding: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 5px rgba(0,0,0,0.1);
}
.member-id-text {
  font-size: 12px;
  color: #777;
  margin-top: 10px;
}
.event-feed {
  margin-top: 40px;
  text-align: left;
  border-top: 1px solid #ECEFF1;
  padding-top: 20px;
}
.event-feed h3 {
  font-size: 18px;
  color: #0D47A1;
  margin-top: 0;
}
.event-placeholder {
  background: #E3F2FD;
  padding: 15px;
  border-radius: 8px;
  color: #1976D2;
  font-size: 14px;
}
.event-placeholder p {
  margin: 0;
}
</style>