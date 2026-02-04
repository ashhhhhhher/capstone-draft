<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAuth, sendEmailVerification, signOut } from "firebase/auth"
import { Eye, EyeOff } from 'lucide-vue-next'
import Modal from '../components/dgmComponents/Modal.vue'

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

// Terms & Privacy state
const agreed = ref(false)
const showTermsModal = ref(false)
const showPrivacyModal = ref(false)
const tcError = ref('')

// Personal Info
const firstName = ref('')
const lastName = ref('')
const birthday = ref('')
const gender = ref('')

async function handleSignup() {
  errorMessage.value = ''
  tcError.value = ''
  
  if (!agreed.value) {
    tcError.value = 'You must agree to the Terms and Conditions and Privacy Policy.'
    return
  }

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

function clearTcError() {
  if (tcError.value) tcError.value = ''
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
                    <!-- Terms & Privacy Agreement (small text like login line) -->
          <div class="form-group agree-block" style="margin-top:12px; text-align:left;">
            <div class="agree-row">
              <input type="checkbox" id="agreeTc" v-model="agreed" @change="clearTcError" />
              <label for="agreeTc" class="agree-label">I agree to the <a href="#" @click.prevent="showTermsModal = true">Terms and Conditions</a> and <a href="#" @click.prevent="showPrivacyModal = true">Privacy Policy</a></label>
            </div>
            <div v-if="tcError" class="message-box error" style="margin-top:10px;">{{ tcError }}</div>
          </div>

          <button type="submit" class="signup-btn" :disabled="authStore.isLoading || !agreed">
            {{ authStore.isLoading ? 'Creating Account...' : 'Sign Up' }}
          </button>
        </form>
        <p class="login-link">Already have an account? <RouterLink to="/login">Login</RouterLink></p>
        
        <!-- Terms Modal -->
        <Modal v-if="showTermsModal" @close="showTermsModal = false" size="xl">
          <div style="padding:8px 4px;">
            <h3>Terms and Conditions</h3>
            <div style="margin-top:8px; color:#546E7A; text-align:left;">
              <p><strong>Qonnect</strong></p>
              <p><em>Last Updated: February 04, 2026</em></p>
              <p>These Terms and Conditions govern the use of the Qonnect application. By creating an account or using the app, you agree to comply with these terms.</p>

              <h4>1. Acceptance of Terms</h4>
              <p>By accessing or using Qonnect, you confirm that you have read, understood, and agreed to these Terms and Conditions. If you do not agree, you should not use the application.</p>

              <h4>2. Eligibility</h4>
              <p>Users must provide accurate and complete information during registration. The application is intended for users participating in supported events.</p>

              <h4>3. User Responsibilities</h4>
              <p>Users agree to:</p>
              <ul>
                <li>Provide truthful and accurate information</li>
                <li>Use the application only for its intended purpose</li>
                <li>Avoid misuse, unauthorized access, or disruption of the system</li>
              </ul>
              <p>Any misuse of the application may result in suspension or termination of access.</p>

              <h4>4. Use of the Application</h4>
              <p>Qonnect is provided on an “as is” and “as available” basis. While efforts are made to ensure reliability, uninterrupted access and error-free operation are not guaranteed.</p>

              <h4>5. Account Suspension or Termination</h4>
              <p>The project team reserves the right to suspend or terminate user accounts that violate these Terms or misuse the application.</p>

              <h4>6. Limitation of Liability</h4>
              <p>As an academic project, Qonnect and its developers are not liable for any direct or indirect damages resulting from the use or inability to use the application.</p>

              <h4>7. Modifications to the Terms</h4>
              <p>These Terms and Conditions may be updated at any time. Continued use of the application after changes have been made indicates acceptance of the revised terms.</p>

              <h4>8. Governing Principles</h4>
              <p>These Terms are intended to align with applicable laws and regulations, including relevant data privacy standards in the Philippines.</p>

              <h4>9. Contact Information</h4>
              <p>For questions regarding these Terms and Conditions, please contact:</p>
              <p><strong>Qonnect Project Team</strong><br>Email: qonnect@gmail.com</p>
            </div>
          </div>
        </Modal>

        <!-- Privacy Modal -->
        <Modal v-if="showPrivacyModal" @close="showPrivacyModal = false" size="xl">
          <div style="padding:8px 4px;">
            <h3>Privacy Policy</h3>
            <div style="margin-top:8px; color:#546E7A; text-align:left;">
              <p><strong>Qonnect</strong></p>
              <p><em>Last Updated: February 04, 2026</em></p>
              <p>Qonnect values your privacy and is committed to protecting your personal information. This Privacy Policy explains how information is collected, used, stored, and protected when you use the Qonnect application.</p>

              <p>Qonnect is an academic project developed for educational purposes and is used to support event coordination and attendance tracking.</p>

              <h4>1. Information We Collect</h4>
              <p>When you create an account and use the application, we may collect the following information:</p>
              <h5>a. Account Information</h5>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Birthdate</li>
                <li>Gender</li>
                <li>Password (stored securely in encrypted form)</li>
              </ul>
              <h5>b. Usage and Event Information</h5>
              <ul>
                <li>Event attendance records</li>
                <li>Event details such as venue, date, and time</li>
                <li>App usage data related to event participation</li>
              </ul>

              <h4>2. Purpose of Data Collection</h4>
              <p>The information collected is used solely for the following purposes:</p>
              <ul>
                <li>Creating and managing user accounts</li>
                <li>Identifying participants for events</li>
                <li>Tracking event attendance</li>
                <li>Supporting event coordination and reporting</li>
                <li>Improving application functionality</li>
              </ul>
              <p>Personal data is not collected for commercial or marketing purposes.</p>

              <h4>3. Data Storage and Security</h4>
              <p>Reasonable technical and organizational measures are implemented to protect personal information against unauthorized access, alteration, disclosure, or destruction. Access to data is limited to authorized individuals involved in the operation of the application.</p>

              <h4>4. Data Sharing and Disclosure</h4>
              <p>Personal information collected through Qonnect is:</p>
              <ul>
                <li>Shared only with authorized event organizers for legitimate event-related purposes</li>
                <li>Not sold, rented, or shared with third parties for commercial use</li>
              </ul>

              <h4>5. Data Retention</h4>
              <p>Personal information is retained only for as long as necessary to fulfill the purposes outlined in this policy or to meet academic and operational requirements. Users may request deletion of their data when it is no longer required.</p>

              <h4>6. User Rights</h4>
              <p>Users have the right to:</p>
              <ul>
                <li>Access their personal data</li>
                <li>Request corrections to inaccurate information</li>
                <li>Request deletion of their personal data, subject to reasonable limitations</li>
              </ul>
              <p>Requests may be made using the contact details provided below.</p>

              <h4>7. Changes to This Privacy Policy</h4>
              <p>This Privacy Policy may be updated from time to time. Any changes will be reflected within the application, and continued use of the app constitutes acceptance of the updated policy.</p>

              <h4>8. Contact Information</h4>
              <p>For questions or concerns regarding this Privacy Policy or personal data, please contact:</p>
              <p><strong>Qonnect Project Team</strong><br>Email: qonnect@gmail.com</p>
            </div>
          </div>
        </Modal>
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

/* Agreement row styling */
.agree-row { display: flex; align-items: center; gap: 8px; }
.agree-row .agree-label { line-height: 1.2; font-size: 14px; color: #546E7A; margin: 0; }
.agree-row input[type="checkbox"] { width: 18px; height: 18px; margin: 0; }

/* Spacing tweaks between agree, button, and login link */
.agree-block { margin-bottom: 6px; }
.agree-block + button.signup-btn { margin-top: 8px; }
.login-link { margin-top: 12px; }

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