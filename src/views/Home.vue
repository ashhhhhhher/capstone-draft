<script setup>
import { ref, computed, watch } from 'vue'
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

// --- Router & Stores ---
const router = useRouter()
const notificationsStore = useNotificationsStore()
const { members, activeMembers } = storeToRefs(useMembersStore())
const eventsStore = useEventsStore() // used to call endEvent
const { currentEvent, allEvents } = storeToRefs(useEventsStore())
const { currentEventAttendees, allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showCreateEventModal = ref(false)
const showAttendanceModal = ref(false)
const showCalendarModal = ref(false) 
const showEventDetailsModal = ref(false)
const showAbsenceModal = ref(false) 
const eventToEdit = ref(null) 
const selectedStatFilter = ref('All')

// --- Dynamic Data (MERGING PROFILE + ATTENDANCE RECORD) ---
const presentMembers = computed(() => {
  if (!members.value || members.value.length === 0) return [];
  
  // Merge attendance details (ministry role) into the member object
  return currentEventAttendees.value.map(att => {
      const profile = members.value.find(m => m.id === att.memberId);
      if (!profile) return null;
      return {
          ...profile,
          attendanceMinistry: att.ministry || 'N/A', // The actual role played
          checkedInAt: att.timestamp
      }
  }).filter(Boolean);
})

const totalAttendance = computed(() => presentMembers.value.length)

// --- UPDATED STATS LOGIC ---
// Stats now reflect ACTUAL attendance role for THIS EVENT
const dynamicStats = computed(() => {
  if (!members.value) return []; 
  
    // Leaders: count only those present who did not serve as volunteers for this event
    const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A'));
    const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);

    // Active Volunteers: Members who have a valid attendanceMinistry for this event
    // (this allows Dgroup Leaders who served in a volunteer role this event to show as Volunteers)
    const activeVolunteers = presentMembers.value.filter(m => m.attendanceMinistry && m.attendanceMinistry !== 'N/A');

    // Regulars: present members who are not first timers and did not serve in a volunteer ministry
    const regulars = presentMembers.value.filter(m => 
      !m.finalTags.isFirstTimer && 
      (!m.attendanceMinistry || m.attendanceMinistry === 'N/A') &&
      !m.finalTags.isDgroupLeader
    );

  return [
    { id: 1, title: "Regulars", count: regulars.length },
    { id: 2, title: "Volunteers", count: activeVolunteers.length },
    { id: 3, title: "Dgroup Leaders", count: dleaders.length },
    { id: 4, title: "First Timers", count: firstTimers.length }
  ]
})

const filteredAttendees = computed(() => {
  const filter = selectedStatFilter.value
  
  // Reuse logic from dynamicStats for consistency
    const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader && (!m.attendanceMinistry || m.attendanceMinistry === 'N/A'));
    const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);
    const activeVolunteers = presentMembers.value.filter(m => m.attendanceMinistry && m.attendanceMinistry !== 'N/A');
    const regulars = presentMembers.value.filter(m =>
      !m.finalTags.isFirstTimer &&
      (!m.attendanceMinistry || m.attendanceMinistry === 'N/A') &&
      !m.finalTags.isDgroupLeader
    );

  if (filter === 'All') return presentMembers.value
  if (filter === 'Regulars') return regulars
  if (filter === 'Volunteers') return activeVolunteers
  if (filter === 'Dgroup Leaders') return dleaders
  if (filter === 'First Timers') return firstTimers
  return []
})

const formattedEventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) return "No Date Set"
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  const date = new Date(currentEvent.value.date + 'T00:00:00')
  return date.toLocaleDateString('en-US', options)
})

// --- Upcoming Events Logic ---
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

// Absence monitoring behavior is handled inside the AbsenceMonitoring component.
// We'll keep a template ref to call its exposed builder when needed.
const absenceMonitorRef = ref(null)

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

// exportEventAttendance removed — use centralized ExportButton.vue for exporting functionality

