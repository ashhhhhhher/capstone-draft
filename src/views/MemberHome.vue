<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { MapPin, QrCode, BarChart2, Clock, X, Sparkles, Plus, ClipboardCheck } from 'lucide-vue-next'
import DgroupMeetingModal from '../components/memberComponents/DgroupMeetingModal.vue'
import DgroupAttendanceModal from '../components/memberComponents/DgroupAttendanceModal.vue'
import { useMembersStore } from '../stores/members'
import { useDgroupEventsStore } from '../stores/dgroupevents'

const router = useRouter()
const authStore = useAuthStore()
const eventsStore = useEventsStore()

const memberProfile = computed(() => authStore.userProfile)
const isFirstTime = computed(() => !memberProfile.value?.dgroupId)
const showEventModal = ref(false)
const selectedEvent = ref(null)

const todayEvent = computed(() => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const ageCat = memberProfile.value?.finalTags?.ageCategory
  return eventsStore.allEvents.find(e => {
    if (!e.date) return false
    const eDate = new Date(e.date).toISOString().split('T')[0]
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
  const today = new Date().toISOString().split('T')[0]
  return dgroupMeetings.value.find(m => m.meetingDate === today && !m.ended)
})

const dgroupMembersForModal = computed(() => {
  const dgid = memberProfile.value?.dgroupId
  if (!dgid) return []
  return membersStore.activeMembers.filter(m => m.dgroupId === dgid)
})

const upcomingDgroupMeetings = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return (dgroupMeetings.value || [])
    .filter(m => m && m.meetingDate && m.meetingDate > today && !m.ended)
    .sort((a, b) => (a.meetingDate || '').localeCompare(b.meetingDate || ''))
})

function stopMeetingsListener() {
  if (typeof meetingsUnsub === 'function') { meetingsUnsub(); meetingsUnsub = null }
}

function startMeetingsListener(dgroupId) {
  stopMeetingsListener()
  if (!dgroupId) { dgroupMeetings.value = []; return }
  meetingsLoading.value = true
  meetingsUnsub = dgroupEventsStore.listenToDgroupMeetings(dgroupId, (items) => {
    dgroupMeetings.value = items || []
    meetingsLoading.value = false
  })
}

