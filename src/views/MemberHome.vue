<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { MapPin, QrCode, BarChart2, Clock, Info, X, Sparkles } from 'lucide-vue-next'
import DiscoveryCard from '../components/memberComponents/DiscoveryCard.vue' // [Imported the new component]

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
          title="CCF"
          subtitle="CHRIST'S COMMISSION FELLOWSHIP"
          description="Making Christ-committed followers who will make Christ-committed followers."
          detailedDesc="Join our main worship services and small groups. We focus on spiritual growth through intentional discipleship and biblical teaching."
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
    </section>

    <section v-if="todayEvent" class="today-card" :class="{ 'has-bg': todayEvent.photoURL }" :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}" @click="openEventDetails(todayEvent)">
      <div class="today-overlay">
        <div class="badge">HAPPENING TODAY</div>
        <h3>{{ todayEvent.name }}</h3>
      </div>
    </section>
    <section v-else class="today-card empty">
      <h3>No Event Today</h3>
      <p>Rest and recharge! See you at the next service.</p>
    </section>

    <div class="section-header"><h3>Upcoming Events</h3></div>
    <div class="upcoming-column">
      <div v-if="upcomingEvents.length > 0" class="hero-stack">
        <div v-for="event in upcomingEvents" :key="event.id" class="hero-card event-hero" :style="event.photoURL ? { backgroundImage: `url(${event.photoURL})` } : {}" @click="openEventDetails(event)">
          <div class="hero-overlay centered">
            <span class="hero-subtitle highlight">{{ formatShortDate(event.date) }}</span>
            <h2 class="hero-title small">{{ event.name }}</h2>
            <div class="hero-meta"><MapPin :size="12" /> {{ event.eventLocation}}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">No upcoming events scheduled.</div>
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
.header-flex { display: flex; align-items: center; gap: 8px; }
.hero-stack { display: flex; flex-direction: column; gap: 16px; }
.hero-card { position: relative; border-radius: 20px; overflow: hidden; min-height: 240px; display: flex; cursor: pointer; background-size: cover; background-position: center; transition: transform 0.2s; background-color: #263238; }
.hero-card:active { transform: scale(0.98); }
.hero-overlay { background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)); width: 100%; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: white; }
.hero-overlay.centered { justify-content: center; }
.hero-subtitle { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; }
.hero-subtitle.highlight { color: #64B5F6; opacity: 1; }
.hero-title { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; }
.hero-title.small { font-size: 20px; }
.hero-meta { font-size: 12px; opacity: 0.8; display: flex; align-items: center; gap: 4px; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.action-card { background: white; padding: 16px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; }
.icon-bg { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.icon-bg.blue { background: #E3F2FD; }
.icon-bg.orange { background: #FFF3E0; }
.action-card span { font-size: 12px; font-weight: 600; color: #455A64; }
.today-card { background: linear-gradient(135deg, #1565C0, #1976D2); color: white; border-radius: 20px; position: relative; overflow: hidden; min-height: 140px; background-size: cover; background-position: center; cursor: pointer; }
.today-overlay { padding: 20px; height: 100%; display: flex; flex-direction: column; justify-content: center; background: rgba(0,0,0,0.4); }
.today-card.empty { background: white; color: #455A64; border: 1px solid #ECEFF1; padding: 20px; }
.badge { background: #FBC02D; color: #000; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
.section-header h3 { font-size: 18px; color: #37474F; margin: 0 0 12px 0; }
.empty-text { text-align: center; padding: 20px; color: #90A4AE; font-size: 14px; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
.event-modal { background: white; width: 90%; max-width: 400px; border-radius: 24px; overflow: hidden; max-height: 90vh; overflow-y: auto; }
.modal-hero { height: 200px; background-size: cover; background-position: center; position: relative; }
.close-icon-btn { position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: white; }
.modal-content { padding: 24px; }
.modal-date { color: #1976D2; font-weight: 800; font-size: 12px; text-transform: uppercase; }
.modal-header-text h2 { margin: 4px 0 16px 0; font-size: 24px; color: #263238; line-height: 1.2; }
.modal-details { display: flex; flex-direction: column; gap: 20px; }
.detail-row { display: flex; gap: 14px; }
.detail-text .label { font-size: 11px; text-transform: uppercase; color: #90A4AE; font-weight: 700; letter-spacing: 0.5px; }
.detail-text .val { font-size: 15px; color: #37474F; font-weight: 600; }
.detail-text .description { font-size: 14px; color: #546E7A; line-height: 1.6; margin: 4px 0 0 0; }
</style>