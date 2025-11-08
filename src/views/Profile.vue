

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { LogOut } from 'lucide-vue-next'
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
    profileConfirmPassword.value = '' // Always clear password field
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
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-text">
        <h1>Profile & Settings</h1>
        <p>Manage your admin account details.</p>
      </div>
      <button @click="handleLogout" class="logout-btn">
        <LogOut :size="18" />
        <span>Logout</span>
      </button>
    </div>

    <div class="settings-grid">
      
      <!-- Edit Profile Card -->
      <div class="profile-card">
        <h3>Edit Profile</h3>
        <p class="subtitle">Update your username and login email.</p>
        <form @submit.prevent="handleUpdateProfile">
          <div class="form-group">
            <label for="display-name">Username (Display Name)</label>
            <input type="text" id="display-name" v-model="displayName">
          </div>
          <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" v-model="email" required>
          </div>
          
          <hr class="divider">
          
          <div class="form-group">
            <label for="profile-confirm-password">Enter Current Password to Save</label>
            <input type="password" id="profile-confirm-password" v-model="profileConfirmPassword" required>
          </div>
          
          <div v-if="profileMessage.text" 
               class="message-box" 
               :class="profileMessage.type === 'success' ? 'is-success' : 'is-error'">
            {{ profileMessage.text }}
          </div>
          
          <button type="submit" class="submit-btn">Save Profile</button>
        </form>
      </div>

      <!-- Change Password Card -->
      <div class="profile-card">
        <h3>Change Admin Password</h3>
        <p class="subtitle">Update your account password.</p>
        <form @submit.prevent="handleChangePassword" class="password-form">
          <div class="form-group">
            <label for="current-password">Current Password</label>
            <input type="password" id="current-password" v-model="currentPassword" required>
          </div>
          <div class="form-group">
            <label for="new-password">New Password</label>
            <input type="password" id="new-password" v-model="newPassword" required>
          </div>
          <div class="form-group">
            <label for="confirm-password">Confirm New Password</label>
            <input type="password" id="confirm-password" v-model="confirmPassword" required>
          </div>
          
          <div v-if="passwordMessage.text" 
               class="message-box" 
               :class="passwordMessage.type === 'success' ? 'is-success' : 'is-error'">
            {{ passwordMessage.text }}
          </div>
          
          <button type="submit" class="submit-btn">Update Password</button>
        </form>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  padding: 20px;
}
.profile-header {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}


.profile-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}
.profile-header p {
  font-size: 16px;
  color: #546E7A;
  margin-top: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
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

.logout-btn:hover {
  background-color: #CFD8DC;
}

@media (min-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr 1fr;
    align-items: flex-start;
  }
}

.profile-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.profile-card h3 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 600;
}
.subtitle {
  font-size: 14px;
  color: #546E7A;
  margin-top: 0;
  margin-bottom: 20px;
}
.divider {
  border: none;
  border-top: 1px solid #ECEFF1;
  margin: 20px 0;
}

/* --- Password Form --- */
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: #333;
}
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #B0BEC5;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 14px;
}
.message-box {
  padding: 12px;
  border-radius: 8px;
  font-weight: 500;
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
}
.message-box.is-success {
  background-color: #E8F5E9;
  color: #2E7D32;
}
.message-box.is-error {
  background-color: #FFEBEE;
  color: #C62828;
}
.submit-btn {
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