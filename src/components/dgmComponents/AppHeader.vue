<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { User, ChevronDown, LogOut, Info } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useNotificationsStore } from '../../stores/notifications'
import { useMembersStore } from '../../stores/members'
import AboutUs from './AboutUs.vue' 

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const membersStore = useMembersStore()
const router = useRouter()

const isDropdownOpen = ref(false)
const dropdownRef = ref(null)
const showAboutPage = ref(false)
const showNotifications = ref(false)

function toggleDropdown() { isDropdownOpen.value = !isDropdownOpen.value }
function closeDropdown(event) { if (dropdownRef.value && !dropdownRef.value.contains(event.target)) { isDropdownOpen.value = false } }
function toggleNotifications() { showNotifications.value = !showNotifications.value }
function toggleAbout() { showAboutPage.value = !showAboutPage.value }

async function handleLogout() {
  try {
    notificationsStore.clearLocalNotifications()
    await authStore.logout()
    router.push('/login')
  } catch (error) { console.error("Logout failed", error) }
}

function handleProfileClick() {
  if (authStore.userRole === 'admin') { router.push('/profile') } 
  else { router.push('/member/profile') }
  isDropdownOpen.value = false
}

const memberDisplayRole = computed(() => {
  if (authStore.userRole === 'admin') return 'Administrator'
  const profile = authStore.userProfile
  if (!profile || !profile.finalTags) return 'Member'
  if (profile.finalTags.isDgroupLeader) return 'Dgroup Leader'
  return 'Member'
})

const displayName = computed(() => {
  if (authStore.userProfile?.firstName && authStore.userProfile?.lastName) return `${authStore.userProfile.firstName} ${authStore.userProfile.lastName}`
  return authStore.user?.displayName || 'User'
})

const firstName = computed(() => authStore.userProfile?.firstName || authStore.user?.displayName?.split(' ')[0] || 'User')

function openNotificationFocus(focusKey) {
  showNotifications.value = false
  if (focusKey === 'matching') router.push({ path: '/dgroups', query: { tab: 'matching' } }) 
  else if (focusKey === 'memberDgroup') router.push({ name: 'memberDgroup' }) 
  else if (focusKey === 'memberAttendance') router.push({ name: 'memberAttendance' }) 
  else if (focusKey === 'leaderRequests') router.push({ name: 'memberDgroup', query: { tab: 'downline' } }) 
  else if (authStore.userRole === 'admin') router.push({ path: '/members', query: { focus: focusKey } })
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
  if (authStore.user) {
    notificationsStore.initUserNotifications(authStore.user.uid, authStore.userProfile?.id);
    if (authStore.userRole === 'admin') { notificationsStore.cleanupOldNotifications(); notificationsStore.initSeekerListener() } 
    else { notificationsStore.initMemberListeners(authStore.user.uid) }
  }
})
onUnmounted(() => { document.removeEventListener('click', closeDropdown) })
</script>

<template>
  <header class="app-header">
    <div class="greeting"><h2>Hello, {{ firstName }}</h2><p>Welcome back.</p></div>

    <div class="profile-controls" ref="dropdownRef">
      <button class="header-icon-btn about-btn" @click="toggleAbout" title="About Elevate"><Info :size="18" /></button>
      <div class="notification-wrapper">
        <button class="notification-btn" @click="toggleNotifications">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span v-if="notificationsStore.localNotifications.length" class="notif-dot" />
        </button>
        <div v-if="showNotifications" class="notification-overlay">
          <div class="notif-backdrop" @click="showNotifications = false"></div>
          <aside class="notification-panel">
            <div class="panel-header"><h4>Notifications</h4><button class="close-btn" @click="showNotifications = false">×</button></div>
            <div class="panel-body">
              <div v-if="!notificationsStore.localNotifications.length" class="empty-notif">No notifications</div>
              <div v-else class="notif-list">
                <div v-for="n in notificationsStore.localNotifications" :key="n.id" class="notif-card" @click="n.focus ? openNotificationFocus(n.focus) : null" :class="{ clickable: !!n.focus }">
                  <div class="notif-header">{{ n.header }}</div><div class="notif-body">{{ n.body }}</div>
                  <div class="notif-action" v-if="n.focus"><button class="notif-cta" @click.stop="openNotificationFocus(n.focus)">Tap to view →</button></div>
                </div>
              </div>
              <div class="panel-footer"><button class="clear-btn" @click="notificationsStore.clearLocalNotifications(); showNotifications=false">Clear</button></div>
            </div>
          </aside>
        </div>
      </div>

      <div class="profile-trigger" @click.stop="toggleDropdown">
        <div class="profile-avatar"><img v-if="authStore.userProfile?.profilePicture" :src="authStore.userProfile.profilePicture" class="avatar-img"/><User v-else :size="24" color="#1976D2" /></div>
        <ChevronDown :size="16" :class="{ rotate: isDropdownOpen }" />
      </div>

      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header"><p class="user-name">{{ displayName }}</p><span class="user-role-badge" :class="memberDisplayRole.toLowerCase().replace(' ', '-')">{{ memberDisplayRole }}</span></div>
          <div class="dropdown-items">
            <button class="dropdown-item" @click="handleProfileClick"><User :size="18" /><span>My Profile</span></button>
            <button class="dropdown-item logout" @click="handleLogout"><LogOut :size="18" /><span>Logout</span></button>
          </div>
        </div>
      </transition>
    </div>

    <!-- Reusable Component -->
    <AboutUs :isOpen="showAboutPage" @close="showAboutPage = false" />
  </header>
