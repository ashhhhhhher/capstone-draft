<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { User, Save, X, Lock, Mail, Phone, Facebook, Calendar, GraduationCap } from 'lucide-vue-next'

const authStore = useAuthStore()
const membersStore = useMembersStore()

const isEditing = ref(false)
const isLoading = ref(false)

// Separate Loading States for UI feedback
const emailLoading = ref(false)
const passwordLoading = ref(false)

// MOCK PASSWORD FOR FRONTEND VALIDATION
const MOCK_CORRECT_PASSWORD = 'password123'

// Data containers
const profileForm = ref({})

// 1. Separate Form for Email Update
const emailForm = reactive({
  email: '',
  confirmPassword: '' // Required to verify it's them
})

// 2. Separate Form for Password Update
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
})

// Initialize data from Store (Read-only for now)
onMounted(() => {
  if (authStore.user?.uid) {
    const data = authStore.userProfile || {}
    profileForm.value = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      school: data.school || '',
      fbAccount: data.fbAccount || '',
      birthday: data.birthday || '',
      gender: data.gender || 'Male',
      contactNumber: data.contactNumber || '',
      id: data.id 
    }
    
    // Pre-fill email
    emailForm.email = authStore.user.email
  }
})

function toggleEdit() {
  if (isEditing.value) {
    // Cancel action: Reset form to original data locally
    const data = authStore.userProfile || {}
    profileForm.value = { ...profileForm.value, ...data }
  }
  isEditing.value = !isEditing.value
}

// --- FRONTEND ONLY: SIMULATE SAVING PROFILE ---
function saveProfile() {
  isLoading.value = true
  
  // Simulate network request delay
  setTimeout(() => {
    // In a real app, this would be: await membersStore.updateMember({...})
    console.log("Saving Profile Data (Frontend Only):", profileForm.value)
    
    isLoading.value = false
    isEditing.value = false
    alert("Profile details updated successfully! ")
  }, 1000)
}

// --- FRONTEND ONLY: SIMULATE EMAIL UPDATE ---
function updateEmail() {
  if (emailForm.email === authStore.user.email) {
    return alert("Email hasn't changed.")
  }
  if (!emailForm.confirmPassword) {
    return alert("Please enter your password to confirm email change.")
  }

  // VALIDATION: Check against mock password
  if (emailForm.confirmPassword !== MOCK_CORRECT_PASSWORD) {
    return alert(`Incorrect password. Update unsuccessful.`)
  }

  emailLoading.value = true
  
  setTimeout(() => {
    // In real app: await authStore.updateEmail(emailForm.email, emailForm.confirmPassword)
    console.log("Updating Email to:", emailForm.email)
    
    emailLoading.value = false
    emailForm.confirmPassword = '' // Clear sensitive field
    alert(`Email verification sent to ${emailForm.email} `)
  }, 1500)
}

// --- FRONTEND ONLY: SIMULATE PASSWORD UPDATE ---
function updatePassword() {
  if (!passwordForm.newPassword || !passwordForm.confirmNewPassword) {
    return alert("Please fill in all password fields.")
  }
  if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
    return alert("New passwords do not match.")
  }
  if (!passwordForm.currentPassword) {
    return alert("Please enter your current password.")
  }

  // VALIDATION: Check against mock password
  if (passwordForm.currentPassword !== MOCK_CORRECT_PASSWORD) {
    return alert(`Incorrect current password.')`)
  }

  passwordLoading.value = true

  setTimeout(() => {
    // In real app: await authStore.updatePassword(passwordForm.currentPassword, passwordForm.newPassword)
    console.log("Updating Password...")
    
    passwordLoading.value = false
    // Reset fields
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmNewPassword = ''
    alert("Password changed successfully!")
  }, 1500)
}
</script>

