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
const isScrolled = ref(false)

function toggleDropdown() { isDropdownOpen.value = !isDropdownOpen.value }
function closeDropdown(event) { if (dropdownRef.value && !dropdownRef.value.contains(event.target)) { isDropdownOpen.value = false } }
function toggleNotifications() { showNotifications.value = !showNotifications.value }
function toggleAbout() { showAboutPage.value = !showAboutPage.value }
function handleScroll() { isScrolled.value = window.scrollY > 20 }

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

async function dismissAll() {
  // ask for confirmation before deleting all notifications permanently
  const ok = confirm('Are you sure you want to dismiss ALL notifications? This will permanently remove them.')
  if (!ok) return

  try {
    await notificationsStore.clearAllNotifications()
    showNotifications.value = false
  } catch (err) {
    console.error('Failed to clear notifications', err)
    // fallback: mark as read locally
    try { await notificationsStore.clearLocalNotifications() } catch(e){}
    showNotifications.value = false
  }
}

// confirm and delete a single notification
async function confirmDelete(notifId) {
  const ok = confirm('Are you sure you want to delete this notification?')
  if (!ok) return
  try {
    await notificationsStore.deleteNotification(notifId)
  } catch (err) {
    console.error('Failed to delete notification', err)
    // if deletion fails, optionally mark as read locally
    try { await notificationsStore.markAsRead(notifId) } catch(e){}
  }
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
  window.addEventListener('scroll', handleScroll)

  if (authStore.user) {
    notificationsStore.initUserNotifications()
  }
})
onUnmounted(() => { 
  document.removeEventListener('click', closeDropdown)
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header class="app-header" :class="{ 'header-at-top': !isScrolled }">
    <div class="greeting">
      <h2>Hello, <span>{{ firstName }}</span></h2>
      <p>Welcome back to Elevate</p>
    </div>

    <div class="profile-controls" ref="dropdownRef">
      <button class="header-icon-btn" @click="toggleAbout" title="About Elevate"><Info :size="16" /></button>
      
      <div class="notification-wrapper">
        <button class="header-icon-btn notif-btn" @click="toggleNotifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <span v-if="notificationsStore.localNotifications.length" class="notif-dot" />
        </button>

        <div v-if="showNotifications" class="notification-overlay">
          <div class="notif-backdrop" @click="showNotifications = false"></div>
          <aside class="notification-panel">
            <div class="panel-header"><h4>Notifications</h4><button class="close-btn" @click="showNotifications = false">×</button></div>
            <div class="panel-body">
              <div v-if="!notificationsStore.localNotifications.length" class="empty-notif">No new updates</div>
              <div v-else class="notif-list">
                <div v-for="n in notificationsStore.localNotifications" :key="n.id" class="notif-card" @click="n.focus ? openNotificationFocus(n.focus) : null" :class="{ clickable: !!n.focus }">
                  <button class="notif-delete" @click.stop="confirmDelete(n.id)" title="Delete">−</button>
                  <div class="notif-header">{{ n.header }}</div>
                  <div class="notif-body">{{ n.body }}</div>
                  <div class="notif-action" v-if="n.focus"><button class="notif-cta" @click.stop="openNotificationFocus(n.focus)">View details →</button></div>
                </div>
              </div>
              <div class="panel-footer"><button class="clear-btn" @click="dismissAll">Dismiss All</button></div>
            </div>
          </aside>
        </div>
      </div>

      <div class="profile-trigger" @click.stop="toggleDropdown">
        <div class="profile-avatar">
          <img v-if="authStore.userProfile?.profilePicture" :src="authStore.userProfile.profilePicture" class="avatar-img"/>
          <User v-else :size="18" />
        </div>
        <ChevronDown :size="12" :class="{ rotate: isDropdownOpen }" />
      </div>

      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header">
            <p class="user-name">{{ displayName }}</p>
            <span class="user-role-badge" :class="memberDisplayRole.toLowerCase().replace(' ', '-')">{{ memberDisplayRole }}</span>
          </div>
          <div class="dropdown-items">
            <button class="dropdown-item" @click="handleProfileClick"><User :size="18" /><span>Account Details</span></button>
            <button class="dropdown-item logout" @click="handleLogout"><LogOut :size="18" /><span>Logout</span></button>
          </div>
        </div>
      </transition>
    </div>

  </header>
  <Teleport to="body">
    <AboutUs :isOpen="showAboutPage" @close="showAboutPage = false" />
  </Teleport>
</template>

<style scoped>
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); height: 64px; position: relative; border-bottom: 1px solid rgba(0, 0, 0, 0.05); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.header-at-top { background: #1976D2; border-bottom-color: transparent; }
.greeting h2 { margin: 0; font-size: 18px; font-weight: 600; color: #1e293b; letter-spacing: -0.01em; transition: color 0.3s ease; }
.header-at-top .greeting h2 { color: rgba(255, 255, 255, 0.9); }
.greeting h2 span { color: #1976D2; font-weight: 800; transition: color 0.3s ease; }
.header-at-top .greeting h2 span { color: #ffffff; }
.greeting p { margin: 0; font-size: 11px; color: #64748b; font-weight: 500; transition: color 0.3s ease; }
.header-at-top .greeting p { color: rgba(255, 255, 255, 0.7); }
.profile-controls { display: flex; align-items: center; gap: 8px; position: relative; }
.header-icon-btn { width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; display: flex; justify-content: center; align-items: center; color: #475569; border: none; cursor: pointer; transition: all 0.3s ease; }
.header-at-top .header-icon-btn { background: rgba(255, 255, 255, 0.15); color: #ffffff; }
.header-icon-btn:hover { background: #e2e8f0; transform: translateY(-2px); }
.header-at-top .header-icon-btn:hover { background: rgba(255, 255, 255, 0.25); }
.notif-dot { position: absolute; top: 8px; right: 8px; width: 6px; height: 6px; background: #1976D2; border: 1.5px solid #ffffff; border-radius: 50%; }
.header-at-top .notif-dot { background: #ffffff; border-color: #1976D2; }
.profile-trigger { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 6px; border-radius: 12px; background: #f1f5f9; transition: all 0.3s ease; color: #475569; }
.header-at-top .profile-trigger { background: rgba(255, 255, 255, 0.1); color: #ffffff; }
.profile-avatar { width: 30px; height: 30px; border-radius: 8px; background-color: #1976D2; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transition: all 0.3s ease; }
.header-at-top .profile-avatar { background-color: #ffffff; color: #1976D2; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.rotate { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: 50px; right: 0; width: 220px; background: white; border-radius: 18px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); z-index: 500; overflow: hidden; }
.dropdown-header { padding: 18px; background: #E3F2FD; text-align: center; border-bottom: 1px solid rgba(25, 118, 210, 0.05); }
.user-name { font-weight: 800; font-size: 15px; color: #1e293b; margin: 0; }
.user-role-badge { font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 12px; border-radius: 8px; display: inline-block; margin-top: 6px; letter-spacing: 0.05em; }
.user-role-badge.administrator { background: #1e293b; color: #FFF; }
.user-role-badge.member { background: #BBDEFB; color: #1976D2; }
.dropdown-item { display: flex; align-items: center; gap: 12px; padding: 14px 18px; width: 100%; background: none; border: none; cursor: pointer; text-align: left; font-weight: 600; font-size: 14px; color: #475569; transition: all 0.2s; }
.dropdown-item:hover { background: #E3F2FD; color: #1976D2; }
.dropdown-item.logout { color: #dc2626; border-top: 1px solid #f8fafc; }
.notification-overlay { position: fixed; inset: 0; z-index: 2000; }
.notif-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(4px); }
.notification-panel { position: fixed; right: 0; top: 0; height: 100vh; width: 320px; background: white; box-shadow: -10px 0 40px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
.panel-header { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
.panel-header h4 { margin: 0; font-weight: 800; color: #1e293b; }
.panel-body { flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc; }
.notif-card { position: relative; padding: 14px; border-radius: 16px; border: 1px solid rgba(0,0,0,0.03); background: white; margin-bottom: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); transition: transform 0.2s; }
.notif-card.clickable:active { transform: scale(0.98); }
.notif-header { font-weight: 800; color: #1e293b; margin-bottom: 4px; font-size: 14px; }
.notif-body { color: #64748b; font-size: 13px; line-height: 1.4; }
.notif-action { margin-top: 10px; display: flex; justify-content: flex-end; }
.notif-cta { background: #1976D2; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
.notif-delete { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 8px; border: none; background: #f1f5f9; color: #475569; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.notif-delete:hover { background: #ffecec; color: #b91c1c; }
.panel-footer { padding: 16px; background: white; border-top: 1px solid #f1f5f9; display: flex; justify-content: center; }
.clear-btn { background: #f1f5f9; border: none; color: #64748b; padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; transition: all 0.2s; }
.clear-btn:hover { background: #BBDEFB; color: #1976D2; }
.close-btn { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; color: #64748b; }
.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-10px); }
</style>