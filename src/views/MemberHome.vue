<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { MapPin, QrCode, BarChart2, Clock, Info, X, Sparkles, Plus, ClipboardCheck } from 'lucide-vue-next'
import DgroupMeetingModal from '../components/memberComponents/DgroupMeetingModal.vue'
import DgroupAttendanceModal from '../components/memberComponents/DgroupAttendanceModal.vue'
import { useMembersStore } from '../stores/members'
import { useDgroupEventsStore } from '../stores/dgroupevents'

const router = useRouter()
const authStore = useAuthStore()
const eventsStore = useEventsStore()
// local YYYY-MM-DD helper (use local date to avoid UTC shift issues)
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
  // prefer profile finalTags, fallback to membersStore lookup
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
  // ignore meetings that have been ended
  return dgroupMeetings.value.find(m => m.meetingDate === today && !m.ended)
})

const dgroupMembersForModal = computed(() => {
  const dgid = memberProfile.value?.dgroupId
  if (!dgid) return []
  return membersStore.activeMembers.filter(m => m.dgroupId === dgid)
})

const upcomingDgroupMeetings = computed(() => {
  const today = localYMD()
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

// scheduling modal handled in separate component

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
        <div class="header-flex"><Sparkles :size="20" color="#FBC02D" class="pulse" /> <h3>Discover Your Community</h3></div>
      </div>
      
      <div class="hero-stack">
        <DiscoveryCard 
          title="WKND"
          subtitle="EVERY OTHER WEEK SERVICES"
          description="Experience the energy of our weekend gatherings."
          detailedDesc="Join us for WKND services every other week as we gather for worship, teaching, and fellowship. It’s a space to recharge and connect."
          image="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1000"
          accent="red"
          @click="router.push('/member/dgroup')"
        />
        <DiscoveryCard 
          title="ELEVATE"
          subtitle="YOUTH MINISTRY"
          description="The best way to spend your youth. High school and college community."
          detailedDesc="Elevate is the student movement of CCF. We're here to help students live their lives to the fullest by following Jesus."
          image="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1000"
          accent="blue"
          @click="router.push('/member/dgroup')"
        />
        <DiscoveryCard 
          title="B1G SINGLES"
          subtitle="SINGLES MINISTRY"
          description="Be One with God. Navigate singlehood with purpose."
          detailedDesc="B1G is designed for young professionals and single adults. Find a community that understands your season of life."
          image="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1000"
          accent="green"
          @click="router.push('/member/dgroup')"
        />
      </div>
    </section>

    <section class="quick-actions">
      <div class="action-card action-blue" @click="router.push('/member/qr')">
        <div class="icon-bg blue"><QrCode :size="22" color="#1E88E5"/></div>
        <span>Show QR</span>
      </div>
      <div class="action-card action-green" @click="router.push('/member/attendance')">
        <div class="icon-bg green"><BarChart2 :size="22" color="#43A047"/></div>
        <span>Attendance</span>
      </div>
      <div v-if="isDgroupLeader" :class="['action-card action-yellow', { disabled: !todayMeeting } ]" :aria-disabled="!todayMeeting" @click="todayMeeting ? showAttendanceModal = true : null">
        <div class="icon-bg yellow"><ClipboardCheck :size="22" :color="todayMeeting ? '#FBC02D' : '#90A4AE'"/></div>
        <span>{{ todayMeeting ? 'Log Meeting' : 'No Active Meeting' }}</span>
      </div>
      <div v-if="isDgroupLeader" class="action-card action-red" @click="showScheduleDgroupModal = true" title="Schedule weekly meetings">
        <div class="icon-bg red"><Plus :size="22" color="#E53935"/></div>
        <span>Schedule Dgroup</span>
      </div>
    </section>

    <DgroupMeetingModal
      v-if="showScheduleDgroupModal"
      @close="showScheduleDgroupModal = false"
      @scheduled="() => { showScheduleDgroupModal = false }"
    />

    <section v-if="todayEvent || todayMeeting" class="today-section">
      <div v-if="todayEvent" class="today-card main-event" :class="{ 'has-bg': todayEvent.photoURL }" :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}" @click="openEventDetails(todayEvent)">
        <div class="today-overlay">
          <div class="badge-status bg-red">HAPPENING TODAY</div>
          <h2 class="shadow-text">{{ todayEvent.name }}</h2>
        </div>
      </div>

      <div v-if="todayMeeting" class="today-card dgroup" @click="showAttendanceModal = true" :title="'Log attendance for ' + (todayMeeting.meetingTitle || 'Dgroup Meeting')">
        <div class="today-overlay dgroup-overlay">
          <div class="badge-status bg-yellow">DGROUP MEETING</div>
          <h2 class="meeting-title">{{ todayMeeting.meetingTitle || 'Dgroup Meeting' }}</h2>
          <div class="dgroup-meta"><Clock :size="14" /> {{ todayMeeting.meetingDate }} <span v-if="todayMeeting.meetingTime">• {{ todayMeeting.meetingTime }}</span></div>
          <div class="dgroup-venue"><MapPin :size="14" /> {{ todayMeeting.venue || 'TBD' }}</div>
        </div>
      </div>
    </section>
    <section v-else class="today-card empty-state">
      <div class="empty-icon"><Sparkles :size="32" color="#B0BEC5" /></div>
      <h3>No Events Today</h3>
      <p>Enjoy your day! Check back soon for updates.</p>
    </section>

    <div class="section-header"><h3>Upcoming Events</h3></div>
    <div class="upcoming-column">
      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div v-for="event in upcomingEvents" :key="event.id" class="upcoming-card-wrapper">
          <div class="upcoming-card event-accent-blue" @click="openEventDetails(event)">
            <div class="card-media">
              <img v-if="event.photoURL" :src="event.photoURL" alt="event image" />
              <div v-else class="card-media-placeholder"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQu0jzHfqdWdZJdLeogBZoboqMz9-_SuJyuEw&s" alt="Elevate WKND" /></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date">{{ formatShortDate(event.date) }} <span v-if="event.time">• {{ event.time }}</span></div>
              <div class="card-line card-title">{{ event.name }}</div>
              <div class="card-tag">{{ event.eventType === 'service' ? 'Service' : (event.eventType === 'b1g_event' ? 'B1G Service' : 'CCF Event') }}</div>
              <div class="card-meta-row"><MapPin :size="12" /><span>{{ event.eventLocation || 'Online' }}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">No upcoming events scheduled.</div>
    </div>

    <div class="section-header" style="margin-top:8px;"><h3>Upcoming Dgroups</h3></div>
    <div class="upcoming-column">
      <div v-if="meetingsLoading" class="empty-text">Loading meetings…</div>
      <div v-else-if="upcomingDgroupMeetings.length > 0" class="events-scroll-container">
        <div v-for="m in upcomingDgroupMeetings" :key="m.id || m.meetingDate" class="upcoming-card-wrapper">
          <div class="upcoming-card dgroup-accent-purple">
            <div class="card-media">
              <div v-if="m.photoURL" style="width:100%;height:100%;"><img :src="m.photoURL" alt="meeting image" style="width:100%;height:100%;object-fit:cover;"/></div>
              <div v-else class="card-media-placeholder dgroup-grad"><img src="https://via.placeholder.com/400x220?text=Dgroup+Meeting" alt="placeholder"/></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date text-purple">{{ m.meetingDate }} <span v-if="m.meetingTime">• {{ m.meetingTime }}</span></div>
              <div class="card-line card-title">{{ m.meetingTitle || 'Dgroup Meeting' }}</div>
              <div class="card-tag purple">Dgroup</div>
              <div class="card-meta-row"><MapPin :size="12" /><span>{{ m.venue || 'TBD' }}</span></div>
              <div v-if="m.dgroupleader" class="card-minor">Leader: {{ m.dgroupleader }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">No upcoming Dgroup meetings scheduled.</div>
    </div>

    <DgroupAttendanceModal
      v-if="showAttendanceModal && isDgroupLeader"
      :group="{ dgroupId: memberProfile.value?.dgroupId, dgroupName: memberProfile.value?.dgroupName }"
      :members="dgroupMembersForModal"
      :meeting="todayMeeting"
      @close="showAttendanceModal = false"
      @saved="() => { showAttendanceModal = false }"
    />

    <div v-if="showEventModal && selectedEvent" class="modal-overlay" @click.self="showEventModal = false">
      <div class="modal event-modal">
        <div class="modal-hero" :style="selectedEvent.photoURL ? { backgroundImage: `url(${selectedEvent.photoURL})` } : {}" :class="{ 'no-img': !selectedEvent.photoURL }">
          <button class="close-icon-btn" @click="showEventModal = false"><X :size="20" /></button>
          <div class="modal-hero-badge">{{ formatShortDate(selectedEvent.date) }}</div>
        </div>
        <div class="modal-content">
          <div class="modal-header-text">
            <h2>{{ selectedEvent.name }}</h2>
          </div>
          <div class="modal-details">
            <div class="detail-row"><div class="icon-circle"><Clock :size="16" /></div><div class="detail-text"><span class="label">Time</span><span class="val">{{ selectedEvent.time || 'TBA' }}</span></div></div>
            <div class="detail-row"><div class="icon-circle"><MapPin :size="16" /></div><div class="detail-text"><span class="label">Location</span><span class="val">{{ selectedEvent.eventLocation || 'To be updated.' }}</span></div></div>
            <div class="detail-row desc"><div class="icon-circle"><Info :size="16" /></div><div class="detail-text"><span class="label">About</span><p class="description">{{ selectedEvent.description || 'No description provided.' }}</p></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view { display: flex; flex-direction: column; gap: 24px; padding-bottom: 30px; background: #FAFAFA; }
.header-flex { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.section-header h3 { font-size: 18px; color: #1A237E; font-weight: 800; letter-spacing: -0.5px; }
.hero-stack { display: flex; flex-direction: column; gap: 16px; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.action-card { background: #ffffff; padding: 20px 16px; border-radius: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; }
.action-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
.action-card span { font-size: 13px; font-weight: 700; color: #263238; text-align: center; line-height: 1.2; }
.icon-bg { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
.action-card:hover .icon-bg { transform: scale(1.1); }
.icon-bg.blue { background: #E3F2FD; } .icon-bg.green { background: #E8F5E9; } .icon-bg.yellow { background: #FFFDE7; } .icon-bg.red { background: #FFEBEE; }
.action-blue:hover { border-color: #83b8db; } .action-green:hover { border-color: #A5D6A7; } .action-yellow:hover { border-color: #FFF59D; } .action-red:hover { border-color: #EF9A9A; }
.today-section { display: flex; flex-direction: column; gap: 14px; }
.today-card { border-radius: 24px; position: relative; overflow: hidden; min-height: 160px; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.12); border: 1px solid rgba(255,255,255,0.1); }
.main-event { background: linear-gradient(135deg, #1E88E5, #1565C0); }
.today-overlay { padding: 24px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%); color: white; }
.today-card.dgroup { background: linear-gradient(135deg, #4527A0, #311B92); }
.badge-status { font-size: 10px; font-weight: 900; padding: 5px 10px; border-radius: 50px; margin-bottom: 10px; letter-spacing: 1px; color: white; display: inline-block; }
.bg-red { background: #E53935; box-shadow: 0 2px 8px rgba(229, 57, 53, 0.4); }
.bg-yellow { background: #FBC02D; color: #1A237E; box-shadow: 0 2px 8px rgba(251, 192, 45, 0.4); }
.meeting-title { font-size: 22px; font-weight: 800; margin: 0 0 8px 0; }
.dgroup-meta, .dgroup-venue { font-size: 13px; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-weight: 500; }
.empty-state { background: white; color: #78909C; padding: 40px 24px; text-align: center; border: 2px dashed #ECEFF1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.empty-icon { margin-bottom: 16px; opacity: 0.5; }
.empty-state h3 { font-size: 18px; color: #455A64; margin: 0 0 8px 0; font-weight: 700; }
.empty-state p { font-size: 14px; margin: 0; }
.events-scroll-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 4px 4px 16px 4px; }
.upcoming-card { border-radius: 20px; background: white; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; display: flex; flex-direction: column; height: 100%; border: 1px solid #F5F5F5; }
.upcoming-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
.card-media { height: 180px; position: relative; overflow: hidden; }
.card-media img { width: 100%; height: 100%; object-fit: cover; }
.card-details { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.card-date { font-size: 13px; font-weight: 800; color: #1E88E5; text-transform: uppercase; }
.card-title { font-size: 17px; font-weight: 800; color: #1A237E; line-height: 1.25; }
.card-tag { display: inline-block; align-self: flex-start; padding: 4px 10px; background: #E3F2FD; color: #1565C0; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
.card-tag.purple { background: #EDE7F6; color: #4527A0; }
.card-meta-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #546E7A; margin-top: auto; font-weight: 500; }
.card-minor { font-size: 12px; color: #90A4AE; font-style: italic; }
.modal-overlay { position: fixed; inset: 0; background: rgba(13, 71, 161, 0.4); backdrop-filter: blur(8px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.event-modal { background: white; width: 100%; max-width: 440px; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
.modal-hero { height: 240px; background-size: cover; background-position: center; position: relative; background-color: #1A237E; }
.modal-hero-badge { position: absolute; bottom: 16px; left: 24px; background: white; padding: 6px 14px; border-radius: 12px; font-weight: 900; color: #1A237E; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.close-icon-btn { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 1.5px solid rgba(255,255,255,0.3); border-radius: 14px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: all 0.2s; }
.close-icon-btn:hover { background: rgba(255,255,255,0.4); transform: rotate(90deg); }
.modal-content { padding: 32px 24px; }
.modal-header-text h2 { margin: 0 0 24px 0; font-size: 26px; color: #1A237E; font-weight: 900; line-height: 1.1; }
.modal-details { display: flex; flex-direction: column; gap: 24px; }
.detail-row { display: flex; align-items: flex-start; gap: 16px; }
.icon-circle { width: 36px; height: 36px; border-radius: 12px; background: #F5F7FF; display: flex; align-items: center; justify-content: center; color: #3F51B5; flex-shrink: 0; }
.detail-text .label { font-size: 10px; text-transform: uppercase; color: #90A4AE; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; display: block; }
.detail-text .val { font-size: 16px; color: #263238; font-weight: 700; }
.detail-text .description { font-size: 15px; color: #546E7A; line-height: 1.6; margin: 6px 0 0 0; font-weight: 400; }
.pulse { animation: pulse-animation 2s infinite; }
@keyframes pulse-animation { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
@media (max-width: 1024px) { .events-scroll-container { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .events-scroll-container { grid-template-columns: 1fr; } .quick-actions { grid-template-columns: 1fr 1fr; } .action-card { padding: 16px 10px; } .today-card { min-height: 140px; } .meeting-title { font-size: 18px; } }
.action-card.disabled { opacity: 0.5; filter: grayscale(1); cursor: not-allowed; pointer-events: none; }
</style>