<template>
  <div class="profile-page">
    
    <!-- Header -->
    <div class="page-header">
      <h1>My Profile</h1>
      <p>Manage your personal information and account security.</p>
    </div>

    <!-- 1. PERSONAL DETAILS CARD -->
    <div class="card">
      <div class="card-header-row">
        <h3>Personal Details</h3>
        <button v-if="!isEditing" @click="toggleEdit" class="btn-icon">
          Edit Details
        </button>
        <div v-else class="edit-actions">
          <button @click="toggleEdit" class="btn-text">Cancel</button>
          <button @click="saveProfile" class="btn-primary" :disabled="isLoading">
            <Save :size="16" /> {{ isLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>

      <div class="form-grid">
        <!-- Name (Read Only) -->
        <div class="form-group full">
          <label>Full Name</label>
          <div class="read-only-field">
            <User :size="16" />
            <span>{{ profileForm.firstName }} {{ profileForm.lastName }}</span>
          </div>
        </div>

        <!-- School -->
        <div class="form-group">
          <label>School / University</label>
          <div class="input-wrapper">
            <GraduationCap :size="16" class="field-icon" />
            <input 
              v-model="profileForm.school" 
              :disabled="!isEditing" 
              placeholder="Enter your school"
            />
          </div>
        </div>

        <!-- Facebook -->
        <div class="form-group">
          <label>Facebook Link / Name</label>
          <div class="input-wrapper">
            <Facebook :size="16" class="field-icon" />
            <input 
              v-model="profileForm.fbAccount" 
              :disabled="!isEditing" 
              placeholder="Facebook profile link"
            />
          </div>
        </div>

        <!-- Birthday -->
        <div class="form-group">
          <label>Birthday</label>
          <div class="input-wrapper">
            <Calendar :size="16" class="field-icon" />
            <input 
              type="date" 
              v-model="profileForm.birthday" 
              :disabled="!isEditing" 
            />
          </div>
        </div>

        <!-- Gender -->
        <div class="form-group">
          <label>Gender</label>
          <div class="input-wrapper">
            <User :size="16" class="field-icon" />
            <select v-model="profileForm.gender" :disabled="!isEditing">
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>

        <!-- Contact -->
        <div class="form-group full">
          <label>Contact Number</label>
          <div class="input-wrapper">
            <Phone :size="16" class="field-icon" />
            <input 
              v-model="profileForm.contactNumber" 
              :disabled="!isEditing" 
              placeholder="0912 345 6789"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Section Divider -->
    <h3 class="section-title">Security Settings</h3>

    <!-- 2. UPDATE EMAIL CARD -->
    <div class="card security-card">
      <div class="card-header-row">
        <h3>Change Email Address</h3>
      </div>
      <p class="subtitle">Update the email address you use to sign in.</p>

      <div class="form-grid security-grid">
        <div class="form-group full">
          <label>New Email Address</label>
          <div class="input-wrapper">
            <Mail :size="16" class="field-icon" />
            <input v-model="emailForm.email" placeholder="name@example.com" />
          </div>
        </div>

        <div class="form-group full">
          <label class="required">Current Password</label>
          <div class="input-wrapper highlight">
            <Lock :size="16" class="field-icon" />
            <input 
              type="password" 
              v-model="emailForm.confirmPassword" 
              placeholder="Required to confirm changes" 
            />
          </div>
        </div>
      </div>
      
      <div class="card-footer">
        <button @click="updateEmail" class="btn-secondary" :disabled="emailLoading">
          {{ emailLoading ? 'Updating...' : 'Update Email' }}
        </button>
      </div>
    </div>

    <!-- 3. UPDATE PASSWORD CARD -->
    <div class="card security-card">
      <div class="card-header-row">
        <h3>Change Password</h3>
      </div>
      <p class="subtitle">Choose a strong password to protect your account.</p>

      <div class="form-grid security-grid">
        <div class="form-group">
          <label>New Password</label>
          <div class="input-wrapper">
            <Lock :size="16" class="field-icon" />
            <input 
              type="password" 
              v-model="passwordForm.newPassword" 
              placeholder="New password" 
            />
          </div>
        </div>

        <div class="form-group">
          <label>Confirm New Password</label>
          <div class="input-wrapper">
            <Lock :size="16" class="field-icon" />
            <input 
              type="password" 
              v-model="passwordForm.confirmNewPassword" 
              placeholder="Retype new password" 
            />
          </div>
        </div>

        <div class="form-group full">
          <label class="required">Current Password</label>
          <div class="input-wrapper highlight">
            <Lock :size="16" class="field-icon" />
            <input 
              type="password" 
              v-model="passwordForm.currentPassword" 
              placeholder="Required to confirm changes" 
            />
          </div>
        </div>
      </div>

      <div class="card-footer">
        <button @click="updatePassword" class="btn-danger" :disabled="passwordLoading">
          {{ passwordLoading ? 'Updating...' : 'Update Password' }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.profile-page {
  padding-bottom: 40px;
}

.page-header {
  margin-bottom: 24px;
}
.page-header h1 { margin: 0; font-size: 24px; color: #263238; }
.page-header p { margin: 4px 0 0 0; color: #78909C; font-size: 14px; }

.section-title {
  margin: 32px 0 16px 0;
  font-size: 18px;
  color: #37474F;
  border-bottom: 1px solid #ECEFF1;
  padding-bottom: 8px;
  font-weight: 700;
}

/* Card Styles */
.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 24px;
  border: 1px solid #F5F7FA;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 1px solid #ECEFF1;
  padding-bottom: 12px;
}
.card h3 { margin: 0; font-size: 18px; color: #37474F; }

.subtitle { color: #90A4AE; font-size: 13px; margin-top: -10px; margin-bottom: 20px; }

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.security-grid {
  margin-bottom: 16px;
}
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: span 2; }

label { font-size: 12px; font-weight: 600; color: #546E7A; }
label.required::after { content: " *"; color: #D32F2F; }

.read-only-field {
  background: #F5F7FA;
  padding: 10px 12px;
  border-radius: 8px;
  color: #455A64;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-wrapper {
  position: relative;
}
.field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #90A4AE;
}
.input-wrapper input, .input-wrapper select {
  width: 100%;
  padding: 10px 10px 10px 38px; /* space for icon */
  border: 1px solid #CFD8DC;
  border-radius: 8px;
  font-size: 14px;
  color: #37474F;
  box-sizing: border-box;
}
.input-wrapper input:disabled, .input-wrapper select:disabled {
  background: #FAFAFA;
  color: #78909C;
  border-color: #EEE;
}
.input-wrapper.highlight input {
  border-color: #90A4AE;
  background: #FFFDE7;
}

/* Buttons */
.btn-icon {
  background: #E3F2FD;
  color: #1976D2;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.edit-actions { display: flex; gap: 10px; }
.btn-text { background: none; border: none; color: #78909C; font-weight: 600; cursor: pointer; }
.btn-primary {
  background: #1976D2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled { background: #B0BEC5; cursor: not-allowed; }

.btn-secondary {
  width: 100%;
  background: #ECEFF1;
  color: #37474F;
  border: 1px solid #CFD8DC;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}
.btn-secondary:hover { background: #CFD8DC; }

.btn-danger {
  width: 100%;
  background: #FFEBEE;
  color: #C62828;
  border: 1px solid #FFCDD2;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}
.btn-danger:hover { background: #FFCDD2; }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 480px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-group.full { grid-column: span 1; }
}
</style>