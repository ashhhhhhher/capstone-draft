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
  const leaderId =
    memberProfile.value?.id || null

  if (!leaderId) return []

  const downlines = membersStore.activeMembers.filter(
    m => m.dgroupLeaderId === leaderId
  )

  // find the leader herself
  const leaderSelf = membersStore.activeMembers.find(
    m => m.id === leaderId
  )

  return leaderSelf
    ? [leaderSelf, ...downlines]
    : downlines
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
      :leader-id="memberProfile.value?.id"
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
.home-view { display: flex; flex-direction: column; gap: 24px; padding-bottom: 30px; background: #F8FAFC; min-height: 100vh; }
.header-flex { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.section-header h3 { font-size: 19px; color: #0F172A; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
.hero-stack { display: flex; flex-direction: column; gap: 16px; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.action-card { background: #ffffff; padding: 20px 16px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); border: 1px solid rgba(0,0,0,0.04); position: relative; overflow: hidden; }
.action-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.08); }
.action-card span { font-size: 13px; font-weight: 700; color: #334155; text-align: center; line-height: 1.3; z-index: 2; }
.icon-bg { width: 56px; height: 56px; border-radius: 20px; display: flex; align-items: center; justify-content: center; transition: transform 0.3s ease; z-index: 2; }
.action-card:hover .icon-bg { transform: scale(1.1) rotate(5deg); }

/* Colorful Action Cards */
.icon-bg.blue { background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); color: #1976D2; }
.icon-bg.green { background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); color: #388E3C; }
.icon-bg.yellow { background: linear-gradient(135deg, #FFFDE7 0%, #FFF9C4 100%); color: #FBC02D; }
.icon-bg.red { background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); color: #D32F2F; }

.action-blue:hover { border-color: #BBDEFB; background: linear-gradient(to bottom, #fff, #F0F9FF); }
.action-green:hover { border-color: #C8E6C9; background: linear-gradient(to bottom, #fff, #F1F8E9); }
.action-yellow:hover { border-color: #FFF9C4; background: linear-gradient(to bottom, #fff, #FFFDE7); }
.action-red:hover { border-color: #FFCDD2; background: linear-gradient(to bottom, #fff, #FFEBEE); }

.today-section { display: flex; flex-direction: column; gap: 16px; }
.today-card { border-radius: 28px; position: relative; overflow: hidden; min-height: 180px; cursor: pointer; box-shadow: 0 15px 35px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1); transition: transform 0.3s ease; }
.today-card:hover { transform: scale(1.01); }
.main-event { background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); }
.today-overlay { padding: 28px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; background: linear-gradient(to top, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0) 100%); color: white; }
.today-card.dgroup { background: linear-gradient(135deg, #673AB7 0%, #4527A0 100%); }
.badge-status { font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 50px; margin-bottom: 12px; letter-spacing: 0.5px; color: white; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); backdrop-filter: blur(4px); }
.bg-red { background: rgba(229, 57, 53, 0.9); }
.bg-yellow { background: rgba(251, 192, 45, 0.9); color: #1A237E; }
.meeting-title { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.dgroup-meta, .dgroup-venue { font-size: 14px; color: rgba(255,255,255,0.95); display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-weight: 500; }

.empty-state { background: white; color: #64748B; padding: 48px 24px; text-align: center; border-radius: 24px; border: 2px dashed #E2E8F0; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: none; }
.empty-icon { margin-bottom: 16px; opacity: 0.8; background: #F1F5F9; padding: 16px; border-radius: 50%; }
.empty-state h3 { font-size: 18px; color: #334155; margin: 0 0 8px 0; font-weight: 700; }
.empty-state p { font-size: 14px; margin: 0; max-width: 260px; line-height: 1.5; }

.events-scroll-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 8px 4px 24px 4px; }
.upcoming-card { border-radius: 24px; background: white; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.04); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); cursor: pointer; display: flex; flex-direction: column; height: 100%; border: 1px solid rgba(0,0,0,0.03); position: relative; }
.upcoming-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }

/* Accent lines for cards */
.upcoming-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: #E2E8F0; }
.event-accent-blue::after { background: #2196F3; }
.dgroup-accent-purple::after { background: #7E57C2; }

.card-media { height: 160px; position: relative; overflow: hidden; }
.card-media img { width: 100%; height: 100%; object-fit: cover; }
.card-details { padding: 18px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.card-date { font-size: 12px; font-weight: 800; color: #2196F3; text-transform: uppercase; letter-spacing: 0.5px; }
.card-date.text-purple { color: #7E57C2; }
.card-title { font-size: 17px; font-weight: 800; color: #1E293B; line-height: 1.3; }
.card-tag { display: inline-block; align-self: flex-start; padding: 5px 12px; background: #F1F5F9; color: #475569; border-radius: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
.card-tag.purple { background: #F3E5F5; color: #5E35B1; }
.card-meta-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748B; margin-top: auto; font-weight: 500; }
.card-minor { font-size: 12px; color: #94A3B8; font-style: italic; margin-top: 4px; }

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