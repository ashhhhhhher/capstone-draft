profile.vue

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { LogOut, Camera, Save, Lock, Mail } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

// --- Store Setup ---
const authStore = useAuthStore()

// --- Form States ---
const profileMessage = ref({ type: '', text: '' })
const passwordMessage = ref({ type: '', text: '' })

// Profile Form
const displayName = ref('')
const email = ref('')
const profileConfirmPassword = ref('')

// Password Form
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// --- Load Initial Data ---
onMounted(() => {
  if (authStore.user) {
    displayName.value = authStore.user.displayName || ''
    email.value = authStore.user.email || ''
  }
})

const initial = computed(() => {
  const name = displayName.value || authStore.user?.displayName || ''
  return name ? name.charAt(0).toUpperCase() : 'U'
})

// --- Functions ---
async function handleUpdateProfile() {
  profileMessage.value = { type: '', text: '' }
  if (!profileConfirmPassword.value) {
    profileMessage.value = { type: 'error', text: 'Please enter your password to confirm changes.' }
    return
  }
  
  try {
    await authStore.updateAdminProfile(
      profileConfirmPassword.value,
      displayName.value,
      email.value
    )
    profileMessage.value = { type: 'success', text: 'Profile updated successfully!' }
  } catch (error) {
    profileMessage.value = { type: 'error', text: 'Failed to update profile. Is your password correct?' }
    console.error(error)
  } finally {
    profileConfirmPassword.value = '' 
  }
}

async function handleChangePassword() {
  passwordMessage.value = { type: '', text: '' }

  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = { type: 'error', text: 'New passwords do not match.' }
    return
  }
  if (newPassword.value.length < 6) {
    passwordMessage.value = { type: 'error', text: 'New password must be at least 6 characters.' }
    return
  }
  
  try {
    await authStore.updateAdminPassword(
      currentPassword.value,
      newPassword.value
    )
    
    passwordMessage.value = { type: 'success', text: 'Password updated successfully!' }
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''

  } catch (error) {
    console.error("Error changing password:", error)
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      passwordMessage.value = { type: 'error', text: 'Current password is incorrect.' }
    } else {
      passwordMessage.value = { type: 'error', text: 'An error occurred. Please try again.' }
    }
  }
}

const router = useRouter()

async function handleLogout() {
  await authStore.logout()
  // After logout, redirect to the login page
  router.push('/login')
}
</script>

<template>
  <div class="profile-view">

    <!-- Header Card -->
    <header class="profile-header-card">
      <div class="avatar-section">
        <div class="info-section">
          <h2 class="user-name">{{ displayName || authStore.user?.displayName || 'Admin' }}</h2>
          <div class="meta-badges">
            <span class="badge">DGM</span>
            <span class="badge">{{ email }}</span>
          </div>
        </div>
      </div>
      <div style="position:absolute; top:18px; right:18px;">
        <button @click="handleLogout" class="logout-btn">
          <LogOut :size="16" />
        </button>
      </div>
    </header>

    <!-- Edit Details -->
    <div class="form-card">
      <div class="form-row">
        <div class="input-group full">
          <label>Display Name</label>
          <div class="input-wrapper">
            <input v-model="displayName" placeholder="Full name" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="input-group full">
          <label>Email Address</label>
          <div class="input-wrapper">
            <Mail :size="18" class="icon" />
            <input v-model="email" type="email" />
          </div>
        </div>
      </div>

      <hr class="divider">

      <div class="form-row">
        <div class="input-group full">
          <label>Confirm with Current Password</label>
          <div class="input-wrapper">
            <input type="password" v-model="profileConfirmPassword" placeholder="Current password" />
          </div>
        </div>
      </div>

      <div v-if="profileMessage.text" class="message-box" :class="profileMessage.type === 'success' ? 'is-success' : 'is-error'">{{ profileMessage.text }}</div>

      <div class="action-footer">
        <button class="save-btn" @click="handleUpdateProfile">
          <Save :size="16" />
          <span>Save Profile</span>
        </button>
      </div>
    </div>

    <!-- Security / Password -->
    <div class="form-card security">
      <h3>Change Password</h3>
      <div class="form-row">
        <div class="input-group full">
          <label>Current Password</label>
          <div class="input-wrapper">
            <Lock :size="18" class="icon" />
            <input type="password" v-model="currentPassword" placeholder="Current password" />
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="input-group">
          <label>New Password</label>
          <input type="password" v-model="newPassword" placeholder="New password" />
        </div>
        <div class="input-group">
          <label>Confirm</label>
          <input type="password" v-model="confirmPassword" placeholder="Retype new password" />
        </div>
      </div>

      <div v-if="passwordMessage.text" class="message-box" :class="passwordMessage.type === 'success' ? 'is-success' : 'is-error'">{{ passwordMessage.text }}</div>

      <div class="action-footer">
        <button class="save-btn outline" @click="handleChangePassword">
          Update Password
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}

/* HEADER CARD */
.profile-header-card {
  background: white;
  border-radius: 16px;
  padding: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.avatar-section { display:flex; align-items:center; gap:16px }
.avatar-container {
  position: relative;
  width: 88px;
  height: 88px;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #E3F2FD;
  color: #1565C0;
  font-size: 36px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
}

.user-name { margin: 0; font-size: 20px; color: #333 }
.meta-badges { display:flex; gap:8px; margin-top:6px; }
.badge { background:#F5F5F5; color:#616161; font-size:12px; padding:4px 10px; border-radius:12px; font-weight:600 }

.logout-btn { background:#ECEFF1; border:none; padding:8px; border-radius:8px; cursor:pointer }

/* FORM CARDS */
.form-card { background:white; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04) }
.form-card.security h3 { margin-top:0; margin-bottom:12px; font-size:16px; color:#D32F2F }

.form-row { display:flex; gap:16px; margin-bottom:12px }
.input-group { flex:1 }
.input-group.full { width:100% }
label { display:block; font-size:12px; font-weight:600; color:#546E7A; margin-bottom:6px }

.input-wrapper { display:flex; align-items:center; position:relative }
.icon {margin-left:12px; margin-right: 12px; color:#90A4AE }
input { width:100%; padding:12px 12px 12px 12px; border:1px solid #CFD8DC; border-radius:8px; font-size:14px; box-sizing:border-box; flex: 1; }
input:focus { border-color:#1976D2; outline:none }

.divider { border:none; border-top:1px solid #ECEFF1; margin:12px 0 }

.message-box { padding:12px; border-radius:8px; font-weight:500; text-align:center; margin-top:12px; font-size:14px }
.message-box.is-success { background-color:#E8F5E9; color:#2E7D32 }
.message-box.is-error { background-color:#FFEBEE; color:#C62828 }

.action-footer { margin-top:16px; display:flex; justify-content:flex-end }
.save-btn { background:#1976D2; color:white; border:none; padding:10px 18px; border-radius:8px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer }
.save-btn.outline { background:white; border:1px solid #D32F2F; color:#D32F2F }

@media (max-width:600px) { .form-row { flex-direction:column } .profile-header-card { padding:18px } }
</style>