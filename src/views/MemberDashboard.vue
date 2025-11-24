<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'
import MemberNavBar from '../components/MemberNavBar.vue'
import Modal from '../components/Modal.vue'
import CalendarModal from '../components/CalendarModal.vue'
import { Calendar as CalendarIcon, Bell as BellIcon } from 'lucide-vue-next'

/* --- STORES --- */
const { allEvents } = storeToRefs(useEventsStore())
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()

/* --- UI STATE --- */
const showCalendar = ref(false)
const showNotifications = ref(false)

/* --- UPCOMING EVENTS --- */
const upcomingEvents = computed(() => {
  const today = new Date()
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0]

  return (allEvents.value || [])
    .filter(e => e.date > todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* --- Member display name --- */
const displayName = computed(() => {
  const profile = authStore.userProfile
  return profile ? `${profile.firstName} ${profile.lastName}` : (authStore.user?.email || 'Member')
})

/* --- Notifications (member-facing) --- */
const notificationsList = computed(() => {
  // support common store shapes: notifications or allNotifications
  return (notificationsStore.notifications || notificationsStore.allNotifications || [])
})

const currentUserId = computed(() => authStore.userProfile?.id || authStore.user?.uid)

const importantNotifications = computed(() => {
  // show only important notifications targeted to this user or global ones (no targetUserId)
  return (notificationsList.value || [])
    .filter(n => n && (n.important === true || n.isImportant === true))
    .filter(n => !n.targetUserId || n.targetUserId === currentUserId.value)
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
})
</script>

<template>
  <div class="member-dashboard-container">
    <MemberNavBar />

    <!-- HEADER -->
    <div class="member-header">
      <div>
        <h1>Welcome Back, {{ displayName }}!</h1>
        <p class="sub">Elevate Baguio Member Dashboard</p>
      </div>

      <div class="header-actions">
        <button class="icon-btn" @click="showCalendar = true" aria-label="Show calendar">
          <CalendarIcon :size="18" />
        </button>

        <button class="icon-btn" @click="showNotifications = true" :aria-expanded="showNotifications" aria-label="Open notifications">
          <BellIcon :size="18" />
          <span v-if="importantNotifications.length" class="notif-count">{{ importantNotifications.length }}</span>
        </button>
      </div>
    </div>

    <!-- SLIDING NOTIFICATIONS PANEL (closes when clicking outside) -->
    <div v-if="showNotifications" class="notif-overlay" @click.self="showNotifications = false">
      <aside class="notifications-panel" role="dialog" aria-label="Member Notifications">
        <div class="notif-header">
          <h4>Notifications</h4>
          <button class="close-btn" @click="showNotifications = false">✕</button>
        </div>

        <div class="notif-body">
          <p class="notif-intro">Important messages for you</p>

          <div v-if="importantNotifications.length > 0" class="notif-list">
            <div v-for="n in importantNotifications" :key="n.id" class="notif-item">
              <div class="notif-meta">
                <div class="notif-title">{{ n.title || n.subject || 'Notification' }}</div>
                <div class="notif-date">{{ new Date(n.createdAt || n.date || n.timestamp || '').toLocaleString() }}</div>
              </div>
              <div class="notif-message">{{ n.message || n.body || '' }}</div>
            </div>
          </div>
          <div v-else class="notif-empty">
            <p>No important notifications.</p>
          </div>
        </div>
      </aside>
    </div>

    <!-- IMPORTANT NOTIFICATIONS (above upcoming events) -->
    <section v-if="importantNotifications.length > 0" class="important-notifs">
      <h3>Important Notifications</h3>
      <div class="important-list">
        <div v-for="n in importantNotifications" :key="n.id" class="important-card">
          <div class="imp-row">
            <div class="imp-title">{{ n.title || n.subject || 'Notification' }}</div>
            <div class="imp-date">{{ new Date(n.createdAt || n.date || n.timestamp || '').toLocaleDateString() }}</div>
          </div>
          <div class="imp-body">{{ n.message || n.body || '' }}</div>
        </div>
      </div>
    </section>

    <!-- UPCOMING EVENTS FULL WIDTH -->
    <section class="upcoming-section">
      <h3>Upcoming Events</h3>

      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div
          v-for="event in upcomingEvents"
          :key="event.id"
          class="upcoming-card-wrapper"
        >
          <div
            class="upcoming-card"
            :style="event.photoURL ? { backgroundImage: `url(${event.photoURL})` } : {}"
          >
            <div class="card-overlay">
              <div class="card-content">
                <span class="card-date">
                  {{ formatShortDate(event.date) }} at {{ event.time || 'TBA' }}
                </span>
                <h4 class="card-title">{{ event.name }}</h4>
                <span class="card-type">
                  {{ event.eventType === 'service' ? 'Service' : 'CCF Event' }}
                  &middot; {{ event.eventLocation || 'Online' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-upcoming-box">
        <p>No upcoming events scheduled.</p>
      </div>
    </section>

    <!-- CALENDAR MODAL -->
    <Modal v-if="showCalendar" @close="showCalendar = false" size="xl">
      <!-- passing is-member to tell the calendar to hide create/edit/delete UI for members -->
      <CalendarModal :is-member="true" @close="showCalendar = false" />
    </Modal>
  </div>
</template>

<style scoped>
.member-dashboard-container {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
}

/* Header */
.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
}
.member-header h1 {
  margin: 0;
  font-size: 26px;
  color: #37474F;
}
.sub {
  color: #78909C;
  margin-top: 4px;
}
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* icon button used for calendar / notifications */
.icon-btn {
  position: relative;
  background: #fff;
  color: #37474F;
  border: 1px solid transparent;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* badge positioned over the icon */
.notif-count {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #D32F2F;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  padding: 2px 6px;
  line-height: 1;
}

/* Sliding notifications panel */
.notif-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 1200;
  display: flex;
  align-items: stretch;
}
.notifications-panel {
  width: 340px;
  max-width: 80%;
  background: #fff;
  box-shadow: 2px 0 12px rgba(0,0,0,0.12);
  transform: translateX(0);
  animation: slideIn 220ms ease-out;
  display: flex;
  flex-direction: column;
}
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.notif-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding: 12px 16px;
  border-bottom: 1px solid #F1F5F9;
}
.notif-header h4 { margin:0; }
.close-btn { background:none; border:none; font-size:16px; cursor:pointer; }
.notif-body { padding: 12px 16px; overflow-y: auto; }
.notif-intro { color: #546E7A; margin: 0 0 12px 0; font-size: 13px; }
.notif-list { display:flex; flex-direction:column; gap: 12px; }
.notif-item { padding: 10px; border-radius: 8px; background: #FBFBFD; border: 1px solid #F1F5F9; }
.notif-meta { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:6px; }
.notif-title { font-weight:700; color:#1F2937; }
.notif-date { font-size:12px; color:#94A3B8; white-space:nowrap; }
.notif-message { color:#334155; font-size:14px; }
.notif-empty { text-align:center; color:#94A3B8; padding: 20px 0; }

/* Important notifications area above events */
.important-notifs { margin-bottom: 16px; }
.important-notifs h3 { margin-bottom: 12px; }
.important-list { display:flex; flex-direction:column; gap:12px; }
.important-card { background:#FFF7F7; border:1px solid #FDECEA; padding:12px; border-radius:8px; }
.imp-row { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
.imp-title { font-weight:700; color:#B91C1C; }
.imp-date { font-size:12px; color:#94A3B8; }
.imp-body { color:#7F1D1D; font-size:14px; }

/* Upcoming Events — full width */
.upcoming-section {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.upcoming-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
  font-weight: 700;
}
.events-scroll-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcoming-card-wrapper {
  width: 100%;
}
.upcoming-card {
  width: 100%;
  height: 150px;
  border-radius: 12px;
  background-color: #37474F;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
  transition: transform 0.2s ease;
}
.upcoming-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}

.card-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%);
  display: flex;
  align-items: center;
  padding: 16px;
}

.card-content { color: white; width: 100%; }
.card-date {
  font-size: 16px;
  font-weight: 700;
  color: #FFCA28;
  display: block;
  margin-bottom: 4px;
}
.card-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-type {
  font-size: 14px;
  opacity: 0.8;
  text-transform: uppercase;
  margin-top: 4px;
  display: block;
}

.no-upcoming-box {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #CFD8DC;
  color: #78909C;
}

/* Responsive */
@media (max-width: 768px) {
  .upcoming-card { height: 120px; }
  .card-title { font-size: 18px; }
}
</style>
