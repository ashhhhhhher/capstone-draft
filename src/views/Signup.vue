<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAuth, sendEmailVerification, signOut } from "firebase/auth"
import { Eye, EyeOff } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const auth = getAuth()

// --- State Management ---
const errorMessage = ref('')
const isSuccess = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// --- Form Data ---
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const selectedBranch = ref('baguio') 

// Personal Info
const firstName = ref('')
const lastName = ref('')
const birthday = ref('')
const gender = ref('')

async function handleSignup() {
  errorMessage.value = ''
  
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match."
    return
  }
  
  if (!firstName.value || !lastName.value || !birthday.value || !gender.value || !email.value) {
    errorMessage.value = "Please fill in all required fields."
    return
  }

  try {
    let userData = {
      role: 'member', 
      branchId: selectedBranch.value,
      profile: {
        firstName: firstName.value,
        lastName: lastName.value,
        birthday: birthday.value,
        gender: gender.value
      }
    }
    
    // 1. Create account (this automatically signs them in)
    await authStore.signup(email.value, password.value, userData)
    
    // 2. Send Verification Email (Native Firebase)
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser)
    }

    // 3. Sign out immediately so they can't access dashboard yet
    await signOut(auth)

    // 4. Show Success State
    isSuccess.value = true

  } catch (error) {
    console.error("Signup Error:", error)
    if (error.code === 'auth/email-already-in-use') {
      errorMessage.value = 'This email is already in use.'
    } else if (error.code === 'auth/weak-password') {
      // Handles password policy enforcement errors
      errorMessage.value = 'Password is too weak. ' + (error.message.includes('characters') ? 'It must be at least 6 characters.' : error.message)
    } else if (error.message) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'An unexpected error occurred during signup.'
    }
  }
}
</script>

<template>
  <div class="signup-container">
    <div class="signup-box">
      
      <!-- Success / Verify Email Screen -->
      <div v-if="isSuccess" class="success-content">
        <div class="icon-circle">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>
        <h2>Verify your email</h2>
        <p>
          We've sent a verification link to <strong>{{ email }}</strong>.<br>
          Please check your inbox (and spam folder) and click the link to activate your account.
        </p>
        <p class="sub-text">Once verified, you can log in.</p>
        
        <RouterLink to="/login" class="login-btn-link">
          Go to Login
        </RouterLink>
      </div>

      <!-- Signup Form -->
      <div v-else>
        <h2>Member Sign Up</h2>
        <p>Join Elevate Baguio. Create your account.</p>

        <form @submit.prevent="handleSignup" class="signup-form">
          <div class="form-group">
            <label for="branch">Branch</label>
            <select id="branch" v-model="selectedBranch" required disabled>
              <option value="baguio">Elevate Baguio</option>
            </select>
          </div>

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
          </div>
          <hr />
          <div class="form-group">
            <label for="email">Email *</label>
            <input type="email" id="email" v-model="email" required>
          </div>
          
          <div class="form-group">
            <label for="password">Password *</label>
            <div class="password-wrapper">
              <input 
                :type="showPassword ? 'text' : 'password'" 
                id="password" 
                v-model="password" 
                placeholder="At least 6 characters" 
                required
              >
              <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password *</label>
            <div class="password-wrapper">
              <input 
                :type="showConfirmPassword ? 'text' : 'password'" 
                id="confirmPassword" 
                v-model="confirmPassword" 
                required
              >
              <button type="button" class="eye-btn" @click="showConfirmPassword = !showConfirmPassword">
                <EyeOff v-if="showConfirmPassword" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>
          </div>

          <div v-if="errorMessage" class="message-box error">
            {{ errorMessage }}
          </div>

          <button type="submit" class="signup-btn" :disabled="authStore.isLoading">
            {{ authStore.isLoading ? 'Creating Account...' : 'Sign Up' }}
          </button>
        </form>
        <p class="login-link">Already have an account? <RouterLink to="/login">Login</RouterLink></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signup-container { display: flex; align-items: center; justify-content: center; padding: 60px 0; background-color: #f4f7f9; min-height: 100vh; position: relative; }
.signup-box { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 90%; max-width: 500px; text-align: center; }
h2 { margin-top: 0; color: #0D47A1; }
p { color: #546E7A; margin-bottom: 24px; }
.signup-form { text-align: left; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
.form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #B0BEC5; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
hr { border: none; border-top: 1px solid #ECEFF1; margin: 16px 0 24px 0; }
.signup-btn { width: 100%; padding: 14px; margin-top: 16px; background-color: #1976D2; color: white; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; }
.signup-btn:disabled { background-color: #90A4AE; }
.login-link { margin-top: 24px; font-size: 14px; }

/* Password Eye Icon */
.password-wrapper { position: relative; display: flex; align-items: center; }
.password-wrapper input { padding-right: 40px; }
.eye-btn { position: absolute; right: 12px; background: none; border: none; cursor: pointer; color: #78909C; display: flex; align-items: center; padding: 0; }
.eye-btn:hover { color: #37474F; }

/* Error/Success Messages */
.message-box { padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; text-align: center; }
.message-box.error { color: #D32F2F; background-color: #FFEBEE; border: 1px solid #FFCDD2; }

/* Success Screen */
.success-content { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px 0; }
.icon-circle { width: 80px; height: 80px; background: #E8F5E9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2E7D32; margin-bottom: 10px; }
.sub-text { font-size: 14px; color: #78909C; margin-top: -10px; }
.login-btn-link { display: inline-block; background-color: #1976D2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; transition: background 0.2s; }
.login-btn-link:hover { background-color: #1565C0; }
</style>