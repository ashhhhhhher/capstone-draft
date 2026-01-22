<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router' 
import { useAuthStore } from '../stores/auth'
import { getAuth, sendPasswordResetEmail } from "firebase/auth"
import { Eye, EyeOff } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const auth = getAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const showWelcome = ref(false)
const showPassword = ref(false)
const isLoadingReset = ref(false)

async function handleLogin() {
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await authStore.login(email.value, password.value)
    
    // Trigger Welcome Screen
    showWelcome.value = true;

    // Delay routing for 2.5s
    setTimeout(() => {
      if (authStore.userRole === 'admin') {
        router.push('/')
      } else {
        router.push('/member/home') 
      }
    }, 2500)

  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage.value = 'Incorrect email or password.'
        break;
      case 'auth/too-many-requests':
        errorMessage.value = 'Too many failed attempts. Please try again later.'
        break;
      default:
        errorMessage.value = 'An unexpected error occurred. Please try again.'
    }
  }
}

async function handleForgotPassword() {
  if (!email.value) {
    errorMessage.value = "Please enter your email address first."
    return
  }
  
  isLoadingReset.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Explicitly define the redirect URL to ensure a valid link is generated
    const actionCodeSettings = {
      url: window.location.origin + '/login', 
      handleCodeInApp: false
    }
    
    await sendPasswordResetEmail(auth, email.value, actionCodeSettings)
    successMessage.value = "Password reset link sent! Check your email."
  } catch (error) {
    console.error(error)
    if (error.code === 'auth/user-not-found') {
      errorMessage.value = "No account found with this email."
    } else if (error.code === 'auth/invalid-email') {
      errorMessage.value = "Please enter a valid email address."
    } else if (error.code === 'auth/unauthorized-continue-uri') {
      errorMessage.value = "Domain not authorized in Firebase Console."
    } else {
      errorMessage.value = "Failed to send reset email. Try again later."
    }
  } finally {
    isLoadingReset.value = false
  }
}
</script>

<template>
  <div class="login-container">
    
    <!-- Welcome Transition Overlay -->
    <transition name="fade">
      <div v-if="showWelcome" class="welcome-overlay">
        <div class="welcome-content">
          <img src="/ccf logo.png" alt="CCF Logo" class="welcome-logo" />
          <h1>Welcome, {{ authStore.user?.displayName?.split(' ')[0] || 'Member' }}!</h1>
          <p>Signing you in...</p>
          <div class="spinner"></div>
        </div>
      </div>
    </transition>

    <div class="login-box">
      <h2>Login</h2>
      <p>Please sign in to continue.</p>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="email" required placeholder="Enter your email">
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <div class="password-wrapper">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              id="password" 
              v-model="password" 
              required
              placeholder="Enter your password"
            >
            <button type="button" class="eye-btn" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="20" />
              <Eye v-else :size="20" />
            </button>
          </div>
          <div class="forgot-link-wrapper">
            <button type="button" class="forgot-btn" @click="handleForgotPassword" :disabled="isLoadingReset">
              {{ isLoadingReset ? 'Sending...' : 'Forgot Password?' }}
            </button>
          </div>
        </div>
        
        <div v-if="errorMessage" class="message-box error">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="message-box success">
          {{ successMessage }}
        </div>

        <button type="submit" class="login-btn" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? 'Loading...' : 'Login' }}
        </button>
      </form>
      
      <!--  Sign Up Link -->
      <p class="signup-link">
        Don't have an account? 
        <RouterLink to="/signup">Sign Up</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f4f7f9;
}
.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  width: 90%;
  max-width: 400px;
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
.login-form {
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
.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #B0BEC5;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 16px;
}

/* Password Input Wrapper */
.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrapper input {
  padding-right: 40px; /* Space for eye icon */
}
.eye-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #78909C;
  display: flex;
  align-items: center;
  padding: 0;
}
.eye-btn:hover {
  color: #37474F;
}

/* Forgot Password Link */
.forgot-link-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
.forgot-btn {
  background: none;
  border: none;
  color: #1976D2;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  font-weight: 500;
}
.forgot-btn:hover {
  text-decoration: underline;
}
.forgot-btn:disabled {
  color: #B0BEC5;
  cursor: not-allowed;
  text-decoration: none;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.login-btn:disabled {
  background-color: #90A4AE;
}

.message-box {
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  text-align: center;
}
.message-box.error {
  color: #D32F2F;
  background-color: #FFEBEE;
  border: 1px solid #FFCDD2;
}
.message-box.success {
  color: #2E7D32;
  background-color: #E8F5E9;
  border: 1px solid #A5D6A7;
}

.signup-link {
  margin-top: 24px;
  font-size: 14px;
}

/* Welcome Overlay Styles */
.welcome-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #1976D2; /* Brand Blue */
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.welcome-logo {
  width: 100px;
  height: auto;
  margin-bottom: 16px;
  background: white;
  border-radius: 50%;
  padding: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.welcome-content h1 {
  font-size: 32px;
  margin: 0;
  font-weight: 700;
}

.welcome-content p {
  color: rgba(255,255,255,0.8);
  font-size: 16px;
  margin: 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-top: 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>