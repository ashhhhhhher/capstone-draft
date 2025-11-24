<script setup>
import { computed, onMounted } from 'vue'
import { useEventsStore } from '../stores/events'
import { useRouter } from 'vue-router'
import { Calendar, MapPin, QrCode, BarChart2 } from 'lucide-vue-next'

const eventsStore = useEventsStore()
const router = useRouter()

onMounted(() => {
  eventsStore.fetchEvents()
})

const todayEvent = computed(() => eventsStore.currentEvent)

const upcomingEvents = computed(() => {
  const now = new Date()
  now.setHours(0,0,0,0)
  return eventsStore.allEvents
    .filter(e => new Date(e.date) >= now && e.id !== todayEvent.value?.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)
})

function formatMonth(dateStr) { return new Date(dateStr).toLocaleString('default', { month: 'short' }) }
function formatDay(dateStr) { return new Date(dateStr).getDate() }
</script>

<template>
  <div class="home-view">
    
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

    <div class="dashboard-content">
      
      <section v-if="todayEvent" class="today-card">
        <div class="badge">HAPPENING TODAY</div>
        <h3>{{ todayEvent.name }}</h3>
        <div class="event-meta">
          <div class="meta-item"><Calendar :size="14" /> {{ todayEvent.date }}</div>
          <div class="meta-item"><MapPin :size="14" /> Main Sanctuary</div>
        </div>
      </section>
      
      <section v-else class="today-card empty">
        <h3>No Event Today</h3>
        <p>Rest and recharge! See you at the next service.</p>
      </section>

      <section class="section-block">
        <div class="section-header"><h3>Upcoming Events</h3></div>
        <div class="event-list">
          <div v-for="event in upcomingEvents" :key="event.id" class="event-item">
            <div class="date-box">
              <span class="month">{{ formatMonth(event.date) }}</span>
              <span class="day">{{ formatDay(event.date) }}</span>
            </div>
            <div class="event-info">
              <h4>{{ event.name }}</h4>
              <p class="desc">{{ event.description || 'Join us for fellowship and worship.' }}</p>
            </div>
          </div>
          <div v-if="upcomingEvents.length === 0" class="empty-text">No upcoming events scheduled.</div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.home-view { display: flex; flex-direction: column; gap: 24px; }

/* Quick Actions */
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.action-card { background: white; padding: 20px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.1s; }
.action-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.icon-bg { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.icon-bg.blue { background: #E3F2FD; }
.icon-bg.orange { background: #FFF3E0; }
.action-card span { font-size: 14px; font-weight: 600; color: #455A64; }

/* Dashboard Content */
.dashboard-content { display: flex; flex-direction: column; gap: 24px; }

/* Today Card */
.today-card { background: linear-gradient(135deg, #1565C0, #1976D2); color: white; padding: 24px; border-radius: 20px; box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3); }
.today-card.empty { background: white; color: #455A64; border: 1px solid #ECEFF1; box-shadow: none; }
.badge { background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 12px; }
.today-card h3 { margin: 0 0 12px 0; font-size: 22px; }
.event-meta { display: flex; gap: 20px; font-size: 14px; opacity: 0.9; }
.meta-item { display: flex; align-items: center; gap: 6px; }

/* List Styles */
.section-header h3 { font-size: 18px; color: #37474F; margin: 0 0 16px 0; }
.event-item { background: white; border-radius: 12px; padding: 16px; display: flex; gap: 16px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
.date-box { background: #E3F2FD; border-radius: 10px; width: 50px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #1565C0; flex-shrink: 0; }
.date-box .month { font-size: 10px; font-weight: 700; text-transform: uppercase; }
.date-box .day { font-size: 18px; font-weight: 700; line-height: 1; }
.event-info h4 { margin: 0 0 6px 0; font-size: 16px; color: #263238; }
.event-info .desc { margin: 0; font-size: 13px; color: #78909C; line-height: 1.4; }
.empty-text { text-align: center; color: #B0BEC5; font-style: italic; margin-top: 20px; }
</style>