</template>

<style scoped>
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: white; border-bottom: 1px solid #f0f0f0; }
.greeting h2 { margin: 0; font-size: 24px; font-weight: 700; color: #333; }
.greeting p { margin: 4px 0 0 0; font-size: 14px; color: #546E7A; }
.profile-controls { display: flex; align-items: center; gap: 12px; position: relative; }
.header-icon-btn { width: 40px; height: 40px; border-radius: 50%; background: #FFFFFF; display: flex; justify-content: center; align-items: center; color: #1976D2; border: 2px solid #1976D2; cursor: pointer; transition: all 0.2s; }
.header-icon-btn:hover { background: #E3F2FD; }
.notification-btn { width: 40px; height: 40px; border-radius: 50%; background: #FFFFFF; display: flex; justify-content: center; align-items: center; color: #1976D2; border: 2px solid #1976D2; position: relative; cursor: pointer; }
.notif-dot { position: absolute; top: 6px; right: 6px; width: 10px; height: 10px; background: #D32F2F; border: 2px solid white; border-radius: 50%; }
.profile-trigger { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; border-radius: 24px; }
.profile-avatar { width: 40px; height: 40px; border-radius: 50%; background-color: #E3F2FD; display: flex; align-items: center; justify-content: center; border: 2px solid #1976D2; overflow: hidden; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.rotate { transform: rotate(180deg); transition: transform .2s; }
.dropdown-menu { position: absolute; top: 120%; right: 0; width: 240px; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 1px solid #EEE; z-index: 500; }
.dropdown-header { padding: 16px; background: #F8FAFC; border-bottom: 1px solid #EEE; text-align: center; }
.user-name { font-weight: 700; font-size: 16px; margin: 0; }
.user-role-badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 12px; display: inline-block; margin-top: 4px; }
.user-role-badge.administrator { background: #37474F; color: #FFF; }
.user-role-badge.member { background: #E3F2FD; color: #1565C0; }
.dropdown-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; width: 100%; background: none; border: none; cursor: pointer; text-align: left; }
.dropdown-item:hover { background: #F1F5F9; color: #1976D2; }
.dropdown-item.logout { color: #D32F2F; }
.notification-overlay { position: fixed; inset: 0; z-index: 2000; }
.notif-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
.notification-panel { position: fixed; right: 0; top: 0; height: 100vh; width: 320px; background: white; animation: slideIn .2s ease; display: flex; flex-direction: column; }
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.panel-header { padding: 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
.panel-body { flex: 1; overflow-y: auto; padding: 16px; }
.notif-card { padding: 12px; border-radius: 10px; border: 1px solid #F1F5F9; background: #FFFFFF; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(16,24,40,0.02); }
.notif-card.clickable { cursor: pointer; }
.notif-card.clickable:hover { background: #F6FBFF; }
.notif-header { font-weight: 700; color: #102A43; margin-bottom: 6px; }
.notif-body { color: #546E7A; font-size: 14px; margin-bottom: 8px; }
.notif-action { display: flex; justify-content: flex-end; }
.notif-cta { background-color: #1976D2; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
.panel-footer { padding: 12px; border-top: 1px solid #EEE; display:flex; justify-content: flex-end; }
.clear-btn { background: transparent; border: 1px solid #E3F2FD; color: #1976D2; padding: 8px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
.close-btn { background: transparent; border: none; font-size: 20px; cursor: pointer; color: #546E7A; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>