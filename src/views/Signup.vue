<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import emailjs from '@emailjs/browser'

const authStore = useAuthStore()
const router = useRouter()

// --- YOUR EMAILJS CREDENTIALS ---
const EMAILJS_SERVICE_ID = "service_wfpraos";   
const EMAILJS_TEMPLATE_ID = "template_2jzbcff"; 
const EMAILJS_PUBLIC_KEY = "qL--G6n60cgb4-HXX";   

// --- State Management ---
const step = ref(1) 
const generatedOTP = ref('')
const inputOTP = ref('')
const errorMessage = ref('')
const isResending = ref(false)
const isSendingEmail = ref(false) 
const showWelcome = ref(false) // For Blue Screen Transition

// --- Form Data (Simplified) ---
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const selectedBranch = ref('baguio') 

// Reduced Personal Info
const firstName = ref('')
const lastName = ref('')
const birthday = ref('')
const gender = ref('')

// --- Validation ---
async function handleInitialSubmit() {
  errorMessage.value = ''
  
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match."
    return
  }
  if (!firstName.value || !lastName.value || !birthday.value || !gender.value || !email.value) {
    errorMessage.value = "Please fill in all required fields."
    return
  }

  await generateAndSendOTP();
}

async function generateAndSendOTP() {
  isSendingEmail.value = true;
  errorMessage.value = '';

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  generatedOTP.value = code;

  const templateParams = {
    name: firstName.value,             
    time: new Date().toLocaleString(), 
    otp_code: code,                    
    to_email: email.value              
  };

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    alert(`Verification code sent to ${email.value}`);
    step.value = 2;
    isResending.value = false;

  } catch (error) {
    console.error('EmailJS Error:', error);
    errorMessage.value = "Failed to send email. Please check your internet connection.";
  } finally {
    isSendingEmail.value = false;
  }
}

async function resendOTP() {
  isResending.value = true;
  await generateAndSendOTP();
}

async function verifyAndSignup() {
  errorMessage.value = '';

  if (inputOTP.value !== generatedOTP.value) {
    errorMessage.value = "Invalid verification code. Please try again.";
    return;
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
    
    // Create account
    await authStore.signup(email.value, password.value, userData)
    
    // Show Welcome Screen
    showWelcome.value = true;
    
    // Delay routing to let the animation play
    setTimeout(() => {
        router.push({ name: 'memberHome' }) 
    }, 2500)

  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      errorMessage.value = 'This email is already in use.'
      step.value = 1; 
    } else if (error.code === 'auth/weak-password') {
      errorMessage.value = 'Password must be at least 6 characters.'
      step.value = 1; 
    } else {
      errorMessage.value = 'An unexpected error occurred: ' + error.message;
    }
  }
}
</script>

<template>
  <div class="signup-container">
    
    <!-- Welcome Transition Overlay -->
    <transition name="fade">
      <div v-if="showWelcome" class="welcome-overlay">
        <div class="welcome-content">
          <img src="/ccf logo.png" alt="CCF Logo" class="welcome-logo" />
          <h1>Welcome, {{ firstName }}!</h1>
          <p>Getting your dashboard ready...</p>
          <div class="spinner"></div>
        </div>
      </div>
    </transition>

    <div class="signup-box">
      <h2>{{ step === 1 ? 'Member Sign Up' : 'Verify Email' }}</h2>
      <p v-if="step === 1">Join Elevate Baguio. Your profile will be created automatically.</p>
      <p v-else>We sent a 6-digit code to <strong>{{ email }}</strong>.</p>

      <form v-if="step === 1" @submit.prevent="handleInitialSubmit" class="signup-form">
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
          <input type="password" id="password" v-model="password" placeholder="At least 6 characters" required>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password *</label>
          <input type="password" id="confirmPassword" v-model="confirmPassword" required>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        <button type="submit" class="signup-btn" :disabled="isSendingEmail">
          {{ isSendingEmail ? 'Sending Code...' : 'Next: Verify Email' }}
        </button>
      </form>

      <form v-else @submit.prevent="verifyAndSignup" class="signup-form">
        <div class="otp-container">
          <label for="otp">Enter Verification Code</label>
          <input type="text" id="otp" v-model="inputOTP" placeholder="000000" maxlength="6" class="otp-input" required>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        <button type="submit" class="signup-btn" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? 'Creating Account...' : 'Verify & Create Account' }}
        </button>
        <div class="otp-actions">
          <button type="button" class="text-btn" @click="resendOTP" :disabled="isResending || isSendingEmail">
             {{ isResending ? 'Sending...' : 'Resend Code' }}
          </button>
          <button type="button" class="text-btn cancel" @click="step = 1">Change Email</button>
        </div>
      </form>
      <p v-if="step === 1" class="login-link">Already have an account? <RouterLink to="/login">Login</RouterLink></p>
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
.error-message { color: #D32F2F; background-color: #FFEBEE; border: 1px solid #FFCDD2; padding: 10px; border-radius: 8px; margin-bottom: 20px; }
.login-link { margin-top: 24px; font-size: 14px; }
.otp-container { margin-bottom: 24px; text-align: center; }
.otp-input { text-align: center; font-size: 24px !important; letter-spacing: 8px; font-weight: bold; color: #0D47A1; }
.otp-actions { display: flex; justify-content: space-between; margin-top: 20px; }
.text-btn { background: none; border: none; color: #1976D2; font-size: 14px; cursor: pointer; text-decoration: underline; }
.text-btn.cancel { color: #78909C; }

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