// Open details modal (called when CurrentEvent emits open-details)
function openEventDetails() {
  showEventDetailsModal.value = true
}

// track previous currentEvent id so we can detect natural expiry
const prevCurrentEventId = ref(currentEvent.value ? currentEvent.value.id : null)

watch(currentEvent, (newVal, oldVal) => {
  // if we had an event previously and now it's null -> it ended naturally
    if (prevCurrentEventId.value && !newVal) {
    // open absence monitoring modal
    showAbsenceModal.value = true
    absenceMonitorRef.value?.buildAbsenceNotifications?.()
  }
  prevCurrentEventId.value = newVal ? newVal.id : null
})

// End current event (calls store action)
async function handleEndCurrentEvent() {
  const ev = currentEvent.value
  if (!ev || !ev.id) {
    alert('No active event to end.')
    return
  }
  if (!confirm(`End event "${ev.name}" now? This will mark it as ended.`)) return

  try {
    await eventsStore.endEvent(ev.id)
    // close details modal and provide feedback
    showEventDetailsModal.value = false
    // open absence monitoring modal after ending
    showAbsenceModal.value = true
    absenceMonitorRef.value?.buildAbsenceNotifications?.()   // build notifications after event ended
    alert('Event ended successfully. Volunteer inactivity check initiated.')
  } catch (err) {
    console.error('Failed to end event:', err)
    alert('Failed to end event. See console for details.')
  }
}

</script>

<template>
  <div class="dashboard-container">
    <!-- use AppHeader only (notification moved into AppHeader) -->
    <AppHeader />

    <!-- Total Attendance Card -->
    <div 
      class="total-attendance-card" 
      @click="openAttendanceList('All')"
    >
      <div class="total-attendance">
        Current Event's Total Attendance: <strong>{{ totalAttendance }}</strong>
      </div>
      <span class="click-hint">Click to view list</span>
    </div>
    
    <CurrentEvent 
      @open-calendar="openCalendar"
      @open-details="openEventDetails"
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

    <!-- Upcoming Events Section -->
    <div class="upcoming-section">
      <h3>Upcoming Events</h3>
      
      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div 
          v-for="event in upcomingEvents" 
          :key="event.id" 
          class="upcoming-card-wrapper"
        >
          <div class="upcoming-card" @click="handleEditEvent(event)">
            <div class="card-media">
              <img v-if="event.photoURL" :src="event.photoURL" alt="event image" />
              <div v-else class="card-media-placeholder"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQu0jzHfqdWdZJdLeogBZoboqMz9-_SuJyuEw&s" alt="Elevate WKND" /></div>
            </div>
            <div class="card-details">
              <div class="card-line card-date">{{ formatShortDate(event.date) }} <span v-if="event.time">• {{ event.time }}</span></div>
              <div class="card-line card-title">{{ event.name }}</div>
              <div class="card-line card-type" :class="event.eventType === 'b1g_event' ? 'b1g-type' : (event.eventType === 'service' ? 'service-type' : 'ccf-type')">
                {{ event.eventType === 'service' ? 'Service' : (event.eventType === 'b1g_event' ? 'B1G Service' : 'CCF Event') }}
              </div>
              <div class="card-line card-location"><strong>Location: </strong>{{ event.eventLocation || 'Online' }}</div>
              <div v-if="event.eventSpeaker" class="card-line card-minor"><strong>Speaker:</strong> {{ event.eventSpeaker }}</div>
              <div v-if="event.eventSeries" class="card-line card-minor"><strong>Series:</strong> {{ event.eventSeries }}</div>
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
      :eventLocation="currentEvent ? currentEvent.eventLocation : 'N/A'"
      :eventSpeaker="currentEvent ? currentEvent.eventSpeaker : ''" 
      :eventSeries="currentEvent ? currentEvent.eventSeries : ''"
      :attendees="filteredAttendees"
      :filterTitle="selectedStatFilter"
      @close="showAttendanceModal = false"
    />
  </Modal>
  
  <Modal v-if="showCalendarModal" @close="showCalendarModal = false" size="xl">
    <CalendarModal 
      @close="showCalendarModal = false"
      @createEvent="handleCreateEvent"
      @editEvent="handleEditEvent"
      
    />
  </Modal>

  <!-- Event Details Modal -->
  <Modal v-if="showEventDetailsModal" @close="showEventDetailsModal = false" size="xl">
    <div class="event-details-modal">
      <div class="modal-section">
        <h3>{{ currentEvent ? currentEvent.name : 'No Active Event' }}</h3>
        <div class="meta">
          <div><strong>Date:</strong> {{ currentEvent && currentEvent.date ? currentEvent.date : 'N/A' }}</div>
          <div v-if="currentEvent && currentEvent.time"><strong>Time:</strong> {{ currentEvent.time }}</div>
          <div v-if="currentEvent && currentEvent.eventLocation"><strong>Location:</strong> {{ currentEvent.eventLocation }}</div>
          <div v-if="currentEvent && currentEvent.eventSpeaker"><strong>Speaker:</strong> {{ currentEvent.eventSpeaker }}</div>
          <div v-if="currentEvent && currentEvent.eventSeries"><strong>Series:</strong> {{ currentEvent.eventSeries }}</div>
        </div>

        <div v-if="currentEvent && currentEvent.description" class="description">
          <h4>Description</h4>
          <p>{{ currentEvent.description }}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button class="end-btn" @click="handleEndCurrentEvent">End Event</button>
        <button class="close-secondary" @click="showEventDetailsModal = false">Close</button>
      </div>
    </div>
  </Modal>

