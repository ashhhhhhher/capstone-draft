<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { User, ChevronDown, LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useNotificationsStore } from '../../stores/notifications'

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()

const router = useRouter()

// dropdown
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function onProfileTriggerClick() {
  toggleDropdown()
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
  if (authStore.userRole === 'admin') {
    router.push('/profile')
  } else {
    router.push('/member/profile')
  }
  isDropdownOpen.value = false
}

// --- Dynamic Role Tag Logic ---
const memberDisplayRole = computed(() => {
  if (authStore.userRole === 'admin') return 'Administrator'
  
  const profile = authStore.userProfile
  if (!profile || !profile.finalTags) return 'Member'

  if (profile.finalTags.isDgroupLeader) return 'Dgroup Leader'
  // "Member" implies they are part of a dgroup (Regular)
  if (profile.finalTags.isRegular || profile.dgroupLeader) return 'Member'
  if (profile.finalTags.isSeeker) return 'Seeker'
  
  // Default fallback for new signups
  return 'First Timer'
})

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

// notifications
const showNotifications = ref(false)

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
}

function openNotificationFocus(focusKey) {
  showNotifications.value = false
  router.push({ path: '/members', query: { focus: focusKey } })
}
</script>


<template>
  <header class="app-header">
    <div class="greeting">
      <h2>Hello, {{ authStore.user?.displayName?.split(' ')[0] || 'User' }}</h2>
      <p>Welcome back.</p>
    </div>

    <div class="profile-controls" ref="dropdownRef">
      
      <!-- Notification Button -->
      <div class="notification-wrapper">
        <button class="notification-btn" @click="toggleNotifications">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" 
                  stroke="currentColor" stroke-width="1.6"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"
                  stroke="currentColor" stroke-width="1.6"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>

          <span v-if="notificationsStore.localNotifications.length" class="notif-dot" />
        </button>

        <!-- Sliding Notification Panel -->
        <div v-if="showNotifications" class="notification-overlay">
          <div class="notif-backdrop" @click="showNotifications = false"></div>

          <aside class="notification-panel">
            <div class="panel-header">
              <h4>Notifications</h4>
              <button class="close-btn" @click="showNotifications = false">×</button>
            </div>

            <div class="panel-body">
              <div v-if="!notificationsStore.localNotifications.length" class="empty-notif">
                No notifications
              </div>

              <div v-else class="notif-list">
                <div v-for="n in notificationsStore.localNotifications" :key="n.id" class="notif-card">
                  <div class="notif-header">{{ n.header }}</div>
                  <div class="notif-body">{{ n.body }}</div>
                  <div class="notif-action">
                    <button class="notif-cta" @click="openNotificationFocus(n.focus)">
                      Tap to review these members →
                    </button>
                  </div>
                </div>
              </div>

              <div class="panel-footer">
                <button class="clear-btn"
                  @click="notificationsStore.clearLocalNotifications(); showNotifications=false">
                  Clear
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Profile Dropdown Trigger -->
      <div class="profile-trigger" @click.stop="onProfileTriggerClick">
        <div class="profile-avatar">
          <!-- Show uploaded pic if available, else icon -->
          <img 
            v-if="authStore.userProfile?.profilePicture" 
            :src="authStore.userProfile.profilePicture" 
            alt="Profile" 
            class="avatar-img"
          />
          <User v-else :size="24" color="#1976D2" />
        </div>
        <ChevronDown :size="16" :class="{ rotate: isDropdownOpen }" />
      </div>

      <!-- Profile Dropdown -->
      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header">
            <p class="user-name">{{ authStore.user?.displayName || 'User' }}</p>
            <!-- Dynamic Role Display -->
            <span 
              class="user-role-badge" 
              :class="memberDisplayRole.toLowerCase().replace(' ', '-')"
            >
              {{ memberDisplayRole }}
            </span>
          </div>

          <div class="dropdown-items">
            <button class="dropdown-item" @click="handleProfileClick">
              <User :size="18" />
              <span>My Profile</span>
            </button>

            <button class="dropdown-item logout" @click="handleLogout">
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

/* PROFILE */
.profile-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 24px;
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
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rotate {
  transform: rotate(180deg);
  transition: transform .2s;
}

/* DROPDOWN */
.dropdown-menu {
  position: absolute;
  top: 120%;
  right: 0;
  width: 240px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #EEE;
  z-index: 500;
}

.dropdown-header {
  padding: 16px;
  background: #F8FAFC;
  border-bottom: 1px solid #EEE;
  text-align: center;
}
.user-name {
  font-weight: 700;
  font-size: 16px;
  margin: 0 0 4px 0;
}

/* Dynamic Badge Styles */
.user-role-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 12px;
  display: inline-block;
}
.user-role-badge.first-timer { background: #E0E0E0; color: #616161; }
.user-role-badge.seeker { background: #FFF3E0; color: #E65100; }
.user-role-badge.member { background: #E3F2FD; color: #1565C0; }
.user-role-badge.dgroup-leader { background: #E8F5E9; color: #2E7D32; }
.user-role-badge.administrator { background: #37474F; color: #FFF; }

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  width: 100%;
  border-radius: 0;
  cursor: pointer;
  background: none;
  border: none;
  text-align: left;
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
}

/* NOTIFICATIONS */
.notification-wrapper {
  position: relative;
}

.notification-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1976D2;
  border: 2px solid #1976D2;
  box-shadow: none;
}

.notification-btn:hover {
  background: #E3F2FD;
}

.notification-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(25,118,210,0.12);
}

.notif-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 12px;
  height: 12px;
  background: #D32F2F;
  border: 2px solid white;
  border-radius: 50%;
}

.notification-btn svg {
  color: #1976D2;
}
.notification-btn svg path {
  stroke: #1976D2 !important;
  fill: none !important;
}

/* notification slide panel */
.notification-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.notif-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(9,30,66,.32);
}

.notification-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 33vw;
  min-width: 320px;
  background: white;
  display: flex;
  flex-direction: column;
  animation: slideIn .25s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.notif-card {
  border: 1px solid #ECEFF1;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

.notif-header {
  font-weight: 700;
  color: #b71c1c;
}

.notif-cta {
  background: none;
  border: none;
  color: #1976D2;
  font-weight: 700;
  cursor: pointer;
}

.panel-footer {
  padding: 12px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
}

.clear-btn {
  background: #FFFFFF;
  border: 2px solid #1976D2;
  color: #1976D2;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}
.clear-btn:hover {
  background: #E3F2FD;
}

.notification-panel .close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #6B7280;
  font-size: 18px;
  border-radius: 50%;
  line-height: 1; 
  transition: background-color 0.15s ease, color 0.15s ease;
}

.notification-panel .close-btn:hover {
  background-color: #F3F4F6;
  color: #374151;
}
</style>