<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { MapPin, QrCode, BarChart2, Clock, Info, X, Sparkles, Plus, ClipboardCheck, Calendar } from 'lucide-vue-next'
import DgroupMeetingModal from '../components/memberComponents/DgroupMeetingModal.vue'
import DgroupAttendanceModal from '../components/memberComponents/DgroupAttendanceModal.vue'
import BackgroundHero from '../components/dgmComponents/Background.vue'
import EventCard from '../components/dgmComponents/EventCard.vue' 
import { useMembersStore } from '../stores/members'
import { useDgroupEventsStore } from '../stores/dgroupevents'

const router = useRouter()
const authStore = useAuthStore()
const eventsStore = useEventsStore()

function localYMD(input) {
  const dt = input ? new Date(input) : new Date()
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const memberProfile = computed(() => authStore.userProfile)
const isFirstTime = computed(() => !memberProfile.value?.dgroupId)
const showEventModal = ref(false)
const selectedEvent = ref(null)

const todayEvent = computed(() => {
  const todayStr = localYMD()
  const ageCat = memberProfile.value?.finalTags?.ageCategory
  return eventsStore.allEvents.find(e => {
    if (!e.date) return false
    const eDate = localYMD(e.date)
    if (eDate !== todayStr) return false
    if (e.ended) return false
    if (!e.allowedAgeCategories || e.allowedAgeCategories.length === 0) return true
    return ageCat && e.allowedAgeCategories.includes(ageCat)
  })
})

const showScheduleDgroupModal = ref(false)
const dgroupEventsStore = useDgroupEventsStore()
const membersStore = useMembersStore()

const isDgroupLeader = computed(() => {
  const user = authStore.userProfile
  if (user?.finalTags?.isDgroupLeader) return true
  const me = membersStore.activeMembers.find(m => m.id === user?.id)
  return !!(me && me.finalTags && me.finalTags.isDgroupLeader)
})

const dgroupMeetings = ref([])
const meetingsLoading = ref(false)
let meetingsUnsub = null
const showAttendanceModal = ref(false)

const todayMeeting = computed(() => {
  const today = localYMD()
  return dgroupMeetings.value.find(m => m.meetingDate === today && !m.ended)
})

const dgroupMembersForModal = computed(() => {
  const leaderId = memberProfile.value?.id || null
  if (!leaderId) return []
  const downlines = membersStore.activeMembers.filter(m => m.dgroupLeaderId === leaderId)
  const leaderSelf = membersStore.activeMembers.find(m => m.id === leaderId)
  return leaderSelf ? [leaderSelf, ...downlines] : downlines
})

const upcomingDgroupMeetings = computed(() => {
  const today = localYMD()
  return (dgroupMeetings.value || [])
    .filter(m => m && m.meetingDate && m.meetingDate > today && !m.ended)
    .sort((a, b) => (a.meetingDate || '').localeCompare(b.meetingDate || ''))
})

function stopMeetingsListener() { if (typeof meetingsUnsub === 'function') { meetingsUnsub(); meetingsUnsub = null } }
function startMeetingsListener(dgroupLeaderId) {
  stopMeetingsListener()
  if (!dgroupLeaderId) { dgroupMeetings.value = []; return }
  meetingsLoading.value = true
  meetingsUnsub = dgroupEventsStore.listenToDgroupMeetings(dgroupLeaderId, (items) => {
    dgroupMeetings.value = items || []
    meetingsLoading.value = false
  })
}

function resolveMeetingLeaderId() {
  const user = authStore.userProfile
  if (!user) return null

  // If user is a leader → use their own ID
  if (user.finalTags?.isDgroupLeader) {
    return user.id
  }

  // If user is a member → use their leader's ID
  return user.dgroupLeaderId || null
}
onMounted(() => {
  const leaderId = resolveMeetingLeaderId()
  startMeetingsListener(leaderId)
  membersStore.fetchMembers()
})

watch(() => authStore.userProfile, () => {
  const leaderId = resolveMeetingLeaderId()
  startMeetingsListener(leaderId)
})
watch(memberProfile, (v) => startMeetingsListener(v?.id))
onUnmounted(() => stopMeetingsListener())

const upcomingEvents = computed(() => {
  const now = new Date(); now.setHours(0,0,0,0)
  const ageCat = memberProfile.value?.finalTags?.ageCategory
  return eventsStore.allEvents
    .filter(e => {
      if (!e.date) return false
      if (new Date(e.date) < now) return false
      if (e.ended) return false
      if (e.id === todayEvent.value?.id) return false
      if (!e.allowedAgeCategories || e.allowedAgeCategories.length === 0) return true
      return ageCat && e.allowedAgeCategories.includes(ageCat)
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

function openEventDetails(event) { selectedEvent.value = event; showEventModal.value = true }
function formatShortDate(dateStr) { if (!dateStr) return ''; return new Date(dateStr).toLocaleString('default', { month: 'short', day: 'numeric' }) }
</script>

<template>
  <div class="home-view">
    <BackgroundHero />

    <section v-if="isFirstTime" class="discovery-section">
      <div class="section-header">
        <div class="header-flex"><Sparkles :size="20" color="#FBC02D" class="pulse" /> <h3>Discover Your Community</h3></div>
      </div>
      <div class="hero-stack">
        <!-- DiscoveryCards Area -->
      </div>
    </section>

    <section class="quick-actions">
      <div class="action-card blue-theme" @click="router.push('/member/qr')">
        <div class="icon-wrap"><QrCode :size="24" /></div>
        <div class="action-label">Show QR</div>
        <div class="action-bg-glow"></div>
      </div>
      <div class="action-card green-theme" @click="router.push('/member/attendance')">
        <div class="icon-wrap"><BarChart2 :size="24" /></div>
        <div class="action-label">Attendance</div>
        <div class="action-bg-glow"></div>
      </div>
      <div v-if="isDgroupLeader" :class="['action-card yellow-theme', { disabled: !todayMeeting } ]" @click="todayMeeting ? showAttendanceModal = true : null">
        <div class="icon-wrap"><ClipboardCheck :size="24" /></div>
        <div class="action-label">{{ todayMeeting ? 'Log Meeting' : 'No Meeting' }}</div>
        <div class="action-bg-glow"></div>
      </div>
      <div v-if="isDgroupLeader" class="action-card red-theme" @click="showScheduleDgroupModal = true">
        <div class="icon-wrap"><Plus :size="24" /></div>
        <div class="action-label">Schedule</div>
        <div class="action-bg-glow"></div>
      </div>
    </section>

    <DgroupMeetingModal v-if="showScheduleDgroupModal" @close="showScheduleDgroupModal = false" />

    <div class="section-header"><h3><Calendar :size="18" /> Happening Today</h3></div>
    <section class="today-section">
      <div v-if="todayEvent" class="today-banner main-event" :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}" @click="openEventDetails(todayEvent)">
        <div class="banner-overlay">
          <div class="badge-pill pulse-badge">NOW HAPPENING</div>
          <h2 class="banner-title">{{ todayEvent.name }}</h2>
          <div class="banner-meta"><Clock :size="14" /> {{ todayEvent.time || 'All Day' }} <span class="dot"></span> <MapPin :size="14" /> {{ todayEvent.eventLocation || 'Main Hall' }}</div>
        </div>
      </div>

      <div v-if="todayMeeting" class="today-banner dgroup-theme" @click="showAttendanceModal = true">
        <div class="banner-overlay">
          <div class="badge-pill warning-pill">DGROUP SESSION</div>
          <h2 class="banner-title">{{ todayMeeting.meetingTitle || 'Dgroup Meeting' }}</h2>
          <div class="banner-meta"><Clock :size="14" /> {{ todayMeeting.meetingTime || 'Set Time' }} <span class="dot"></span> <MapPin :size="14" /> {{ todayMeeting.venue || 'TBD' }}</div>
        </div>
      </div>

      <div v-if="!todayEvent && !todayMeeting" class="empty-state-card">
        <div class="empty-icon-ring"><Sparkles :size="30" /></div>
        <h4>All quiet today!</h4>
        <p>Take this time to rest or catch up with your Dgroup mates.</p>
      </div>
    </section>

    <div class="section-header"><h3>Upcoming Events</h3></div>
    <section class="upcoming-column">
      <div v-if="upcomingEvents.length > 0" class="events-grid">
        <EventCard v-for="event in upcomingEvents" :key="event.id" :event="event" @click="openEventDetails" />
      </div>
      <div v-else class="empty-placeholder">No upcoming events found.</div>
    </section>

    <div class="section-header"><h3>Upcoming Dgroups</h3></div>
    <section class="upcoming-column">
      <div v-if="meetingsLoading" class="loading-state">Syncing meetings...</div>
      <div v-else-if="upcomingDgroupMeetings.length > 0" class="events-grid">
        <div v-for="m in upcomingDgroupMeetings" :key="m.id || m.meetingDate" class="mini-meeting-card">
          <div class="meeting-card-image">
            <img v-if="m.photoURL" :src="m.photoURL" alt="Dgroup" />
            <div v-else class="meeting-mesh"></div>
            <div class="meeting-date-tag">{{ formatShortDate(m.meetingDate) }}</div>
          </div>
          <div class="meeting-card-body">
            <h4 class="meeting-name">{{ m.meetingTitle || 'Dgroup Meeting' }}</h4>
            <div class="meeting-loc"><MapPin :size="12" /> {{ m.venue || 'TBD' }}</div>
            <div class="meeting-time-pill" v-if="m.meetingTime">{{ m.meetingTime }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-placeholder">No scheduled Dgroups.</div>
    </section>

    <DgroupAttendanceModal v-if="showAttendanceModal && isDgroupLeader" :group="{ dgroupId: memberProfile.value?.dgroupId }" :meeting="todayMeeting" @close="showAttendanceModal = false" />

    <!-- Event Detail Modal -->
    <div v-if="showEventModal && selectedEvent" class="modal-backdrop" @click.self="showEventModal = false">
      <div class="modern-modal">
        <div class="modal-cover" :style="selectedEvent.photoURL ? { backgroundImage: `url(${selectedEvent.photoURL})` } : {}">
          <div class="modal-cover-overlay"></div>
          <button class="modal-close-btn" @click="showEventModal = false"><X :size="20" /></button>
          <div class="modal-date-chip">{{ formatShortDate(selectedEvent.date) }}</div>
        </div>
        <div class="modal-body">
          <h2 class="modal-title">{{ selectedEvent.name }}</h2>
          <div class="modal-info-grid">
            <div class="modal-info-item"><div class="m-icon blue"><Clock :size="18" /></div><div class="m-text"><label>Time</label><span>{{ selectedEvent.time || 'TBA' }}</span></div></div>
            <div class="modal-info-item"><div class="m-icon red"><MapPin :size="18" /></div><div class="m-text"><label>Location</label><span>{{ selectedEvent.eventLocation || 'TBD' }}</span></div></div>
          </div>
          <div class="modal-about">
            <label><Info :size="14" /> About this event</label>
            <p>{{ selectedEvent.description || 'Join us for this special gathering. No specific details provided yet.' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view { display: flex; flex-direction: column; gap: 20px; padding-bottom: 60px; background: transparent; min-height: 100vh; font-family: 'Inter', system-ui, sans-serif; max-width: 1400px; margin: 0 auto; width: 100%; }
.section-header { padding: 8px 16px 0; }
.section-header h3 { font-size: 20px; color: #1e293b; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; margin: 0; }
.discovery-section, .quick-actions, .today-section, .upcoming-column { padding: 0 16px; width: 100%; box-sizing: border-box; }
.quick-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 10px; }
.action-card { position: relative; background: #fff; padding: 20px 12px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); overflow: hidden; width: 100%; }
.action-card:hover { transform: translateY(-6px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
.action-bg-glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%); opacity: 0; transition: opacity 0.4s; pointer-events: none; }
.action-card:hover .action-bg-glow { opacity: 0.08; }
.icon-wrap { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: var(--bg-color); color: var(--text-color); transition: transform 0.3s; z-index: 2; }
.action-card:hover .icon-wrap { transform: scale(1.1) rotate(-5deg); }
.action-label { font-size: 11px; font-weight: 800; color: #475569; z-index: 2; text-align: center; }
.blue-theme { --bg-color: #eff6ff; --text-color: #2563eb; --glow-color: #2563eb; }
.green-theme { --bg-color: #f0fdf4; --text-color: #16a34a; --glow-color: #16a34a; }
.yellow-theme { --bg-color: #fffbeb; --text-color: #d97706; --glow-color: #d97706; }
.red-theme { --bg-color: #fef2f2; --text-color: #dc2626; --glow-color: #dc2626; }
.action-card.disabled { opacity: 0.6; pointer-events: none; filter: grayscale(0.5); }
.today-section { display: flex; flex-direction: column; gap: 16px; }
.today-banner { position: relative; min-height: 180px; border-radius: 28px; overflow: hidden; background-color: #1e293b; background-size: cover; background-position: center; cursor: pointer; transition: transform 0.4s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.1); }
.banner-overlay { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0) 100%); padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; }
.badge-pill { align-self: flex-start; padding: 4px 10px; border-radius: 50px; font-size: 9px; font-weight: 900; letter-spacing: 0.05em; margin-bottom: 8px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2); }
.pulse-badge { background: rgba(239, 68, 68, 0.85); color: #fff; animation: soft-pulse 2s infinite; }
.warning-pill { background: rgba(245, 158, 11, 0.85); color: #fff; }
.banner-title { font-size: 22px; font-weight: 900; color: #fff; margin: 0 0 6px 0; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
.banner-meta { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; }
.dot { width: 4px; height: 4px; background: #fff; border-radius: 50%; opacity: 0.5; }
.dgroup-theme { background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); }
.empty-state-card { background: #fff; padding: 32px; border-radius: 28px; text-align: center; border: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-icon-ring { width: 60px; height: 60px; border-radius: 50%; background: #f8fafc; display: flex; align-items: center; justify-content: center; color: #94a3b8; }
.events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 8px 0 24px; }
.mini-meeting-card { background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modern-modal { background: #fff; width: 100%; max-width: 480px; border-radius: 32px; overflow: hidden; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.3); }
@keyframes soft-pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
@media (max-width: 768px) { .home-view { gap: 16px; } .quick-actions { grid-template-columns: repeat(2, 1fr); gap: 10px; } .section-header { padding: 8px 16px 0; } .discovery-section, .quick-actions, .today-section, .upcoming-column { padding: 0 16px; } .events-grid { grid-template-columns: 1fr; } .banner-title { font-size: 20px; } }
@media (max-width: 480px) { .home-view { gap: 12px; } .quick-actions { grid-template-columns: repeat(2, 1fr); gap: 8px; } .action-card { padding: 16px 10px; border-radius: 20px; } .icon-wrap { width: 40px; height: 40px; } .banner-overlay { padding: 16px; } .today-banner { min-height: 160px; border-radius: 24px; } }
</style>