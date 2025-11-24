<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { User, LogOut, ChevronDown } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function closeDropdown(event) {
  // Close if clicking outside the dropdown
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isDropdownOpen.value = false
  }
}

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error("Logout failed", error)
  }
}

function handleProfileClick() {
  // Only navigate to /profile if Admin, as per your router rules
  if (authStore.userRole === 'admin') {
    router.push('/profile')
  }
  isDropdownOpen.value = false
}

// Click outside listener
onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <header class="app-header">
    <div class="greeting">
      <h2>Hello, {{ authStore.user?.displayName?.split(' ')[0] || 'User' }}</h2>
      <p>Welcome back.</p>
    </div>
    
    <div class="profile-controls" ref="dropdownRef">
      <!-- Avatar Button -->
      <div class="profile-trigger" @click.stop="toggleDropdown">
        <div class="profile-avatar">
          <User :size="24" color="#1976D2" />
        </div>
        <ChevronDown :size="16" color="#546E7A" :class="{ 'rotate': isDropdownOpen }" />
      </div>

      <!-- Dropdown Menu -->
      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header">
            <p class="user-name">{{ authStore.user?.displayName || 'User' }}</p>
            <p class="user-role">{{ authStore.userRole || 'Member' }}</p>
          </div>
          
          <div class="dropdown-items">
            <!-- Show Profile Link only for Admins for now -->
            <button v-if="authStore.userRole === 'admin'" @click="handleProfileClick" class="dropdown-item">
              <User :size="18" />
              <span>My Profile</span>
            </button>

            <button @click="handleLogout" class="dropdown-item logout">
              <LogOut :size="18" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  position: relative;
}

.greeting h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}
.greeting p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #546E7A;
}

/* Profile Controls */
.profile-controls {
  position: relative;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 24px;
  transition: background 0.2s;
}
.profile-trigger:hover {
  background-color: #F5F5F5;
}

.profile-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #1976D2;
}

.rotate {
  transform: rotate(180deg);
  transition: transform 0.2s ease;
}

/* Dropdown Styles */
.dropdown-menu {
  position: absolute;
  top: 120%;
  right: 0;
  width: 220px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #EEE;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: 16px;
  background: #F8FAFC;
  border-bottom: 1px solid #EEE;
}
.user-name {
  margin: 0;
  font-weight: 700;
  color: #333;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: #78909C;
  text-transform: capitalize;
}

.dropdown-items {
  padding: 8px;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  color: #546E7A;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.dropdown-item:hover {
  background: #F1F5F9;
  color: #1976D2;
}

.dropdown-item.logout {
  color: #D32F2F;
}
.dropdown-item.logout:hover {
  background: #FFEBEE;
  color: #C62828;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>