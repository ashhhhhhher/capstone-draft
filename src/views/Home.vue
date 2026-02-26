<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useNotificationsStore } from '../stores/notifications'
import { useRouter } from 'vue-router'
import AppHeader from '../components/dgmComponents/AppHeader.vue'
import CurrentEvent from '../components/dgmComponents/CurrentEvent.vue'
import AttendanceStats from '../components/dgmComponents/AttendanceStats.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import CreateEventForm from '../components/dgmComponents/CreateEventForm.vue'
import AttendanceListModal from '../components/dgmComponents/AttendanceListModal.vue'
import CalendarModal from '../components/dgmComponents/CalendarModal.vue' 
import AbsenceMonitoring from '../components/dgmComponents/AbsenceMonitoring.vue'
import Background from '../components/dgmComponents/Background.vue'
import EventCard from '../components/dgmComponents/EventCard.vue'

const router = useRouter()
const notificationsStore = useNotificationsStore()
const { members } = storeToRefs(useMembersStore())
const eventsStore = useEventsStore()
const { currentEvent, allEvents } = storeToRefs(useEventsStore())
const { currentEventAttendees } = storeToRefs(useAttendanceStore())

const showCreateEventModal = ref(false)
const showAttendanceModal = ref(false)
const showCalendarModal = ref(false) 
const showEventDetailsModal = ref(false)
const showAbsenceModal = ref(false) 
const eventToEdit = ref(null) 
const selectedStatFilter = ref('All')

// Navbar scroll logic
const isScrolled = ref(false)
const handleScroll = () => { isScrolled.value = window.scrollY > 10 }
onMounted(() => { window.addEventListener('scroll', handleScroll) })
onUnmounted(() => { window.removeEventListener('scroll', handleScroll) })

const presentMembers = computed(() => {
  if (!members.value || members.value.length === 0) return [];
  return currentEventAttendees.value.map(att => {
    const profile = members.value.find(m => m.id === att.memberId);
    if (!profile) return null;
    return { ...profile, attendanceMinistry: att.ministry || 'N/A', checkedInAt: att.timestamp }
  }).filter(Boolean);
})

const totalAttendance = computed(() => presentMembers.value.length)

const dynamicStats = computed(() => {
  if (!members.value) return []; 
  const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A'));
  const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);
  const activeVolunteers = presentMembers.value.filter(m => m.attendanceMinistry && m.attendanceMinistry !== 'N/A');
  const regulars = presentMembers.value.filter(m => !m.finalTags.isFirstTimer && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A') && !m.finalTags.isDgroupLeader);
  return [
    { id: 1, title: "Regulars", count: regulars.length, color: 'blue' },
    { id: 2, title: "Volunteers", count: activeVolunteers.length, color: 'yellow' },
    { id: 3, title: "Dgroup Leaders", count: dleaders.length, color: 'green' },
    { id: 4, title: "First Timers", count: firstTimers.length, color: 'red' }
  ]
})

const filteredAttendees = computed(() => {
  const filter = selectedStatFilter.value
  const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A'));
  const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);
  const activeVolunteers = presentMembers.value.filter(m => m.attendanceMinistry && m.attendanceMinistry !== 'N/A');
  const regulars = presentMembers.value.filter(m => !m.finalTags.isFirstTimer && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A') && !m.finalTags.isDgroupLeader);
  if (filter === 'All') return presentMembers.value
  if (filter === 'Regulars') return regulars
  if (filter === 'Volunteers') return activeVolunteers
  if (filter === 'Dgroup Leaders') return dleaders
  if (filter === 'First Timers') return firstTimers
  return []
})

const formattedEventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) return "No Date Set"
  return new Date(currentEvent.value.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})

const upcomingEvents = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0];
  return allEvents.value.filter(e => e.date > todayStr).sort((a, b) => new Date(a.date) - new Date(b.date))
})

