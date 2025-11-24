<template>
  <div>
    <MemberNavBar />
    <div class="member-profile-grid">
      <!-- Left: Profile Details -->
      <div class="profile-details">
        <div class="profile-header">
          <h1>{{ displayName }}</h1>
          <p class="subtitle">Elevate Baguio Member</p>
        </div>
        <div class="profile-info-list">
          <div class="profile-info-row">
            <span class="label">Email:</span>
            <span class="value">{{ memberProfile?.email || authStore.user?.email }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.contactNumber">
            <span class="label">Contact #:</span>
            <span class="value">{{ memberProfile.contactNumber }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.gender">
            <span class="label">Gender:</span>
            <span class="value">{{ memberProfile.gender }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.birthday">
            <span class="label">Birthday:</span>
            <span class="value">{{ memberProfile.birthday }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.finalTags?.ageCategory">
            <span class="label">Age Group:</span>
            <span class="value">{{ memberProfile.finalTags.ageCategory }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.finalTags?.isRegular">
            <span class="label">Regular:</span>
            <span class="value">Yes</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.finalTags?.isDgroupLeader">
            <span class="label">Dgroup Leader:</span>
            <span class="value">Yes</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.dgroupLeader">
            <span class="label">Dgroup Leader Name:</span>
            <span class="value">{{ memberProfile.dgroupLeader }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.finalTags?.isVolunteer">
            <span class="label">Volunteer:</span>
            <span class="value">Yes</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.finalTags?.volunteerMinistry?.length">
            <span class="label">Ministry:</span>
            <span class="value">{{ memberProfile.finalTags.volunteerMinistry.join(', ') }}</span>
          </div>
          <div class="profile-info-row" v-if="memberProfile?.address">
            <span class="label">Address:</span>
            <span class="value">{{ memberProfile.address }}</span>
          </div>
        </div>
        <button @click="handleLogout" class="logout-btn">
          <LogOut :size="18" />
          <span>Logout</span>
        </button>
      </div>
      <!-- Right: QR Code -->
      <div class="profile-qr">
        <div class="qr-card">
          <h2>Your Attendance QR Code</h2>
          <p class="subtitle">Show this code to the admin at check-in.</p>
          <div class="qr-code-wrapper">
            <QrcodeVue
              :value="qrCodeValue"
              :size="250"
            />
            <p class="member-id-text">Member ID: {{ memberProfile?.id || 'Loading...' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import QrcodeVue from 'vue-qrcode'
import { LogOut } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import MemberNavBar from '../components/MemberNavBar.vue'

const authStore = useAuthStore()
const router = useRouter()

// Get the specific member profile object (which contains the Q-ID)
const memberProfile = computed(() => authStore.userProfile);

// Use the short Q-ID for the QR code value
const qrCodeValue = computed(() => memberProfile.value?.id || authStore.user?.uid);
const displayName = computed(() => memberProfile.value
  ? `${memberProfile.value.firstName} ${memberProfile.value.lastName}`
  : authStore.user?.email);

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.member-profile-grid {
  display: flex;
  gap: 32px;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 16px 90px 16px;
  align-items: flex-start;
}
.profile-details {
  flex: 2;
  background: #fff;
  border-radius: 12px;
  padding: 28px 24px 24px 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.profile-header h1 {
  margin: 0;
  font-size: 28px;
  color: #0D47A1;
}
.subtitle {
  color: #546E7A;
  margin-top: 4px;
  margin-bottom: 12px;
  font-size: 15px;
}
.profile-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.profile-info-row {
  display: flex;
  gap: 10px;
  font-size: 15px;
}
.profile-info-row .label {
  color: #78909C;
  min-width: 120px;
  font-weight: 500;
}
.profile-info-row .value {
  color: #37474F;
  font-weight: 600;
  word-break: break-all;
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
  margin-top: 18px;
}

.profile-qr {
  flex: 1.2;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.qr-card {
  background: white;
  border-radius: 12px;
  padding: 30px 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  text-align: center;
  width: 100%;
  max-width: 340px;
}
.qr-card h2 {
  margin-top: 0;
  color: #333;
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

/* Responsive */
@media (max-width: 900px) {
  .member-profile-grid {
    flex-direction: column;
    gap: 24px;
    padding: 24px 8px 90px 8px;
  }
  .profile-qr {
    justify-content: flex-start;
  }
}
</style>
