<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import AppHeader from '../components/AppHeader.vue'
import CurrentEvent from '../components/CurrentEvent.vue'
import AttendanceStats from '../components/AttendanceStats.vue'
import Modal from '../components/Modal.vue'
import CreateEventForm from '../components/CreateEventForm.vue'
import AttendanceListModal from '../components/AttendanceListModal.vue'
import EventListModal from '../components/EventListModal.vue'

// --- Store Setup ---
const { members } = storeToRefs(useMembersStore())
const { currentEvent } = storeToRefs(useEventsStore())
const { currentEventAttendees } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showCreateEventModal = ref(false)
const showAttendanceModal = ref(false)
const showEventListModal = ref(false) 
const eventToEdit = ref(null) 
const selectedStatFilter = ref('All')

// --- Dynamic Data ---
const presentMembers = computed(() => {
  // CRITICAL FIX: Ensure members.value is an array before mapping
  if (!members.value || members.value.length === 0) return [];
  const attendeeIds = new Set(
    currentEventAttendees.value.map(att => att.memberId)
  );
  return members.value.filter(member => attendeeIds.has(member.id))
})

const totalAttendance = computed(() => presentMembers.value.length)

const dynamicStats = computed(() => {
  if (!members.value) return []; // Defensive check
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

// --- Modal Functions ---

function openAttendanceList(filter) {
  selectedStatFilter.value = filter
  showAttendanceModal.value = true
}

function openCreateEvent() {
  eventToEdit.value = null 
  showCreateEventModal.value = true
}

function openEventList() {
  showEventListModal.value = true
}

function handleEditEvent(event) {
  eventToEdit.value = event
  showEventListModal.value = false
  showCreateEventModal.value = true
}

</script>

<template>
  <div class="dashboard-container">
    <AppHeader />

    <header class="dashboard-header">
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
      @open-create-event="openCreateEvent"
      @open-event-list="openEventList"
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
  </div>
  
  <!-- Create/Edit Event Modal -->
  <Modal 
    v-if="showCreateEventModal" 
    @close="showCreateEventModal = false"
  >
    <CreateEventForm 
      :eventToEdit="eventToEdit"
      @close="showCreateEventModal = false" 
    />
  </Modal>

  <!-- Attendance List Modal -->
  <Modal 
    v-if="showAttendanceModal" 
    @close="showAttendanceModal = false"
    size="xl"
  >
    <AttendanceListModal
      :eventName="currentEvent ? currentEvent.name : 'Event'"
      :eventDate="formattedEventDate"
      :attendees="filteredAttendees"
      :filterTitle="selectedStatFilter"
      @close="showAttendanceModal = false"
    />
  </Modal>
  
  <!-- Event List Modal -->
  <Modal
    v-if="showEventListModal"
    @close="showEventListModal = false"
    size="xl"
  >
    <EventListModal 
      @close="showEventListModal = false"
      @editEvent="handleEditEvent"
    />
  </Modal>

</template>

<style scoped>
.dashboard-container {
  padding: 0 20px 20px 20px;
  max-width: 100%;
  box-sizing: border-box;
}

/* Header Card */
.dashboard-header {
  margin-bottom: 20px;
}

.total-attendance-card {
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

.total-attendance {
  font-size: 20px;
  color: #37474F;
}
.total-attendance strong {
  color: #0D47A1;
  font-weight: 700;
  font-size: 24px;
}
.click-hint {
  font-size: 12px;
  color: #1976D2;
  font-weight: 500;
  margin-top: 4px;
  display: block;
}

/* --- Responsive Grid --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

/* --- Mobile Adjustments --- */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 0 10px 10px 10px;
  }

  .total-attendance-card {
    padding: 16px;
  }

  .total-attendance {
    font-size: 18px;
  }

  .total-attendance strong {
    font-size: 22px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr; /* Keep 2 columns on mobile */
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr; /* Stack to 1 column on very small screens */
  }
}
</style>