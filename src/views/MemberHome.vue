<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { Calendar, MapPin, QrCode, BarChart2, Clock, Info, X } from 'lucide-vue-next'

const authStore = useAuthStore()
const eventsStore = useEventsStore()
const router = useRouter()

const memberProfile = computed(() => authStore.userProfile)

// --- MODAL STATE ---
const showEventModal = ref(false)
const selectedEvent = ref(null)

onMounted(() => {
  eventsStore.fetchEvents()
})

const todayEvent = computed(() => eventsStore.currentEvent)

// Filter for upcoming events (Future dates)
const upcomingEvents = computed(() => {
  const now = new Date()
  now.setHours(0,0,0,0)
  return eventsStore.allEvents
    .filter(e => new Date(e.date) >= now && e.id !== todayEvent.value?.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

// --- OPEN EVENT DETAILS ---
function openEventDetails(event) {
  selectedEvent.value = event
  showEventModal.value = true
}

// Helpers
function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('default', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="home-view">
    
    <!-- Quick Actions Grid -->
    <section class="quick-actions">
      <div class="action-card" @click="router.push('/member/qr')">
        <div class="icon-bg blue"><QrCode :size="20" color="#1976D2"/></div>
        <span>Show QR</span>
      </div>
      <div class="action-card" @click="router.push('/member/attendance')">
        <div class="icon-bg orange"><BarChart2 :size="20" color="#F57C00"/></div>
        <span>Attendance</span>
      </div>
      <!-- Dgroup Meet button removed -->
    </section>

    <!-- Today's Event Snapshot -->
    <section 
      v-if="todayEvent" 
      class="today-card" 
      :class="{ 'has-bg': todayEvent.photoURL }"
      :style="todayEvent.photoURL ? { backgroundImage: `url(${todayEvent.photoURL})` } : {}"
      @click="openEventDetails(todayEvent)"
    >
      <div class="today-overlay">
        <div class="badge">HAPPENING TODAY</div>
        <h3>{{ todayEvent.name }}</h3>
        <div class="event-meta">
          <div class="meta-item">
            <Calendar :size="14" /> {{ formatShortDate(todayEvent.date) }}
          </div>
          <div class="meta-item">
            <Clock :size="14" /> {{ todayEvent.time || 'TBA' }}
          </div>
        </div>
      </div>
    </section>

    <section v-else class="today-card empty">
      <h3>No Event Today</h3>
      <p>Rest and recharge! See you at the next service.</p>
    </section>

    <!-- Upcoming Events -->
    <section class="section-block">
      <div class="section-header">
        <h3>Upcoming Events</h3>
      </div>

      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div
          v-for="event in upcomingEvents"
          :key="event.id"
          class="upcoming-card-wrapper"
          @click="openEventDetails(event)"
        >
          <div
            class="upcoming-card"
            :style="event.photoURL ? { backgroundImage: `url(${event.photoURL})` } : {}"
          >
            <div class="card-overlay">
              <div class="card-content">
                <span class="card-date">
                  {{ formatShortDate(event.date) }}
                </span>
                <h4 class="card-title">{{ event.name }}</h4>
                <span class="card-type">
                  <MapPin :size="10" /> {{ event.eventLocation || 'Main Hall' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-text">
        No upcoming events scheduled.
      </div>
    </section>

    <!-- My Dgroup Schedule Section Removed -->

    <!-- EVENT DETAILS MODAL -->
    <div v-if="showEventModal && selectedEvent" class="modal-overlay" @click.self="showEventModal = false">
      <div class="modal event-modal">
        
        <!-- Image Header (Displays the Manager's Uploaded Photo) -->
        <div 
          class="modal-hero"
          :style="selectedEvent.photoURL ? { backgroundImage: `url(${selectedEvent.photoURL})` } : {}"
          :class="{ 'no-img': !selectedEvent.photoURL }"
        >
          <button class="close-icon-btn" @click="showEventModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-content">
          <div class="modal-header-text">
            <span class="modal-date">{{ formatShortDate(selectedEvent.date) }}</span>
            <h2>{{ selectedEvent.name }}</h2>
          </div>

          <div class="modal-details">
            <div class="detail-row">
              <Clock :size="18" class="icon" />
              <div class="detail-text">
                <span class="label">Time</span>
                <span class="val">{{ selectedEvent.time || 'TBA' }}</span>
              </div>
            </div>

            <div class="detail-row">
              <MapPin :size="18" class="icon" />
              <div class="detail-text">
                <span class="label">Location</span>
                <span class="val">{{ selectedEvent.eventLocation || 'Main Sanctuary' }}</span>
              </div>
            </div>

            <div class="detail-row desc">
              <Info :size="18" class="icon" />
              <div class="detail-text">
                <span class="label">About</span>
                <p class="description">{{ selectedEvent.description || 'No description provided.' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.home-view { display: flex; flex-direction: column; gap: 24px; }

/* Quick Actions */
.quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
.action-card { background: white; padding: 16px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.1s; }
.action-card:active { transform: scale(0.98); }
.icon-bg { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.icon-bg.blue { background: #E3F2FD; }
.icon-bg.orange { background: #FFF3E0; }
.action-card span { font-size: 12px; font-weight: 600; color: #455A64; }

/* Today Card */
.today-card {
  background: linear-gradient(135deg, #1565C0, #1976D2);
  color: white;
  border-radius: 20px;
  box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
  position: relative;
  overflow: hidden;
  min-height: 140px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
}
.today-card.has-bg .today-overlay {
  background: linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3));
}
.today-overlay {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.today-card.empty { background: white; color: #455A64; border: 1px solid #ECEFF1; box-shadow: none; padding: 20px; cursor: default; }
.badge { background: rgba(255,255,255,0.2); font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; width: fit-content; }
.today-card h3 { margin: 0 0 10px 0; font-size: 20px; }
.event-meta { display: flex; gap: 15px; font-size: 13px; opacity: 0.9; }
.meta-item { display: flex; align-items: center; gap: 6px; }

/* UPCOMING EVENTS SCROLL CONTAINER */
.section-header h3 { font-size: 18px; color: #37474F; margin: 0 0 12px 0; }
.events-scroll-container {
  display: flex;
  overflow-x: auto;
  gap: 12px;
  padding-bottom: 10px; /* Space for scrollbar */
  -webkit-overflow-scrolling: touch;
}
.upcoming-card-wrapper {
  flex: 0 0 100%; /* Fixed width for cards */
}
.upcoming-card {
  height: 120px;
  border-radius: 16px;
  background-color: #CFD8DC; /* Fallback color */
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  cursor: pointer;
}
.card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 12px;
  color: white;
  height: 50%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.card-date { font-size: 10px; font-weight: 700; color: #64B5F6; text-transform: uppercase; display: block; margin-bottom: 2px; }
.card-title { margin: 0 0 4px 0; font-size: 14px; line-height: 1.2; font-weight: 600; }
.card-type { font-size: 10px; color: #B0BEC5; display: flex; align-items: center; gap: 4px; }
.empty-text { color: #90A4AE; font-style: italic; font-size: 13px; }

/* EVENT MODAL */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; }
.event-modal { background: white; width: 90%; max-width: 400px; border-radius: 20px; overflow: hidden; position: relative; max-height: 90vh; overflow-y: auto; }

.modal-hero {
  height: 180px;
  background-color: #1565C0;
  background-size: cover;
  background-position: center;
  position: relative;
}
.modal-hero.no-img {
  background: linear-gradient(135deg, #1565C0, #1976D2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-hero.no-img::after {
  content: "WKND";
  font-weight: 900;
  font-size: 40px;
  color: rgba(255,255,255,0.2);
}

.close-icon-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(0,0,0,0.3);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.modal-content { padding: 24px; }
.modal-header-text { margin-bottom: 20px; }
.modal-date { color: #1976D2; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.modal-header-text h2 { margin: 4px 0 0 0; font-size: 24px; color: #263238; line-height: 1.2; }

.modal-details { display: flex; flex-direction: column; gap: 16px; }
.detail-row { display: flex; gap: 12px; align-items: flex-start; }
.icon { color: #90A4AE; margin-top: 2px; flex-shrink: 0; }
.detail-text { display: flex; flex-direction: column; }
.detail-text .label { font-size: 11px; text-transform: uppercase; color: #90A4AE; font-weight: 700; }
.detail-text .val { font-size: 14px; color: #37474F; font-weight: 600; }
.detail-text .description { font-size: 14px; color: #546E7A; line-height: 1.5; margin: 4px 0 0 0; }
</style>