const absenceMonitorRef = ref(null)
function openAttendanceList(filter) { selectedStatFilter.value = filter; showAttendanceModal.value = true; }
function openCalendar() { showCalendarModal.value = true; }
function handleCreateEvent() { eventToEdit.value = null; showCalendarModal.value = false; showCreateEventModal.value = true; }
function handleEditEvent(event) { eventToEdit.value = event; showCalendarModal.value = false; showCreateEventModal.value = true; }
function openEventDetails() { showEventDetailsModal.value = true; }

const prevCurrentEventId = ref(currentEvent.value ? currentEvent.value.id : null)
watch(currentEvent, (newVal) => {
  if (prevCurrentEventId.value && !newVal) {
    showAbsenceModal.value = true;
    absenceMonitorRef.value?.buildAbsenceNotifications?.();
  }
  prevCurrentEventId.value = newVal ? newVal.id : null
})

async function handleEndCurrentEvent() {
  const ev = currentEvent.value
  if (!ev || !ev.id) return;
  if (!confirm(`End event "${ev.name}"?`)) return
  try {
    await eventsStore.endEvent(ev.id);
    showEventDetailsModal.value = false;
    showAbsenceModal.value = true;
    absenceMonitorRef.value?.buildAbsenceNotifications?.();
  } catch (err) { console.error(err); }
}
</script>

