<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Calendar, Settings } from 'lucide-vue-next'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import AppHeader from '../components/AppHeader.vue'
import CurrentEvent from '../components/CurrentEvent.vue'
import AttendanceStats from '../components/AttendanceStats.vue'
import Modal from '../components/Modal.vue'
import CreateEventForm from '../components/CreateEventForm.vue'
import AttendanceListModal from '../components/AttendanceListModal.vue'
import CalendarModal from '../components/CalendarModal.vue' 

// --- Store Setup ---
const { members } = storeToRefs(useMembersStore())
const { currentEvent, allEvents } = storeToRefs(useEventsStore())
const { currentEventAttendees } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showCreateEventModal = ref(false)
const showAttendanceModal = ref(false)
const showCalendarModal = ref(false) 
const eventToEdit = ref(null) 
const selectedStatFilter = ref('All')

// --- Dynamic Data ---
const presentMembers = computed(() => {
  if (!members.value || members.value.length === 0) return [];
  const attendeeIds = new Set(
    currentEventAttendees.value.map(att => att.memberId)
  );
  return members.value.filter(member => attendeeIds.has(member.id))
})

const totalAttendance = computed(() => presentMembers.value.length)

const dynamicStats = computed(() => {
  if (!members.value) return []; 
  return [
    { id: 1, title: "Regulars", count: presentMembers.value.filter(m => m.finalTags.isRegular).length },
    { id: 2, title: "Volunteers", count: presentMembers.value.filter(m => m.finalTags.isVolunteer).length },
    { id: 3, title: "Dgroup Leaders", count: presentMembers.value.filter(m => m.finalTags.isDgroupLeader).length },
    { id: 4, title: "First Timers", count: presentMembers.value.filter(m => m.finalTags.isFirstTimer).length }
  ]
})

const filteredAttendees = computed(() => {
  const filter = selectedStatFilter.value
  if (filter === 'All') return presentMembers.value
  if (filter === 'Regulars') return presentMembers.value.filter(m => m.finalTags.isRegular)
  if (filter === 'Volunteers') return presentMembers.value.filter(m => m.finalTags.isVolunteer)
  if (filter === 'Dgroup Leaders') return presentMembers.value.filter(m => m.finalTags.isDgroupLeader)
  if (filter === 'First Timers') return presentMembers.value.filter(m => m.finalTags.isFirstTimer)
  return []
})

const formattedEventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) return "No Date Set"
  const options = { weekday: 'long', month: 'long', day: 'numeric' }
  const date = new Date(currentEvent.value.date + 'T00:00:00')
  return date.toLocaleDateString('en-US', options)
})

