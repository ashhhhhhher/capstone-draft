<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { MapPin, QrCode, BarChart2, Clock, Info, X, Sparkles, Plus, ClipboardCheck } from 'lucide-vue-next'
import Modal from '../components/dgmComponents/Modal.vue'
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
const scheduleDate = ref('')
const scheduleTime = ref('')
const scheduleVenue = ref('')
const scheduleDescription = ref('')
// meeting title field (previously called description in UI)
const scheduleTitle = ref('')
const scheduleStatus = ref({ type: '', message: '' })

const dgroupEventsStore = useDgroupEventsStore()

const dgroupMeetings = ref([])
const meetingsLoading = ref(false)
let meetingsUnsub = null

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

onMounted(() => startMeetingsListener(memberProfile.value?.dgroupId))
watch(memberProfile, (v) => startMeetingsListener(v?.dgroupId))
onUnmounted(() => stopMeetingsListener())

async function handleOpenSchedule() {
  showScheduleDgroupModal.value = true
  scheduleDate.value = ''
  scheduleTime.value = ''
  scheduleVenue.value = ''
  scheduleDescription.value = ''
  scheduleTitle.value = ''
  scheduleStatus.value = { type: '', message: '' }
}

async function handleScheduleSubmit() {
  // basic validation
  if (!scheduleDate.value || !scheduleTime.value || !scheduleVenue.value) {
    scheduleStatus.value = { type: 'error', message: 'Please fill required fields (date, time, venue).' }
    return
  }

  const dgroupId = memberProfile.value?.dgroupId
  if (!dgroupId) {
    scheduleStatus.value = { type: 'error', message: 'You are not assigned to a Dgroup.' }
    return
  }

  const payload = {
    meetingDate: scheduleDate.value,
    meetingTime: scheduleTime.value,
    venue: scheduleVenue.value,
    // support both meetingTitle (new) and description (legacy)
    meetingTitle: scheduleTitle.value || scheduleDescription.value
  }

  const res = await dgroupEventsStore.createDgroupEvent(dgroupId, payload)
  if (res && res.status === 'success') {
    showScheduleDgroupModal.value = false
  } else {
    scheduleStatus.value = { type: 'error', message: res.message || 'Failed to schedule meeting.' }
  }
}

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
        <DiscoveryCard 
          title="WKND"
          subtitle="EVERY OTHER WEEK SERVICES"
          description="Experience the energy of our weekend gatherings."
          detailedDesc="Join us for WKND services every other week as we gather for worship, teaching, and fellowship. It’s a space to recharge and connect."
          image="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1000"
          @click="router.push('/member/dgroup')"
        />
        <DiscoveryCard 
          title="ELEVATE"
          subtitle="YOUTH MINISTRY"
          description="The best way to spend your youth. High school and college community."
          detailedDesc="Elevate is the student movement of CCF. We're here to help students live their lives to the fullest by following Jesus."
          image="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1000"
          @click="router.push('/member/dgroup')"
        />
        <DiscoveryCard 
          title="B1G SINGLES"
          subtitle="SINGLES MINISTRY"
          description="Be One with God. Navigate singlehood with purpose."
          detailedDesc="B1G is designed for young professionals and single adults. Find a community that understands your season of life."
          image="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1000"
          @click="router.push('/member/dgroup')"
        />
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
      <div class="action-card disabled" aria-disabled="true">
        <div class="icon-bg blue"><ClipboardCheck :size="20" color="#90A4AE"/></div>
        <span>Log Dgroup Meeting</span>
      </div>
      <div class="action-card" @click="handleOpenSchedule" title="Schedule weekly meetings">
        <div class="icon-bg orange"><Plus :size="20" color="#F57C00"/></div>
        <span>Schedule Weekly Dgroup Meeting</span>
      </div>
    </section>

    <Modal v-if="showScheduleDgroupModal" @close="showScheduleDgroupModal = false">
      <div class="form-container">
        <div class="form-header">
          <h2>Schedule Weekly Dgroup Meeting</h2>
        </div>

        <div v-if="scheduleStatus.message" class="status-banner" :class="scheduleStatus.type">
          <span>{{ scheduleStatus.message }}</span>
        </div>

        <form class="form-body" @submit.prevent="handleScheduleSubmit">
          <div class="form-group">
            <label>Date</label>
            <input type="date" v-model="scheduleDate" required />
          </div>

          <div class="form-group">
            <label>Time</label>
            <input type="time" v-model="scheduleTime" required />
          </div>

          <div class="form-group">
            <label>Venue</label>
            <input v-model="scheduleVenue" required />
          </div>

          <div class="form-group">
            <label>Meeting Title</label>
            <input v-model="scheduleTitle" placeholder="e.g. Weekly Bible Study" />
          </div>

          <div class="actions" style="margin-top: 12px;">
            <button type="button" class="cancel" @click="showScheduleDgroupModal = false">Cancel</button>
            <button type="submit" class="confirm">Schedule</button>
          </div>
        </form>
      </div>
    </Modal>

    <section v-if="todayEvent" class="today-card" :class="{ 'has-bg': todayEvent.photoURL }" :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}" @click="openEventDetails(todayEvent)">
      <div class="today-overlay">
        <div class="badge">HAPPENING TODAY</div>
        <h2>{{ todayEvent.name }}</h2>
      </div>
    </section>
    <section v-else class="today-card empty">
      <h3>No Event Today</h3>
      <p>Rest and recharge! See you at the next event.</p>
    </section>

    <div class="section-header"><h3>Upcoming Events</h3></div>
    <div class="upcoming-column">
      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div v-for="event in upcomingEvents" :key="event.id" class="upcoming-card-wrapper">
          <div class="upcoming-card" @click="openEventDetails(event)">
            <div class="card-media">
              <img v-if="event.photoURL" :src="event.photoURL" alt="event image" />
              <div v-else class="card-media-placeholder"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQu0jzHfqdWdZJdLeogBZoboqMz9-_SuJyuEw&s" alt="Elevate WKND" /></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date">{{ formatShortDate(event.date) }} <span v-if="event.time">• {{ event.time }}</span></div>
              <div class="card-line card-title">{{ event.name }}</div>
              <div class="card-line card-type">{{ event.eventType === 'service' ? 'Service' : (event.eventType === 'b1g_event' ? 'B1G Service' : 'CCF Event') }}</div>
              <div class="card-line card-location"><strong>Location: </strong>{{ event.eventLocation || 'Online' }}</div>
              <div v-if="event.eventSpeaker" class="card-line card-minor"><strong>Speaker:</strong> {{ event.eventSpeaker }}</div>
              <div v-if="event.eventSeries" class="card-line card-minor"><strong>Series:</strong> {{ event.eventSeries }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">No upcoming events scheduled.</div>
    </div>

    <div class="section-header" style="margin-top:8px;"><h3>Upcoming Dgroup Meetings</h3></div>
    <div class="upcoming-column">
      <div v-if="meetingsLoading" class="empty-text">Loading meetings…</div>
      <div v-else-if="dgroupMeetings.length > 0" class="events-scroll-container">
        <div v-for="m in dgroupMeetings" :key="m.id || m.meetingDate" class="upcoming-card-wrapper">
          <div class="upcoming-card">
            <div class="card-media">
              <div v-if="m.photoURL" style="width:100%;height:100%;"><img :src="m.photoURL" alt="meeting image" style="width:100%;height:100%;object-fit:cover;"/></div>
              <div v-else class="card-media-placeholder"><img src="https://via.placeholder.com/400x220?text=Dgroup+Meeting" alt="placeholder"/></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date">{{ m.meetingDate }} <span v-if="m.meetingTime">• {{ m.meetingTime }}</span></div>
              <div class="card-line card-title">{{ m.meetingTitle || 'Dgroup Meeting' }}</div>
              <div class="card-line card-type">Dgroup Meeting</div>
              <div class="card-line card-location"><strong>Venue:</strong> {{ m.venue || 'TBD' }}</div>
              <div class="card-line card-minor">Leader: {{ m.dgroupleader || '—' }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">No upcoming Dgroup meetings scheduled.</div>
    </div>

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
            <div class="detail-row desc"><Info :size="18" class="icon" /><div class="detail-text"><span class="label">About</span><p class="description">{{ selectedEvent.description || 'No description provided.' }}</p></div></div>
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
.hero-card { position: relative; border-radius: 20px; overflow: hidden; min-height: 240px; display: flex; cursor: pointer; background-size: cover; background-position: center; transition: transform 0.2s; background-color: #263238; }
.hero-card:active { transform: scale(0.98); }
.hero-overlay { background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)); width: 100%; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: white; }
.hero-subtitle { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; }
.hero-subtitle.highlight { color: #64B5F6; opacity: 1; }
.hero-title { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; }
.hero-title.small { font-size: 20px; }
.hero-meta { font-size: 12px; opacity: 0.8; display: flex; align-items: center; gap: 4px; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.action-card { background: white; padding: 16px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; }
.icon-bg { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-bg.blue { background: #E3F2FD; }
.icon-bg.orange { background: #FFF3E0; }
.action-card span { font-size: 12px; font-weight: 600; color: #455A64; }
.today-card { background: linear-gradient(150deg, #53a2fc, #0046d2); color: white; border-radius: 20px; position: relative; overflow: hidden; min-height: 140px; background-size: cover; background-position: center; cursor: pointer; }
.today-overlay { padding: 20px; height: 100%; display: flex; flex-direction: column; justify-content: center; background: rgba(0,0,0,0.4); }
.today-card.empty { background: white; color: #455A64; border: 1px solid #ECEFF1; padding: 20px; }
.badge {color: #fa6e6e; font-size: 12px; font-weight: 800; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
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
.detail-row .icon { flex-shrink: 0; margin-top: 2px; }
.detail-text .label { font-size: 11px; text-transform: uppercase; color: #90A4AE; font-weight: 700; letter-spacing: 0.5px; }
.detail-text .val { font-size: 15px; color: #37474F; font-weight: 600; display: block; }
.detail-text .description { font-size: 14px; color: #546E7A; line-height: 1.6; margin: 4px 0 0 0; }

/* Upcoming event cards (aligned with Home.vue style) */
.events-scroll-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 6px 0 12px 0; }
.upcoming-card-wrapper { width: 100%; }
.upcoming-card { width: 100%; height: 400px; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); transition: transform 0.18s ease; cursor: pointer; display: flex; flex-direction: column; }
.upcoming-card:hover { transform: translateY(-6px); box-shadow: 0 10px 20px rgba(0,0,0,0.12); }
.card-media { width: 100%; height: 220px; background: #37474F; display: block; overflow: hidden; flex: 0 0 auto; }
.card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-media-placeholder::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.0) 100%); pointer-events: none; }
.card-media-placeholder { width:100%; height:100%; background: linear-gradient(90deg,#37474F,#546E7A); position: relative;}
.card-details { padding: 12px 14px; color: #263238; display: flex; flex-direction: column; gap: 8px; }
.card-line { display: block; }
.card-date { font-size: 14px; font-weight: 700; color: #1976D2; }
.card-title { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 700; color: #0D47A1; display: block; overflow: hidden; word-wrap: break-word; }
.card-type { font-size: 13px; opacity: 0.9; text-transform: uppercase; margin-top: 2px; color: #37474F; }
.card-location { font-size: 14px; color: #37474F; }
.card-minor { font-size: 13px; color: #546E7A; }
@media (max-width: 1024px) { .events-scroll-container { grid-template-columns: repeat(2, 1fr); } .card-media { height: 200px; } }
@media (max-width: 768px) { .events-scroll-container { grid-template-columns: repeat(2, 1fr); } .card-media { height: 170px; } .card-title { font-size: 16px; } }
@media (max-width: 480px) { .events-scroll-container { grid-template-columns: 1fr; } .card-media { height: 120px; } }

/* Disabled action card */
.action-card.disabled { opacity: 0.6; cursor: not-allowed; }
.action-card.disabled .icon-bg { background: #F5F5F5; }
</style>