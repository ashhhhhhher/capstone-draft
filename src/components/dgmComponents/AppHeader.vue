<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { User, ChevronDown, LogOut, Info } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useNotificationsStore } from '../../stores/notifications'

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const router = useRouter()

const isDropdownOpen = ref(false)
const dropdownRef = ref(null)
const showAboutPage = ref(false)
const showNotifications = ref(false)

function toggleDropdown() { isDropdownOpen.value = !isDropdownOpen.value }
function onProfileTriggerClick() { toggleDropdown() }
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
  if (profile.finalTags.isRegular || profile.dgroupLeader) return 'Member'
  if (profile.finalTags.isSeeker) return 'Seeker'
  return 'First Timer'
})

// Computed for Display Name to ensure reactivity from store
const displayName = computed(() => {
  if (authStore.userProfile?.firstName && authStore.userProfile?.lastName) {
    return `${authStore.userProfile.firstName} ${authStore.userProfile.lastName}`
  }
  return authStore.user?.displayName || 'User'
})

const firstName = computed(() => {
  return authStore.userProfile?.firstName || authStore.user?.displayName?.split(' ')[0] || 'User'
})

function openNotificationFocus(focusKey) {
  showNotifications.value = false
  if (focusKey === 'matching') { router.push({ path: '/dgroups', query: { tab: 'matching' } }) } 
  else if (focusKey === 'memberDgroup') { router.push({ name: 'memberDgroup' }) } 
  else if (focusKey === 'memberAttendance') { router.push({ name: 'memberAttendance' }) } 
  else { if (authStore.userRole === 'admin') { router.push({ path: '/members', query: { focus: focusKey } }) } }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
  if (authStore.userRole === 'admin') {
    notificationsStore.cleanupOldNotifications()
    notificationsStore.initSeekerListener()
  } else if (authStore.user) {
    notificationsStore.initMemberListeners(authStore.user.uid)
  }
})
onUnmounted(() => { document.removeEventListener('click', closeDropdown) })
</script>

<template>
  <header class="app-header">
    <div class="greeting">
      <h2>Hello, {{ firstName }}</h2>
      <p>Welcome back.</p>
    </div>

    <div class="profile-controls" ref="dropdownRef">
      <!-- About Us Trigger -->
      <button class="header-icon-btn about-btn" @click="toggleAbout" title="About Elevate">
        <Info :size="18" />
      </button>

      <!-- Notification Button -->
      <div class="notification-wrapper">
        <button class="notification-btn" @click="toggleNotifications">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span v-if="notificationsStore.localNotifications.length" class="notif-dot" />
        </button>

        <!-- Notification Panel -->
        <div v-if="showNotifications" class="notification-overlay">
          <div class="notif-backdrop" @click="showNotifications = false"></div>
          <aside class="notification-panel">
            <div class="panel-header"><h4>Notifications</h4><button class="close-btn" @click="showNotifications = false">×</button></div>
            <div class="panel-body">
              <div v-if="!notificationsStore.localNotifications.length" class="empty-notif">No notifications</div>
              <div v-else class="notif-list">
                <div v-for="n in notificationsStore.localNotifications" :key="n.id" class="notif-card" @click="n.focus ? openNotificationFocus(n.focus) : null" :class="{ clickable: !!n.focus }">
                  <div class="notif-header">{{ n.header }}</div>
                  <div class="notif-body">{{ n.body }}</div>
                  <div class="notif-action" v-if="n.focus"><button class="notif-cta" @click.stop="openNotificationFocus(n.focus)">Tap to view →</button></div>
                </div>
              </div>
              <div class="panel-footer"><button class="clear-btn" @click="notificationsStore.clearLocalNotifications(); showNotifications=false">Clear</button></div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Profile Dropdown Trigger -->
      <div class="profile-trigger" @click.stop="onProfileTriggerClick">
        <div class="profile-avatar">
          <img v-if="authStore.userProfile?.profilePicture" :src="authStore.userProfile.profilePicture" alt="Profile" class="avatar-img"/>
          <User v-else :size="24" color="#1976D2" />
        </div>
        <ChevronDown :size="16" :class="{ rotate: isDropdownOpen }" />
      </div>

      <!-- Profile Dropdown -->
      <transition name="fade">
        <div v-if="isDropdownOpen" class="dropdown-menu">
          <div class="dropdown-header">
            <p class="user-name">{{ displayName }}</p>
            <span class="user-role-badge" :class="memberDisplayRole.toLowerCase().replace(' ', '-')">{{ memberDisplayRole }}</span>
          </div>
          <div class="dropdown-items">
            <button class="dropdown-item" @click="handleProfileClick"><User :size="18" /><span>My Profile</span></button>
            <button class="dropdown-item logout" @click="handleLogout"><LogOut :size="18" /><span>Logout</span></button>
          </div>
        </div>
      </transition>
    </div>

    <!-- ABOUT VIEW OVERLAY (Long Page) -->
    <transition name="slide-up">
      <div v-if="showAboutPage" class="about-view-overlay">
        <nav class="about-nav"><button class="nav-back" @click="showAboutPage = false">← Back</button></nav>
        <div class="about-scroll-container">
          <section class="hero-section" style="background-image: url('/northwest.jpg')">
            <div class="content-overlay"><img src="/elevate word.PNG" alt="ELEVATE" class="hero-logo" /><p class="hero-text">ELEVATE is a nationwide student movement which aims to take students to the next <span class="highlight-red">LEVEL</span>.<br><br>Our desire is for every student to experience a <span class="highlight-red">L</span>ife <span class="highlight-red">E</span>mpowered through <span class="highlight-red">V</span>alues, <span class="highlight-red">E</span>xcellence, and <span class="highlight-red">L</span>eadership!</p><div class="scroll-indicator">↓</div></div>
          </section>
          <section class="verse-section" style="background-image: url('/bible.jpg')"><div class="content-overlay dark-mode"><blockquote class="bible-verse">"Go therefore and make disciples of all the nations..."</blockquote><cite class="citation-red">Matthew 28:19-20</cite></div></section>
          <section class="info-section" style="background-image: url('/hugs.jpg')"><div class="content-overlay"><h2 class="section-title">Life Connected</h2><p class="section-desc">We’re a community of people, just like you meeting together each week to talk about life, God, and to pray for one another.</p></div></section>
          <div class="divider-header"><h2>WHAT WE DO</h2></div>
          <section class="what-we-do-grid">
            <div class="feature-col" style="background-image: url('/elevate logo.jpg')"><div class="col-overlay"><h3 class="feature-title">ELEVATE WKND</h3><p class="feature-desc">Unwind with us at our weekly gathering!</p></div></div>
            <div class="feature-col" style="background-image: url('/group2.jpg')"><div class="col-overlay"><h3 class="feature-title">DISCIPLESHIP GROUPS</h3><p class="feature-desc">Find a group of friends who you can grow with.</p></div></div>
            <div class="feature-col" style="background-image: url('/unitesm.jpg')"><div class="col-overlay"><h3 class="feature-title">Campus UNITE</h3><p class="feature-desc">Celebrate God’s faithfulness.</p></div></div>
          </section>
          <section class="mission-vision-section">
            <div class="mv-container">
              <div class="mv-card"><h3>Our Mission</h3><p>To honor God and make Christ-committed students.</p></div>
              <div class="mv-card"><h3>Our Vision</h3><p>To see a movement of millions transforming lives.</p></div>
            </div>
          </section>
          <section class="final-footer">
            <div class="footer-content"><img src="/elevate word.PNG" alt="ELEVATE" class="footer-logo" /><p class="footer-tagline">A nationwide student movement taking students to the next LEVEL.</p><p class="copyright">© 2026 ELEVATE. All rights reserved.</p></div>
            <button class="btn-close-large" @click="showAboutPage = false">Back to Dashboard</button>
          </section>
        </div>
      </div>
    </transition>
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