</template>

<style scoped>
.dashboard-container { padding: 0 20px 20px 20px; max-width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
.dashboard-header { margin-bottom: 20px; display: flex; gap: 16px; }
.total-attendance-card { flex-grow: 1; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent; text-align: center; }
.total-attendance-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); border-color: #1976D2; }
.total-attendance { font-size: 20px; color: #37474F; }
.total-attendance strong { color: #0D47A1; font-weight: 700; font-size: 24px; }
.click-hint { font-size: 12px; color: #1976D2; font-weight: 500; margin-top: 4px; display: block; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 30px; }
.upcoming-section { margin-top: 10px; flex-grow: 1; display: flex; flex-direction: column; }
.upcoming-section h3 { margin: 0 0 16px 0; font-size: 18px; color: #333; font-weight: 700; flex-shrink: 0; }
.events-scroll-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 6px 0 12px 0; }
.upcoming-card-wrapper { width: 100%; }
.upcoming-card { width: 100%; height: 400px; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); transition: transform 0.18s ease; cursor: pointer; display: flex; flex-direction: column; }
.upcoming-card:hover { transform: translateY(-6px); box-shadow: 0 10px 20px rgba(0,0,0,0.12); }
.card-media { width: 100%; height: 220px; background: #37474F; display: block; overflow: hidden; flex: 0 0 auto; position: relative; }
.card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.0) 100%); pointer-events: none; }
.card-media-placeholder::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.0) 100%); pointer-events: none; }
.card-media-placeholder { width:100%; height:100%; background: linear-gradient(90deg,#37474F,#546E7A); position: relative;}
.card-details { padding: 12px 14px; color: #263238; display: flex; flex-direction: column; gap: 8px; }
.card-line { display: block; }
.card-date { font-size: 14px; font-weight: 700; color: #1976D2; }
.card-title { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 700; color: #0D47A1; display: block; overflow: hidden; word-wrap: break-word; }
.card-type { font-size: 13px; opacity: 0.9; text-transform: uppercase; margin-top: 2px; color: #37474F; }
.card-location { font-size: 14px; color: #37474F; }
.card-minor { font-size: 13px; color: #546E7A; }
.card-type.b1g-type { color: #D32F2F; }
.card-type.ccf-type { color: #FFA000; }
.card-type.service-type { color: #1976D2; }
.no-upcoming-box { text-align: center; padding: 30px; background: #fff; border-radius: 12px; color: #78909C; border: 1px dashed #CFD8DC; }
.link-btn { background: none; border: none; color: #1976D2; text-decoration: underline; cursor: pointer; font-weight: 600; margin-left: 4px; }
.absence-notif-list { display: flex; gap: 12px; margin: 12px 0; overflow-x: auto; padding-bottom: 8px; }
.notif-card { background: #fff; border-radius: 12px; border: 1px solid #ECEFF1; padding: 14px; min-width: 320px; max-width: 420px; box-shadow: 0 6px 18px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 10px; flex: 0 0 auto; }
.notif-header { font-weight: 800; color: #b71c1c; font-size: 15px; }
.notif-body { color: #546E7A; font-size: 13px; line-height: 1.3; }
.notif-action { display: flex; justify-content: flex-end; }
.notif-cta { background: transparent; border: none; color: #1976D2; font-weight: 700; cursor: pointer; padding: 8px; border-radius: 8px; }
.notif-cta:hover { text-decoration: underline; }
@media (max-width: 1024px) { .events-scroll-container { grid-template-columns: repeat(2, 1fr); } .card-media { height: 200px; } }
@media (max-width: 768px) { .dashboard-container { padding: 0 10px 10px 10px; } .stats-grid { grid-template-columns: 1fr 1fr; } .events-scroll-container { grid-template-columns: repeat(2, 1fr); } .card-media { height: 170px; } .card-title { font-size: 16px; } }
@media (max-width: 480px) { .events-scroll-container { grid-template-columns: 1fr; } .card-media { height: 120px; } .stats-grid { grid-template-columns: 1fr; } }
.event-details-modal { display: flex; flex-direction: column; gap: 16px; padding: 8px 4px; width: 100%; box-sizing: border-box; }
.event-details-modal .modal-section h3 { margin: 0 0 8px 0; font-size: 20px; color: #0D47A1; }
.event-details-modal .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 14px; color: #37474F; }
.event-details-modal .description { margin-top: 8px; color: #546E7A; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; align-items: center; margin-top: 8px; }
.end-btn { background: #D32F2F; color: white; border: none; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(211,47,47,0.18); }
.end-btn:hover { background: #C62828; }
.close-secondary { background: #F5F7FA; color: #37474F; border: 1px solid #E0E0E0; border-radius: 8px; padding: 9px 12px; cursor: pointer; }
.absence-modal-inner { display: flex; flex-direction: column; height: 100%; }
.absence-modal-header { position: sticky; top: 0; z-index: 30; background: white; padding: 16px 12px; border-bottom: 1px solid #F1F3F5; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.absence-modal-header h3 { margin: 0; font-size: 18px; color: #D32F2F; font-weight: 800; }
.absence-modal-subtext { margin: 6px 0 0 0; color: #546E7A; font-size: 13px; }
.absence-modal-body { padding: 12px 8px 8px 8px; overflow: auto; flex: 1 1 auto; }
::v-deep(.absence-monitoring-wrapper .monitoring-cards) { display: flex; flex-direction: row; gap: 16px; align-items: flex-start; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; }
::v-deep(.absence-monitoring-wrapper .list-card) { flex: 0 0 360px; min-width: 300px; max-width: 42%; box-sizing: border-box; scroll-snap-align: start; }
::v-deep(.absence-monitoring-wrapper .card-list) { display: flex; flex-direction: column; gap: 12px; }
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(1)) { order: 1; }
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(2)) { order: 2; }
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(3)) { order: 3; }
@media (max-width: 860px) { ::v-deep(.absence-monitoring-wrapper .monitoring-cards) { display: block; } ::v-deep(.absence-monitoring-wrapper .list-card) { max-width: none; width: 100%; flex: none; } }
</style>