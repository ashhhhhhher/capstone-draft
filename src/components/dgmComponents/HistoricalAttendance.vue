<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'
import { useMembersStore } from '../../stores/members'
import BarChart from '../charts/BarChart.vue'
import Modal from './Modal.vue'
import AttendanceOverviewModal from './AttendanceOverviewModal.vue'
import ExportButton from './ExportButton.vue'

const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()
const membersStore = useMembersStore()

const { allEvents } = storeToRefs(eventsStore)
const { allAttendance, isLoading } = storeToRefs(attendanceStore)
const { members } = storeToRefs(membersStore)

const todayStr = new Date().toISOString().split('T')[0]
const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()
const fromDate = ref(defaultFrom)
const toDate = ref(todayStr)

const showAttendanceOverview = ref(false)

const historicalChartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: { legend: { display: false }, datalabels: { display: false } },
	scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
}

const eventsInRange = computed(() => {
  if (!fromDate.value || !toDate.value) return []
  if (new Date(fromDate.value) > new Date(toDate.value)) return []
  return (allEvents.value || [])
    .filter(e => e.eventType === 'service' && e.date >= fromDate.value && e.date <= toDate.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

const filteredAttendance = computed(() => {
  const evIds = (eventsInRange.value || []).map(e => e.id)
  return (allAttendance.value || []).filter(att => evIds.includes(att.eventId))
})

const historicalAttendanceData = computed(() => {
  const evs = eventsInRange.value || []
  if (!evs.length) return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }
  const labels = evs.map(ev => `${ev.name} (${ev.date})`)
  const data = evs.map(ev => (filteredAttendance.value || []).filter(att => att.eventId === ev.id).length)
  return { labels, datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data }] }
})

onMounted(() => {
	// Ensure we have attendance data available for historical computations
	attendanceStore.fetchAllAttendance().catch(() => {})
})
</script>

<template>
	<div class="historical-attendance">
		<div class="card">
            <div class="section-header">
            <div class="header-left">
                <h3>Historical Events Attendance</h3>
                <div class="date-text">
                Select a date range to view historical attendance
                </div>
            </div>

            <div class="header-actions">
                    <button class="view-overview-btn" @click="showAttendanceOverview = true">View History</button>
                    <ExportButton exportType="events" :eventsList="eventsInRange" />
            </div>
            </div>

            <div class="date-controls">
            <div class="controls-inline">
                <label class="date-label">
                From
                <input type="date" v-model="fromDate" />
                </label>

                <label class="date-label">
                To
                <input
                    type="date"
                    v-model="toDate"
                    :max="(new Date()).toISOString().split('T')[0]"
                />
                </label>
            </div>
            </div>

			<div class="chart-wrapper" style="height: 350px;">
				<BarChart v-if="historicalAttendanceData.labels.length > 0" :chartData="historicalAttendanceData" :chartOptions="historicalChartOptions" />
				<p v-else class="no-data-text">No event data in the selected date range.</p>
			</div>

      <Modal v-if="showAttendanceOverview" @close="showAttendanceOverview = false" size="xl">
        <AttendanceOverviewModal :events="eventsInRange" :attendance="filteredAttendance" :members="members" @close="showAttendanceOverview = false" />
      </Modal>
		</div>
	</div>
</template>

<style scoped>
.card {
margin-top: 20px;
margin-bottom: 20px;
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}

/* =========================
   HEADER
========================= */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  color: #0D47A1;
}

.date-text {
  font-size: 13px;
  color: #546E7A;
  margin-left: 2px;
}

/* Header actions (top-left cluster) */
.header-actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.view-overview-btn {
  padding: 8px 12px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}

/* =========================
   DATE CONTROLS
========================= */
.date-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.controls-inline {
  display: inline-flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.date-label {
  display: inline-flex;
  flex-direction: column;
  font-size: 12px;
  color: #546E7A;
}

.date-label input[type="date"] {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid #E0E0E0;
  background: white;
}

/* =========================
   CHART
========================= */
.chart-wrapper {
  border-radius: 8px;
  padding: 12px;
}

.no-data-text {
  color: #78909C;
  text-align: center;
  padding: 40px 0;
}

/* =========================
   RESPONSIVE
========================= */
@media (max-width: 600px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    margin-top: 6px;
  }
}

</style>
