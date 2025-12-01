<script setup>
import { computed } from 'vue'

const props = defineProps({
  events: Array,
  attendance: Array,
  members: Array
})

const emit = defineEmits(['close'])

// Calculate overview statistics
const overviewStats = computed(() => {
  const pastEvents = props.events.filter(e => new Date(e.date) <= new Date())
  const totalAttendance = props.attendance.length
  const totalEvents = pastEvents.length
  const avgAttendance = totalEvents > 0 ? Math.round(totalAttendance / totalEvents) : 0

  return {
    totalEvents,
    avgAttendance
  }
})

// Event-by-event breakdown
const eventBreakdown = computed(() => {
  return props.events
    .filter(e => new Date(e.date) <= new Date())
    .map(event => {
      const eventAttendance = props.attendance.filter(a => a.eventId === event.id)
      const elevateCount = eventAttendance.filter(a => {
        const member = props.members.find(m => m.id === a.memberId)
        return member?.finalTags?.ageCategory === 'Elevate'
      }).length
      const b1gCount = eventAttendance.filter(a => {
        const member = props.members.find(m => m.id === a.memberId)
        return member?.finalTags?.ageCategory === 'B1G'
      }).length

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        total: eventAttendance.length,
        elevate: elevateCount,
        b1g: b1gCount
      }
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})
</script>

<template>
  <div class="overview-container">
    <h2>Historical Attendance Overview</h2>
    
    <!-- Overall Summary -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">{{ overviewStats.totalEvents }}</div>
        <div class="summary-label">Total Events</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ overviewStats.avgAttendance }}</div>
        <div class="summary-label">Average Attendees per Event</div>
      </div>
    </div>

    <!-- Event-by-Event Breakdown -->
    <div class="section">
      <h3>Event-by-Event Breakdown</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Date</th>
              <th>Total</th>
              <th>Elevate</th>
              <th>B1G</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventBreakdown" :key="event.id">
              <td>{{ event.name }}</td>
              <td>{{ new Date(event.date).toLocaleDateString() }}</td>
              <td class="text-center"><strong>{{ event.total }}</strong></td>
              <td class="text-center">{{ event.elevate }}</td>
              <td class="text-center">{{ event.b1g }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="eventBreakdown.length === 0" class="no-data">No event data available.</p>
      </div>
    </div>

    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.overview-container {
  padding: 24px;
  max-width: 1200px;
  max-height: 85vh;
  overflow-y: auto;
}

h2 {
  margin: 0 0 24px 0;
  color: #0D47A1;
  font-size: 24px;
  text-align: center;
}

h3 {
  margin: 0 0 16px 0;
  color: #1976D2;
  font-size: 18px;
  font-weight: 600;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.summary-card {
  background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
}

.summary-value {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.summary-label {
  font-size: 14px;
  opacity: 0.9;
  font-weight: 500;
}

/* Sections */
.section {
  background: #F8F9FA;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

/* Breakdown Grid */
.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #1976D2;
}

.breakdown-label {
  font-weight: 600;
  color: #333;
}

.breakdown-value {
  font-size: 24px;
  font-weight: 700;
  color: #1976D2;
  margin: 0 12px;
}

.breakdown-percent {
  color: #666;
  font-size: 14px;
  min-width: 45px;
  text-align: right;
}

/* Tables */
.table-container {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

thead {
  background: #1976D2;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
}

tbody tr {
  border-bottom: 1px solid #E0E0E0;
}

tbody tr:hover {
  background: #F5F5F5;
}

td {
  padding: 12px 16px;
  font-size: 14px;
  color: #333;
}

.text-center {
  text-align: center;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

/* Close Button */
.close-btn {
  width: 100%;
  padding: 14px;
  margin-top: 24px;
  background: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #1565C0;
}

/* Scrollbar Styling */
.overview-container::-webkit-scrollbar,
.table-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overview-container::-webkit-scrollbar-track,
.table-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.overview-container::-webkit-scrollbar-thumb,
.table-container::-webkit-scrollbar-thumb {
  background: #1976D2;
  border-radius: 4px;
}

.overview-container::-webkit-scrollbar-thumb:hover,
.table-container::-webkit-scrollbar-thumb:hover {
  background: #1565C0;
}

@media (max-width: 768px) {
  .overview-container {
    padding: 16px;
  }

  h2 {
    font-size: 20px;
  }

  h3 {
    font-size: 16px;
  }

  .summary-value {
    font-size: 28px;
  }

  .breakdown-value {
    font-size: 20px;
  }

  table {
    font-size: 12px;
  }

  th, td {
    padding: 8px 12px;
  }
}
</style>
