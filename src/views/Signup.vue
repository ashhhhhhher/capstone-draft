<script setup>
import { ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members' 
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const router = useRouter()

const { leaders } = storeToRefs(membersStore)

// Form data
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const selectedBranch = ref('baguio') 

// Personal Info (for Member role)
const firstName = ref('')
const lastName = ref('')
const birthday = ref('')
const gender = ref('')
const dgroupLeader = ref('')
const fbAccount = ref('')
const contactNumber = ref('')

const errorMessage = ref('')

// Computed check for Dgroup Leader validation
const isLeaderValid = computed(() => {
    const leaderName = dgroupLeader.value.trim();
    if (!leaderName) return true; // It's optional, so blank is valid

    const leadersList = leaders.value.map(l => `${l.firstName} ${l.lastName}`.toLowerCase());
    
    return leadersList.includes(leaderName.toLowerCase());
})

async function handleSignup() {
  errorMessage.value = ''
  
  // --- Validation ---
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match."
    return
  }
  if (!firstName.value || !lastName.value || !birthday.value || !gender.value) {
    errorMessage.value = "Please fill in all required personal information fields."
    return
  }
  if (!isLeaderValid.value) {
    errorMessage.value = "The Dgroup Leader name entered does not match a registered leader. Please check the spelling or leave the field blank."
    return
  }

  // --- Signup Logic ---
  try {
    let userData = {
      role: 'member', 
      branchId: selectedBranch.value,
      profile: {
        firstName: firstName.value,
        lastName: lastName.value,
        birthday: birthday.value,
        gender: gender.value,
        dgroupLeader: dgroupLeader.value.trim(),
        fbAccount: fbAccount.value.trim(),
        contactNumber: contactNumber.value.trim(),
      }
    }
    
    await authStore.signup(email.value, password.value, userData)

    router.push('/member-dashboard')

  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      errorMessage.value = 'This email is already in use.'
    } else if (error.code === 'auth/weak-password') {
      errorMessage.value = 'Password must be at least 6 characters.'
    } else {
      errorMessage.value = 'An unexpected error occurred.'
    }
    console.error(error)
  }
}
</script>

<template>
  <div class="signup-container">
    <div class="signup-box">
      <h2>Member Sign Up</h2>
      <p>Join Elevate Baguio. Your profile will be created automatically.</p>
      
      <form @submit.prevent="handleSignup" class="signup-form">
        
        <!-- Branch Selection (Locked to Baguio) -->
        <div class="form-group">
          <label for="branch">Branch</label>
          <select id="branch" v-model="selectedBranch" required disabled>
            <option value="baguio">Elevate Baguio</option>
          </select>
        </div>

        <!-- Personal Info -->
        <div class="personal-info">
          
          <div class="form-grid">
            <div class="form-group">
              <label for="firstName">First Name *</label>
              <input type="text" id="firstName" v-model="firstName" required>
            </div>
            <div class="form-group">
              <label for="lastName">Last Name *</label>
              <input type="text" id="lastName" v-model="lastName" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label for="birthday">Birthday *</label>
              <input type="date" id="birthday" v-model="birthday" required>
            </div>
            <div class="form-group">
              <label for="gender">Gender *</label>
              <select id="gender" v-model="gender" required>
                <option value="" disabled>Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          
          <!-- Optional Fields -->
          <div class="form-grid">
            <div class="form-group">
              <label for="dgroupLeader">Dgroup Leader </label>
              <input type="text" id="dgroupLeader" v-model="dgroupLeader" :class="{ 'input-error': dgroupLeader.length > 0 && !isLeaderValid }">
            </div>
            <div class="form-group">
              <label for="contactNumber">Contact Number </label>
              <input type="tel" id="contactNumber" v-model="contactNumber">
            </div>
          </div>
          <div class="form-group">
              <label for="fbAccount">Facebook Account </label>
              <input type="text" id="fbAccount" v-model="fbAccount">
          </div>
          
        </div>

        <!-- Account Info -->
        <div class="form-group">
          <label for="email">Email *</label>
          <input type="email" id="email" v-model="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password *</label>
          <input type="password" id="password" v-model="password" placeholder="At least 6 characters" required>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password *</label>
          <input type="password" id="confirmPassword" v-model="confirmPassword" required>
        </div>
        
        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>

        <button type="submit" class="signup-btn" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? 'Processing...' : 'Create Member Account' }}
        </button>
      </form>
      
      <p class="login-link">
        Already have an account? 
        <RouterLink to="/login">Login</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.signup-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  background-color: #f4f7f9;
  min-height: 100vh;
}
.signup-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  width: 90%;
  max-width: 500px;
  text-align: center;
}
h2 {
  margin-top: 0;
  color: #0D47A1;
}
p {
  color: #546E7A;
  margin-bottom: 24px;
}
.signup-form {
  text-align: left;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}
.form-group input, .form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #B0BEC5;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 16px;
}
.input-error {
  border-color: #D32F2F !important;
  box-shadow: 0 0 0 1px #D32F2F;
}
.radio-group {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.radio-label input {
  width: auto;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.personal-info hr {
  border: none;
  border-top: 1px solid #ECEFF1;
  margin: 16px 0 24px 0;
}
.signup-btn {
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
.signup-btn:disabled {
  background-color: #90A4AE;
}
.error-message {
  color: #D32F2F;
  background-color: #FFEBEE;
  border: 1px solid #FFCDD2;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.login-link {
  margin-top: 24px;
  font-size: 14px;
}
</style>