/* NOTIFICATION PANEL */
.notification-overlay { position: fixed; inset: 0; z-index: 2000; }
.notif-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.3); }
.notification-panel { position: fixed; right: 0; top: 0; height: 100vh; width: 320px; background: white; animation: slideIn .2s ease; display: flex; flex-direction: column; }
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.panel-header { padding: 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
.panel-body { flex: 1; overflow-y: auto; padding: 16px; }
/* Clickable notif card */
.notif-card.clickable { cursor: pointer; }

/* Notification card visuals */
.notif-list .notif-card {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #F1F5F9;
  background: #FFFFFF;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(16,24,40,0.02);
}
.notif-list .notif-card.clickable:hover {
  background: #F6FBFF;
}
.notif-header { font-weight: 700; color: #102A43; margin-bottom: 6px; }
.notif-body { color: #546E7A; font-size: 14px; margin-bottom: 8px; }

/* CTA and control buttons inside notification panel */
.notif-action { display: flex; justify-content: flex-end; }
.notif-cta {
  background-color: #1976D2;
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(25,118,210,0.12);
}
.notif-cta:hover { background-color: #1565C0; }

.panel-footer { padding: 12px; border-top: 1px solid #EEE; display:flex; justify-content: flex-end; }
.clear-btn {
  background: transparent;
  border: 1px solid #E3F2FD;
  color: #1976D2;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.clear-btn:hover { background: #E3F2FD; }

.close-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #546E7A;
}
.close-btn:hover { color: #37474F; }

/* ABOUT OVERLAY STYLES */
.about-view-overlay { position: fixed; inset: 0; background: #000; z-index: 3000; overflow: hidden; display: flex; flex-direction: column; }
.about-scroll-container { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
.about-nav { position: absolute; top: 20px; left: 20px; z-index: 3100; }
.nav-back { background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; cursor: pointer; }
.hero-section, .verse-section, .info-section { min-height: 100vh; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
.content-overlay { background: rgba(0,0,0,0.6); padding: 40px; text-align: center; color: white; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.hero-logo { max-width: 400px; width: 80%; margin-bottom: 20px; }
.hero-text { font-size: 1.2rem; max-width: 700px; }
.highlight-red { color: #D32F2F; font-weight: 800; }
.section-title { font-size: 2.5rem; color: #D32F2F; margin-bottom: 15px; }
.divider-header { background: #000; padding: 60px 20px; text-align: center; color: #D32F2F; }
.what-we-do-grid { display: flex; flex-wrap: wrap; background: #000; }
.feature-col { flex: 1; min-width: 300px; min-height: 400px; background-size: cover; background-position: center; position: relative; }
.col-overlay { background: rgba(0,0,0,0.7); inset: 0; position: absolute; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; color: white; text-align: center; }
.mission-vision-section { background: #111; padding: 80px 20px; color: white; text-align: center; }
.mv-container { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
.mv-card { background: #222; padding: 30px; border-radius: 12px; flex: 1; min-width: 280px; }
.mv-card h3 { color: #D32F2F; margin-bottom: 10px; }
.final-footer { background: #000; padding: 60px 20px; text-align: center; color: white; }
.btn-close-large { background: #222; color: white; padding: 12px 30px; border: 1px solid #444; border-radius: 30px; cursor: pointer; margin-top: 20px; transition: 0.3s; }
.btn-close-large:hover { background: #D32F2F; border-color: #D32F2F; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.4s ease, opacity 0.4s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>