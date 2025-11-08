<script setup>
import { User } from 'lucide-vue-next'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

</script>

<template>
  <header class="app-header">
    <div class="greeting">
      <!-- 
        THIS IS THE FIX:
        It now checks for displayName first.
      -->
      <h2>Hello, {{ authStore.user?.displayName || authStore.user?.email || 'Admin' }}</h2>
      <p>Welcome to your dashboard.</p>
    </div>
    
    <div class="profile-controls">

      <RouterLink to="/profile" class="profile-avatar" aria-label="View Profile">
        <User :size="24" color="#1976D2" />
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
}
.greeting h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}
.greeting p {
  margin: 4px 0 0 0;
  font-size: 16px;
  color: #546E7A;
}

.profile-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}


.profile-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid #1976D2;
  transition: all 0.2s ease;
}
.profile-avatar:hover {
  box-shadow: 0 0 10px rgba(25, 118, 210, 0.5);
}

</style>