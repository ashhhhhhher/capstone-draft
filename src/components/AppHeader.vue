<script setup>
<<<<<<< Updated upstream
import { ref, onMounted, onUnmounted } from 'vue'
import { User, LogOut, ChevronDown } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
=======
import { ref } from 'vue'
import { User } from 'lucide-vue-next'
import { RouterLink, useRouter } from 'vue-router'
>>>>>>> Stashed changes
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'

const authStore = useAuthStore()
const router = useRouter()
<<<<<<< Updated upstream
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function closeDropdown(event) {
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
  // Redirect based on role
  if (authStore.userRole === 'admin') {
    router.push('/profile')
  } else {
    router.push('/member/profile') // New route for members
  }
  isDropdownOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
=======
const notificationsStore = useNotificationsStore()

// local UI state
const showNotifications = ref(false)

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
}

// <-- changed: route to Members instead of Insights
function openNotificationFocus(focusKey) {
  showNotifications.value = false
  router.push({ path: '/members', query: { focus: focusKey } })
}
>>>>>>> Stashed changes
</script>

<template>
  <header class="app-header">
    <div class="greeting">
<<<<<<< Updated upstream
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
=======
      <h2>Hello, {{ authStore.user?.displayName || authStore.user?.email || 'Admin' }}</h2>
      <p>Welcome to your dashboard.</p>
    </div>
    
    <div class="profile-controls">
      <!-- notification button -->
      <div class="notification-wrapper">
        <button class="notification-btn" @click="toggleNotifications" aria-label="Open notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="notificationsStore.localNotifications.length" class="notif-dot" />
        </button>

        <!-- sliding panel overlay -->
        <div v-if="showNotifications" class="notification-overlay" @keydown.esc="showNotifications = false">
          <div class="notif-backdrop" @click="showNotifications = false"></div>
          <aside class="notification-panel" role="dialog" aria-label="Notifications" @click.stop>
            <div class="panel-header">
              <h4>Notifications</h4>
              <button class="close-btn" @click="showNotifications = false" aria-label="Close notifications">×</button>
            </div>

            <div class="panel-body">
              <div v-if="!notificationsStore.localNotifications.length" class="empty-notif">No notifications</div>

              <div v-else class="notif-list">
                <div v-for="n in notificationsStore.localNotifications" :key="n.id" class="notif-card">
                  <div class="notif-header">{{ n.header }}</div>
                  <div class="notif-body">{{ n.body }}</div>
                  <div class="notif-action">
                    <button class="notif-cta" @click="openNotificationFocus(n.focus)">Tap to review these members →</button>
                  </div>
                </div>
              </div>

              <div class="panel-footer">
                <button class="clear-btn" @click="notificationsStore.clearLocalNotifications(); showNotifications=false">Clear</button>
              </div>
            </div>
          </aside>
        </div>
>>>>>>> Stashed changes
      </div>

      <!-- Dropdown Menu -->
      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header">
            <p class="user-name">{{ authStore.user?.displayName || 'User' }}</p>
            <p class="user-role">{{ authStore.userRole || 'Member' }}</p>
          </div>
          
          <div class="dropdown-items">
            <!-- Universal Profile Button -->
            <button @click="handleProfileClick" class="dropdown-item">
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
<<<<<<< Updated upstream
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

=======
  display: flex;
  align-items: center;
  gap: 12px;
}

/* profile avatar (existing) */
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
/* notification wrapper styles */
.notification-wrapper { position: relative; display:flex; align-items:center; margin-right:8px; }

/* notification button matches avatar size */
.notification-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1976D2;
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(25,118,210,0.16);
  cursor: pointer;
}

/* small red dot indicating unread/new local notifications */
.notif-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #D32F2F;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

/* Overlay/backdrop that covers the whole viewport */
.notification-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
}
.notif-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(9,30,66,0.32);
  backdrop-filter: blur(2px);
}

/* Sliding panel covering full height and ~25% width from the right */
.notification-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 33vw;
  min-width: 320px;
  background: #fff;
  box-shadow: -20px 0 40px rgba(9,30,66,0.12);
  border-left: 1px solid rgba(0,0,0,0.04);
  z-index: 1010;
  display: flex;
  flex-direction: column;
  transform-origin: right top;
  animation: slideInFromRight 260ms cubic-bezier(.2,.8,.2,1);
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #F1F1F1;
}
.panel-header h4 { margin: 0; font-size: 16px; font-weight: 700; }
.close-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #546E7A;
  padding: 6px;
  border-radius: 6px;
}
.close-btn:hover { background: #F5F7FA; }
.panel-body { padding: 12px; overflow-y: auto; flex: 1 1 auto; }
.empty-notif { color: #78909C; text-align: center; padding: 20px; }

/* notification card inside panel */
.notif-list { display:flex; flex-direction:column; gap:12px; }
.notif-card { background:#fff; border:1px solid #ECEFF1; border-radius:10px; padding:12px; box-shadow:0 4px 12px rgba(0,0,0,0.04); }
.notif-header { font-weight:800; color:#b71c1c; }
.notif-body { color:#546E7A; margin-top:6px; }
.notif-action { display:flex; justify-content:flex-end; margin-top:8px; }
.notif-cta { background:transparent; border:none; color:#1976D2; font-weight:700; cursor:pointer; }

/* clear button footer */
.panel-footer { padding: 8px 12px; border-top:1px solid #F1F1F1; display:flex; justify-content:flex-end; }
.clear-btn { background:#F5F7FA; border:1px solid #E0E0E0; padding:8px 12px; border-radius:8px; cursor:pointer; }

@keyframes slideInFromRight {
  from { opacity: 0; transform: translateX(12px) scale(0.98); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

/* responsive tweaks */
@media (max-width: 1200px) {
  .notification-panel { width: 33vw; min-width: 320px; }
}
@media (max-width: 720px) {
  .notification-panel { width: 50vw; min-width: 280px; }
}
@media (max-width: 480px) {
  .notification-panel { width: 100vw; min-width: auto; }
>>>>>>> Stashed changes
}
</style>