onMounted(() => {
  startMeetingsListener(memberProfile.value?.dgroupId)
  membersStore.fetchMembers()
})
watch(memberProfile, (v) => startMeetingsListener(v?.dgroupId))
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
    <section v-if="isFirstTime" class="discovery-section">
      <div class="section-header">
        <div class="header-flex"><Sparkles :size="18" color="#FBC02D" /> <h3>Discover Your Community</h3></div>
      </div>
      <div class="hero-stack">
        <DiscoveryCard title="WKND" subtitle="EVERY OTHER WEEK SERVICES" description="Experience the energy of our weekend gatherings." image="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1000" @click="router.push('/member/dgroup')" />
        <DiscoveryCard title="ELEVATE" subtitle="YOUTH MINISTRY" description="The best way to spend your youth." image="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1000" @click="router.push('/member/dgroup')" />
      </div>
    </section>

    <section class="quick-actions">
      <div class="action-card" @click="router.push('/member/qr')">
        <div class="icon-bg blue"><QrCode :size="20" color="#1976D2"/></div>
        <span>Show QR</span>
      </div>
      <div class="action-card" @click="router.push('/member/attendance')">
        <div class="icon-bg orange"><BarChart2 :size="20" color="#F57C00"/></div>
        <span>Attendance</span>
      </div>
      <div v-if="isDgroupLeader" :class="['action-card', { disabled: !todayMeeting } ]" @click="todayMeeting ? showAttendanceModal = true : null">
        <div class="icon-bg blue"><ClipboardCheck :size="20" :color="todayMeeting ? '#1976D2' : '#90A4AE'"/></div>
        <span>Log Dgroup Meeting</span>
      </div>
      <div v-if="isDgroupLeader" class="action-card" @click="showScheduleDgroupModal = true">
        <div class="icon-bg orange"><Plus :size="20" color="#F57C00"/></div>
        <span>Schedule Meeting</span>
      </div>
    </section>

    <DgroupMeetingModal v-if="showScheduleDgroupModal" @close="showScheduleDgroupModal = false" />

    <section v-if="todayEvent || todayMeeting" class="today-section">
      <div v-if="todayEvent" class="today-card" :class="{ 'has-bg': todayEvent.photoURL }" :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}" @click="openEventDetails(todayEvent)">
        <div class="today-overlay">
          <div class="badge">HAPPENING TODAY</div>
          <h2>{{ todayEvent.name }}</h2>
        </div>
      </div>
      <div v-if="todayMeeting" class="today-card dgroup" @click="showAttendanceModal = true">
        <div class="today-overlay dgroup-overlay">
          <h2 class="meeting-title">{{ todayMeeting.meetingTitle || 'Dgroup Meeting' }}</h2>
          <div class="badge">DGROUP MEETING</div>
          <div class="dgroup-meta">{{ todayMeeting.meetingDate }}</div>
        </div>
      </div>
    </section>

    <div class="section-header"><h3>Upcoming Events</h3></div>
    <div class="upcoming-column">
      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div v-for="event in upcomingEvents" :key="event.id" class="upcoming-card-wrapper">
          <div class="upcoming-card" @click="openEventDetails(event)">
            <div class="card-media">
              <img v-if="event.photoURL" :src="event.photoURL" alt="event" />
              <div v-else class="card-media-placeholder"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQu0jzHfqdWdZJdLeogBZoboqMz9-_SuJyuEw&s" /></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date">{{ formatShortDate(event.date) }}</div>
              <div class="card-line card-title">{{ event.name }}</div>
              <div class="card-line card-location">{{ event.eventLocation || 'Online' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DgroupAttendanceModal v-if="showAttendanceModal && isDgroupLeader" :group="{ dgroupId: memberProfile.value?.dgroupId, dgroupName: memberProfile.value?.dgroupName }" :members="dgroupMembersForModal" :meeting="todayMeeting" @close="showAttendanceModal = false" />

    <div v-if="showEventModal && selectedEvent" class="modal-overlay" @click.self="showEventModal = false">
      <div class="modal event-modal">
        <div class="modal-hero" :style="selectedEvent.photoURL ? { backgroundImage: `url(${selectedEvent.photoURL})` } : {}" :class="{ 'no-img': !selectedEvent.photoURL }">
          <button class="close-icon-btn" @click="showEventModal = false"><X :size="20" /></button>
        </div>
        <div class="modal-content">
          <div class="modal-header-text">
            <span class="modal-date">{{ formatShortDate(selectedEvent.date) }}</span>
            <h2>{{ selectedEvent.name }}</h2>
          </div>
          <div class="modal-details">
            <div class="detail-row"><Clock :size="18" class="icon" /><div class="detail-text"><span class="label">Time</span><span class="val">{{ selectedEvent.time || 'TBA' }}</span></div></div>
            <div class="detail-row"><MapPin :size="18" class="icon" /><div class="detail-text"><span class="label">Location</span><span class="val">{{ selectedEvent.eventLocation || 'To be updated.' }}</span></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view { display: flex; flex-direction: column; gap: 24px; padding-bottom: 30px; }
.header-flex { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.hero-stack { display: flex; flex-direction: column; gap: 16px; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.action-card { background: white; padding: 16px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; }
.icon-bg { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-bg.blue { background: #E3F2FD; }
.icon-bg.orange { background: #FFF3E0; }
.action-card span { font-size: 12px; font-weight: 600; color: #455A64; }
.today-card { background: linear-gradient(150deg, #53a2fc, #0046d2); color: white; border-radius: 20px; position: relative; overflow: hidden; min-height: 140px; background-size: cover; background-position: center; cursor: pointer; }
.today-overlay { padding: 20px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; background: rgba(0,0,0,0.4); }
.today-card.empty { background: white; color: #455A64; border: 1px solid #ECEFF1; padding: 20px; }
.today-section { display: flex; flex-direction: column; gap: 12px; }
.today-card.dgroup { background: linear-gradient(150deg, #1a0060, #5a3ad9); color: white; border-radius: 20px; position: relative; overflow: hidden; min-height: 140px; background-size: cover; background-position: center; cursor: pointer; }
.badge { color: #fa6e6e; font-size: 12px; font-weight: 800; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
.section-header h3 { font-size: 20px; color: #37474F; margin: 0; }
.empty-text { text-align: center; padding: 20px; color: #90A4AE; font-size: 14px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
.event-modal { background: white; width: 90%; max-width: 400px; border-radius: 24px; overflow: hidden; max-height: 90vh; overflow-y: auto; }
.modal-hero { height: 200px; background-size: cover; background-position: center; position: relative; }
.close-icon-btn { position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: white; z-index: 10; }
.modal-content { padding: 24px; }
.modal-date { color: #1976D2; font-weight: 800; font-size: 12px; text-transform: uppercase; }
.modal-header-text h2 { margin: 4px 0 16px 0; font-size: 24px; color: #263238; line-height: 1.2; }
.modal-details { display: flex; flex-direction: column; gap: 20px; }
.detail-row { display: flex; align-items: flex-start; gap: 14px; }
.detail-text .label { font-size: 11px; text-transform: uppercase; color: #90A4AE; font-weight: 700; }
.detail-text .val { font-size: 15px; color: #37474F; font-weight: 600; display: block; }
.events-scroll-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 6px 0 12px 0; }
.upcoming-card { width: 100%; height: 320px; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); cursor: pointer; display: flex; flex-direction: column; }
.card-media { width: 100%; height: 160px; background: #37474F; overflow: hidden; }
.card-media img { width: 100%; height: 100%; object-fit: cover; }
.card-details { padding: 12px 14px; color: #263238; display: flex; flex-direction: column; gap: 8px; }
.card-date { font-size: 14px; font-weight: 700; color: #1976D2; }
.card-title { font-size: 16px; font-weight: 700; color: #0D47A1; }
.action-card.disabled { opacity: 0.6; cursor: not-allowed; }
</style>