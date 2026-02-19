<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { watch, ref } from 'vue'
import AboutUsOverlay from '../components/dgmComponents/AboutUs.vue'

const authStore = useAuthStore()
const router = useRouter()
const showAbout = ref(false)

function logout() { authStore.logout(); router.push({ name: 'login' }) }

watch(() => authStore.userRole, (newRole) => {
  if (newRole === 'member') router.push({ name: 'memberHome' })
})
</script>

<template>
  <div class="approval-container">
    <div class="pending-view">
      <div class="card">
        <h2>Account Pending Approval</h2>
        <p>Please wait for the DGM head to approve your account. You will be notified once approved.</p>
        <p class="muted">You will not be able to access member features until your account is approved.</p>
        <div class="actions">
          <button class="btn-about" @click="showAbout = true"><span>About Us</span><span class="arrow">→</span></button>
          <button class="btn-logout" @click="logout">Sign Out</button>
        </div>
      </div>
    </div>

    <!-- The Shared Component -->
    <AboutUsOverlay :isOpen="showAbout" @close="showAbout = false" />
  </div>
</template>

<style scoped>
.approval-container { width: 100%; min-height: 100vh; font-family: 'Inter', sans-serif; }
.pending-view { display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #f8f9fa; }
.card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); max-width: 500px; width: 90%; text-align: center; }
.card h2 { color: #1a1a1a; margin-bottom: 16px; }
.card p { color: #4a4a4a; line-height: 1.6; margin-bottom: 12px; }
.muted { color: #607D8B; font-size: 0.9rem; font-style: italic; margin-bottom: 24px; }
.actions { display: flex; flex-direction: column; gap: 12px; }
.btn-about { background: #D32F2F; color: white; border: none; padding: 14px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; display: flex; justify-content: center; align-items: center; gap: 8px; transition: transform 0.2s; }
.btn-about:hover { transform: translateY(-2px); background: #b71c1c; }
.btn-logout { background: transparent; color: #D32F2F; border: 2px solid #ffebee; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; }
.btn-logout:hover { background: #ffebee; }
</style>