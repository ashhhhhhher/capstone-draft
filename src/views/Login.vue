<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = '' // Clear any old errors
  try {
    await authStore.login(email.value, password.value)
    // On success, go to the homepage
    router.push('/')
  } catch (error) {
    // On failure, show an error
    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage.value = 'Invalid email address.'
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage.value = 'Incorrect email or password.'
        break;
      default:
        errorMessage.value = 'An unexpected error occurred. Please try again.'
    }
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <h2>Admin Login</h2>
      <p>Please sign in to manage your dashboard.</p>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="password" required>
        </div>
        
        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>

        <button type="submit" class="login-btn">
          {{ authStore.isLoading ? 'Loading...' : 'Login' }}
        </button>
      </form>
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
.login-btn:hover {
  background-color: #1565C0;
}
.error-message {
  color: #D32F2F;
  background-color: #FFEBEE;
  border: 1px solid #FFCDD2;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>