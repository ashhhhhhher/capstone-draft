<template>
  <div class="member-attendance-container">
    <MemberNavBar />

    <!-- Header -->
    <h1 class="attendance-header">Attendance History</h1>

    <div class="member-attendance-grid">
      <!-- Left: Attendance List -->
      <div class="attendance-list-section">
        <details open class="attendance-accordion">
          <summary>WKND Attendance</summary>

          <div class="attendance-list">
            <div
              v-for="event in pastEvents"
              :key="event.id"
              class="attendance-card"
              :class="{ selected: selectedEvent && selectedEvent.id === event.id }"
              @click="selectEvent(event)"
            >
              <div class="card-left">
                <span class="event-name">{{ event.name }}</span>
                <span class="event-date">{{ formatShortDate(event.date) }}</span>
              </div>
              <div
                class="status"
                :class="{ present: isPresent(event.id), absent: !isPresent(event.id) }"
              >
                {{ isPresent(event.id) ? 'Present' : 'Absent' }}
              </div>
            </div>

            <div v-if="pastEvents.length === 0" class="no-history">
              No past events found.
            </div>
          </div>
        </details>
      </div>

      <!-- Right: Stats + Event Details -->
      <div class="attendance-detail-section">
        <!-- Member statistics cards -->
        <div class="stats-cards">
          <div class="stat-card present">
            <span class="stat-count">{{ presentThisMonth }}</span>
            <span class="stat-label">Present this month</span>
          </div>
          <div class="stat-card absent">
            <span class="stat-count">{{ absentThisMonth }}</span>
            <span class="stat-label">Absent this month</span>
          </div>
        </div>

        <!-- Event details -->
        <div class="detail-card" v-if="selectedEvent">
          <div
            v-if="selectedEvent.photoURL"
            class="detail-image"
            :style="{ backgroundImage: `url(${selectedEvent.photoURL})` }"
          ></div>
          <h2>{{ selectedEvent.name }}</h2>
          <p><strong>Date:</strong> {{ formatShortDate(selectedEvent.date) }}</p>
          <p><strong>Time:</strong> {{ selectedEvent.time || 'TBA' }}</p>
          <p><strong>Location:</strong> {{ selectedEvent.eventLocation || 'Online' }}</p>
          <p><strong>Type:</strong> {{ selectedEvent.eventType === 'service' ? 'Service' : 'CCF Event' }}</p>
          <p><strong>Status:</strong> {{ isPresent(selectedEvent.id) ? 'Present' : 'Absent' }}</p>
          <p v-if="selectedEvent.description"><strong>Description:</strong> {{ selectedEvent.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import MemberNavBar from '../components/MemberNavBar.vue'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useAuthStore } from '../stores/auth'

const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())
const authStore = useAuthStore()
const memberId = computed(() => authStore.userProfile?.id || authStore.user?.uid)

// Past events
const pastEvents = computed(() => {
  const today = new Date()
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0]
  return (allEvents.value || [])
    .filter(e => e.eventType === 'service' && e.date <= todayStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

function isPresent(eventId) {
  return allAttendance.value.some(
    att => att.eventId === eventId && att.memberId === memberId.value
  )
}

function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Selected event for details
const selectedEvent = ref(null)
function selectEvent(event) {
  selectedEvent.value = event
}

// Statistics for this month
const currentMonthStr = new Date().toISOString().slice(0, 7)
const presentThisMonth = computed(() => {
  return pastEvents.value.filter(
    e => e.date.startsWith(currentMonthStr) && isPresent(e.id)
  ).length
})
const absentThisMonth = computed(() => {
  return pastEvents.value.filter(
    e => e.date.startsWith(currentMonthStr) && !isPresent(e.id)
  ).length
})
</script>

<style scoped>
.member-attendance-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 16px 90px 16px;
}

/* Header */
.attendance-header {
  font-size: 28px;
  font-weight: 700;
  color: #1976D2;
  margin-bottom: 24px;
  text-align: left;
}

/* Grid layout */
.member-attendance-grid {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* Left list section */
.attendance-list-section {
  flex: 2;
}

/* Right stats + details */
.attendance-detail-section {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 0; /* aligns with top of left section */
}

/* Attendance card */
.attendance-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 12px;
  background: #F8FAFC;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.attendance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.attendance-card.selected {
  border: 2px solid #1976D2;
  background: #E3F2FD;
}

.card-left {
  display: flex;
  flex-direction: column;
}

.event-name {
  font-weight: 600;
  font-size: 16px;
  color: #37474F;
}

.event-date {
  font-size: 14px;
  color: #546E7A;
  margin-top: 2px;
}

.status {
  flex: 0 0 90px;
  text-align: center;
  font-weight: 700;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
}

.status.present {
  background: #E3FCEC;
  color: #219653;
  border: 1px solid #B7F5D8;
}

.status.absent {
  background: #FFF0F0;
  color: #D32F2F;
  border: 1px solid #FFD6D6;
}

/* Detail card */
.detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.detail-card h2 {
  margin-top: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1976D2;
}

.detail-card p {
  margin: 8px 0;
  color: #37474F;
  font-size: 14px;
}

/* Optional image at top */
.detail-image {
  width: 100%;
  height: 150px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  margin-bottom: 12px;
}

/* Accordion */
.attendance-accordion {
  margin-top: 0; /* aligns with top of stats cards */
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1px solid #ECEFF1;
  overflow: hidden;
}
.attendance-accordion summary {
  font-size: 18px;
  font-weight: 600;
  color: #0D47A1;
  padding: 16px;
  cursor: pointer;
  outline: none;
  background: #F5F7FA;
  border-bottom: 1px solid #ECEFF1;
}

/* List scroll */
.attendance-list {
  padding: 12px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* No events */
.no-history {
  text-align: center;
  padding: 20px;
  font-size: 14px;
  color: #78909C;
  background: #FAFAFA;
  border-radius: 8px;
}

/* Statistics cards */
.stats-cards {
  display: flex;
  gap: 12px;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.stat-card.present {
  border-left: 4px solid #219653;
}

.stat-card.absent {
  border-left: 4px solid #D32F2F;
}

.stat-count {
  font-size: 24px;
  font-weight: 700;
  display: block;
  color: #37474F;
}

.stat-label {
  font-size: 14px;
  color: #546E7A;
  display: block;
  margin-top: 4px;
}

/* Responsive */
@media (max-width: 1000px) {
  .member-attendance-grid {
    flex-direction: column;
  }
  .attendance-detail-section {
    order: -1; /* stats first */
    margin-bottom: 16px;
  }
}
</style>
