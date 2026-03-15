<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { watch, ref, onMounted, onUnmounted } from 'vue'
import AboutUsOverlay from '../components/dgmComponents/AboutUs.vue'

const authStore = useAuthStore()
const router = useRouter()
const showAbout = ref(false)

function logout() { authStore.logout(); router.push({ name: 'login' }) }

watch(() => authStore.userRole, (newRole) => {
  if (newRole === 'member') router.push({ name: 'memberHome' })
})

// Hide global chatbox when on the approval page
onMounted(() => {
  document.body.classList.add('approval-page-active')
})

onUnmounted(() => {
  document.body.classList.remove('approval-page-active')
})
</script>

<template>
  <div class="approval-container">
    <div class="pending-view">
      <div class="approval-card">
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
.pending-view { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f8f9fa; padding: 20px; }

/* Changed from .card to .approval-card to prevent global CSS conflicts that cause stretching */
.approval-card { 
  background: white; 
  padding: 40px 32px; 
  border-radius: 24px; 
  box-shadow: 0 10px 40px rgba(0,0,0,0.08); 
  max-width: 480px; 
  width: 100%; 
  text-align: center; 
  height: auto; /* Tightly hugs the content */
}

.approval-card h2 { color: #0F172A; margin-bottom: 16px; font-weight: 800; font-size: 24px; }
.approval-card p { color: #475569; line-height: 1.6; margin-bottom: 16px; font-size: 15px; }
.muted { color: #64748B !important; font-size: 13px !important; font-style: italic; margin-bottom: 32px !important; }
.actions { display: flex; flex-direction: column; gap: 12px; }

.btn-about { background: #D32F2F; color: white; border: none; padding: 14px 20px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 1rem; display: flex; justify-content: center; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(211, 47, 47, 0.2); }
.btn-about:hover { transform: translateY(-2px); background: #b71c1c; box-shadow: 0 6px 16px rgba(211, 47, 47, 0.3); }

.btn-logout { background: transparent; color: #D32F2F; border: 2px solid #ffebee; padding: 14px 20px; border-radius: 12px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 1rem;}
.btn-logout:hover { background: #ffebee; color: #b71c1c; }
</style>

<!-- Global style to hide the chat system -->
<style>
body.approval-page-active .chat-system {
  display: none !important;
}
</style>