<template>
  <div class="dashboard-container">
    <div class="sticky-header" :class="{ 'at-top': !isScrolled }">
      <AppHeader />
    </div>

    <Background />

    <div class="main-content">
      <div class="hero-layout">
        <div class="total-attendance-card" @click="openAttendanceList('All')">
          <div class="card-accent-bg"></div>
          <div class="content">
            <span class="label">Live Attendance</span>
            <div class="value">
              <span class="count">{{ totalAttendance }}</span>
              <span class="trend">Members present</span>
            </div>
            <div class="footer-link">Tap to view full list <i class="arrow-icon">→</i></div>
          </div>
        </div>
        
        <div class="current-event-container">
          <CurrentEvent @open-calendar="openCalendar" @open-details="openEventDetails" />
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-grid">
          <AttendanceStats 
            v-for="stat in dynamicStats" 
            :key="stat.id"
            :title="stat.title"
            :count="stat.count"
            :class="['stat-card-enhanced', stat.color]"
            @click="openAttendanceList(stat.title)"
          />
        </div>
      </div>

      <div class="upcoming-section">
        <div class="section-header">
          <h3>Upcoming Gatherings</h3>
          <button class="calendar-btn" @click="openCalendar">View Full Calendar</button>
        </div>
        
        <div v-if="upcomingEvents.length > 0" class="events-grid">
          <EventCard 
            v-for="event in upcomingEvents" 
            :key="event.id" 
            :event="event" 
            @click="handleEditEvent" 
          />
        </div>
        
        <div v-else class="empty-state">
          <div class="empty-art">🗓️</div>
          <p>Your calendar is clear for now.</p>
          <button class="create-btn" @click="handleCreateEvent">Schedule an Event</button>
        </div>
      </div>
    </div>
  </div>
  
  <Modal v-if="showCreateEventModal" @close="showCreateEventModal = false"><CreateEventForm :eventToEdit="eventToEdit" @close="showCreateEventModal = false" /></Modal>
  <Modal v-if="showAttendanceModal" @close="showAttendanceModal = false" size="xl"><AttendanceListModal :attendees="filteredAttendees" :filterTitle="selectedStatFilter" @close="showAttendanceModal = false" /></Modal>
  <Modal v-if="showCalendarModal" @close="showCalendarModal = false" size="xl"><CalendarModal @close="showCalendarModal = false" @createEvent="handleCreateEvent" @editEvent="handleEditEvent" /></Modal>
  <Modal v-if="showEventDetailsModal" @close="showEventDetailsModal = false" size="xl">
    <div class="event-details-content">
      <div class="details-header"><h3>{{ currentEvent?.name }}</h3><span class="badge">{{ currentEvent?.eventType }}</span></div>
      <div class="details-grid">
        <div class="info-item"><strong>Date:</strong> {{ formattedEventDate }}</div>
        <div class="info-item"><strong>Location:</strong> {{ currentEvent?.eventLocation }}</div>
        <div class="info-item"><strong>Speaker:</strong> {{ currentEvent?.eventSpeaker || 'TBA' }}</div>
      </div>
      <div class="actions">
        <button class="end-event-btn" @click="handleEndCurrentEvent">End Event</button>
        <button class="cancel-btn" @click="showEventDetailsModal = false">Back</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.dashboard-container { background: #fdfdfd; min-height: 100vh; color: #1e293b; position: relative; }
.sticky-header { position: sticky; top: 0; z-index: 100; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(255, 255, 255, 0.95); }
.sticky-header.at-top { background: #1976D2; }
.main-content { padding: 0 32px 40px 32px; }
.hero-layout { display: grid; grid-template-columns: 380px 1fr; gap: 24px; margin-bottom: 32px; align-items: stretch; margin-top: 24px; }
.total-attendance-card { background: #b4d0e3; border-radius: 24px; padding: 40px 32px; cursor: pointer; position: relative; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.03); transition: transform 0.3s ease; }
.total-attendance-card:hover { transform: translateY(-4px); }
.card-accent-bg { position: absolute; top: -50%; right: -20%; width: 250px; height: 250px; background: radial-gradient(circle, rgba(15, 71, 161, 0.08) 0%, transparent 70%); }
.total-attendance-card .label { font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
.total-attendance-card .value { display: flex; align-items: baseline; gap: 12px; margin: 16px 0; }
.total-attendance-card .count { font-size: 72px; font-weight: 900; color: #0d47a1; line-height: 1; }
.total-attendance-card .trend { font-size: 16px; color: #64748b; font-weight: 500; }
.footer-link { font-size: 14px; font-weight: 700; color: #3b82f6; display: flex; align-items: center; gap: 8px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 48px; }
.stat-card-enhanced { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s ease; position: relative; }
.stat-card-enhanced::after { content: ''; position: absolute; left: 0; top: 20%; height: 60%; width: 4px; border-radius: 0 4px 4px 0; }
.stat-card-enhanced.blue::after { background: #3b82f6; } .stat-card-enhanced.blue { background: #eff6ff; }
.stat-card-enhanced.yellow::after { background: #eab308; } .stat-card-enhanced.yellow { background: #fefce8; }
.stat-card-enhanced.green::after { background: #10b981; } .stat-card-enhanced.green { background: #f0fdf4; }
.stat-card-enhanced.red::after { background: #ef4444; } .stat-card-enhanced.red { background: #fef2f2; }
.stat-card-enhanced:hover { transform: translateY(-4px); box-shadow: 0 12px 20px rgba(0,0,0,0.04); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.section-header h3 { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
.calendar-btn { background: #f1f5f9; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 700; color: #475569; cursor: pointer; transition: 0.2s; }
.calendar-btn:hover { background: #e2e8f0; }
.events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
.empty-state { text-align: center; padding: 80px 20px; background: #fff; border-radius: 24px; border: 2px dashed #e2e8f0; }
.empty-art { font-size: 48px; margin-bottom: 16px; }
.create-btn { background: #0d47a1; color: #fff; border: none; padding: 12px 28px; border-radius: 12px; font-weight: 700; margin-top: 16px; cursor: pointer; box-shadow: 0 4px 12px rgba(13, 71, 161, 0.2); }
@media (max-width: 1200px) { .hero-layout { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .dashboard-container { padding: 0; } .main-content { padding: 16px; } .stats-grid { grid-template-columns: 1fr; } .events-grid { grid-template-columns: 1fr; } }
.event-details-content { padding: 12px; }
.details-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 20px; border-radius: 16px; margin-bottom: 24px; }
.end-event-btn { background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; }
.cancel-btn { background: transparent; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 12px; font-weight: 700; margin-left: 12px; cursor: pointer; }
</style>