const upcomingEvents = computed(() => {
  const today = new Date();
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  return allEvents.value
    .filter(e => e.date > todayStr) 
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- Modal Functions ---

function openAttendanceList(filter) {
  selectedStatFilter.value = filter
  showAttendanceModal.value = true
}

function openCalendar() {
  showCalendarModal.value = true
}

function handleCreateEvent() {
  eventToEdit.value = null;
  showCalendarModal.value = false;
  showCreateEventModal.value = true;
}

function handleEditEvent(event) {
  eventToEdit.value = event
  showCalendarModal.value = false
  showCreateEventModal.value = true
}

</script>

<template>
  <div class="dashboard-container">
    <AppHeader />

    <header class="dashboard-header">
      <!-- Total Attendance Card -->
      <div 
        class="total-attendance-card" 
        @click="openAttendanceList('All')"
      >
        <div class="total-attendance">
          Total Attendance: <strong>{{ totalAttendance }}</strong>
        </div>
        <span class="click-hint">Click to view list</span>
      </div>
    </header>

    <CurrentEvent 
      @open-calendar="openCalendar"
    />

    <div class="stats-grid">
      <AttendanceStats 
        v-for="stat in dynamicStats" 
        :key="stat.id"
        :title="stat.title"
        :count="stat.count"
        @click="openAttendanceList(stat.title)"
      />
    </div>

    <!-- Upcoming Events Section  -->
    <div class="upcoming-section">
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
            @click="handleEditEvent(event)"
          >
            <div class="card-overlay">
              <div class="card-content">
                <span class="card-date">{{ formatShortDate(event.date) }} at {{ event.time }}</span>
                <h4 class="card-title">{{ event.name }}</h4>
                <span class="card-type">{{ event.eventType === 'service' ? 'Service' : 'CCF Event' }} &middot; {{ event.eventLocation || 'Online' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="no-upcoming-box">
        <p>No upcoming events scheduled.</p>
        <button class="link-btn" @click="handleCreateEvent">Schedule one now</button>
      </div>
    </div>

  </div>
  
  <!-- Modals -->
  <Modal v-if="showCreateEventModal" @close="showCreateEventModal = false">
    <CreateEventForm :eventToEdit="eventToEdit" @close="showCreateEventModal = false" />
  </Modal>

  <Modal v-if="showAttendanceModal" @close="showAttendanceModal = false" size="xl">
    <AttendanceListModal
      :eventName="currentEvent ? currentEvent.name : 'Event'"
      :eventDate="formattedEventDate"
      :attendees="filteredAttendees"
      :filterTitle="selectedStatFilter"
      @close="showAttendanceModal = false"
    />
  </Modal>
  
  <!-- Calendar Modal -->
  <Modal v-if="showCalendarModal" @close="showCalendarModal = false" size="xl">
    <CalendarModal 
      @close="showCalendarModal = false"
      @createEvent="handleCreateEvent"
      @editEvent="handleEditEvent"
    />
  </Modal>

</template>

<style scoped>
.dashboard-container {
  padding: 0 20px 20px 20px;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* --- Header --- */
.dashboard-header {
  margin-bottom: 20px;
  display: flex;
  gap: 16px;
}

.total-attendance-card {
  flex-grow: 1;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  text-align: center;
}
.total-attendance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #1976D2;
}
.total-attendance { font-size: 20px; color: #37474F; }
.total-attendance strong { color: #0D47A1; font-weight: 700; font-size: 24px; }
.click-hint { font-size: 12px; color: #1976D2; font-weight: 500; margin-top: 4px; display: block; }

.calendar-btn {
  background-color: #fff;
  border: 1px solid #B0BEC5;
  border-radius: 12px;
  width: 80px; 
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #546E7A;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.calendar-btn:hover {
  background-color: #E3F2FD;
  color: #1976D2;
  border-color: #1976D2;
}

/* --- Stats Grid --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

/* --- Upcoming Events Section  --- */
.upcoming-section {
  margin-top: 10px;
  flex-grow: 1; 
  display: flex;
  flex-direction: column;
}
.upcoming-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
  font-weight: 700;
  flex-shrink: 0;
}

.events-scroll-container {
  display: flex;
  flex-direction: column; 
  gap: 12px;
  overflow-y: auto; 
  padding-bottom: 16px;
}

/* --- EVENT CARD SIZING --- */
.upcoming-card-wrapper {
  flex-shrink: 0;
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
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  transition: transform 0.2s ease;
  cursor: pointer;
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

.card-content {
  color: white;
  width: 100%;
}
.card-date {
  font-size: 16px; 
  font-weight: 700;
  color: #FFCA28;
  display: block;
  margin-bottom: 4px;
}
.card-title {
  margin: 0;
  font-size: 24px;
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
  padding: 30px;
  background: #fff;
  border-radius: 12px;
  color: #78909C;
  border: 1px dashed #CFD8DC;
}
.link-btn {
  background: none;
  border: none;
  color: #1976D2;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 600;
  margin-left: 4px;
}

/* --- Mobile Adjustments --- */
@media (max-width: 768px) {
  .dashboard-container { padding: 0 10px 10px 10px; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .upcoming-card { height: 120px; }
  .card-title { font-size: 20px; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>