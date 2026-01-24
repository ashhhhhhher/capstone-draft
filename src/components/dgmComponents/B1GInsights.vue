<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../../stores/members'
import { useEventsStore } from '../../stores/events'
import { useAttendanceStore } from '../../stores/attendance'
import BarChart from '../charts/BarChart.vue'
import DoughnutChart from '../charts/DoughnutChart.vue'
import ExportButton from './ExportButton.vue'

// Collapse state
const open = ref(false)

// Stores
const membersStore = useMembersStore()
const { activeMembers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- B1G Filters / Computations ---
const b1gMembers = computed(() => {
  return (activeMembers.value || []).filter(m => m?.finalTags?.ageCategory === 'B1G')
})

const b1gEvents = computed(() => {
  const events = (allEvents.value || [])
  return events.filter(e => {
    if (!e) return false
    const name = (e.name || '').toString().toLowerCase()
    return (e.eventType && e.eventType.toString().toLowerCase() === 'b1g') || name.includes('b1g')
  }).sort((a, b) => new Date(a.date) - new Date(b.date))
})

// Date range for historical view
const todayStr = new Date().toISOString().split('T')[0]
const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()
const fromDate = ref(defaultFrom)
const toDate = ref(todayStr)

const b1gEventsInRange = computed(() => {
  if (!fromDate.value || !toDate.value) return []
  if (new Date(fromDate.value) > new Date(toDate.value)) return []
  return b1gEvents.value.filter(e => e.date >= fromDate.value && e.date <= toDate.value)
})

const eventsCount = computed(() => b1gEventsInRange.value.length || b1gEvents.value.length)

// Average attendance across events in selected range (or across all B1G events if no range)
const averageB1gAttendance = computed(() => {
  const events = b1gEventsInRange.value.length ? b1gEventsInRange.value : b1gEvents.value
  if (!events.length) return 0
  const total = events.reduce((sum, ev) => sum + ((allAttendance.value || []).filter(a => a.eventId === ev.id).length), 0)
  return +(total / events.length).toFixed(1)
})

const genderBreakdown = computed(() => {
  const males = b1gMembers.value.filter(m => m.gender === 'Male').length
  const females = b1gMembers.value.filter(m => m.gender === 'Female').length
  return { males, females }
})

// Chart data
const historicalChartData = computed(() => {
  const events = b1gEventsInRange.value.length ? b1gEventsInRange.value : b1gEvents.value
  if (!events.length) return { labels: [], datasets: [{ label: 'Attendance', backgroundColor: '#1E88E5', data: [] }] }
  const labels = events.map(e => `${e.name || 'B1G'} (${e.date || ''})`)
  const data = events.map(e => (allAttendance.value || []).filter(a => a.eventId === e.id).length)
  return { labels, datasets: [{ label: 'Attendance', backgroundColor: '#1E88E5', data }] }
})

const genderChartData = computed(() => ({
  labels: ['Male', 'Female'],
  datasets: [{ backgroundColor: ['#1976D2', '#42A5F5'], data: [genderBreakdown.value.males, genderBreakdown.value.females] }]
}))

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }

</script>

<template>
  <div class="b1g-card">
    <div class="b1g-header" @click="open = !open">
      <div class="title">B1G Services</div>
      <button class="toggle-btn" :aria-expanded="open">{{ open ? 'Hide' : 'Show' }}</button>
    </div>

    <div v-show="open" class="b1g-body">
      <div class="kpi-row">
        <div class="kpi small">
          <div class="kpi-label">B1G Members</div>
          <div class="kpi-value">{{ b1gMembers.length }}</div>
          <div class="kpi-sub">Male: {{ genderBreakdown.males }} · Female: {{ genderBreakdown.females }}</div>
        </div>

        <div class="kpi small">
          <div class="kpi-label">Events Count</div>
          <div class="kpi-value">{{ eventsCount }}</div>
          <div class="kpi-sub">Total B1G events recorded</div>
        </div>

        <div class="kpi small">
          <div class="kpi-label">Average Attendance</div>
          <div class="kpi-value">{{ averageB1gAttendance }}</div>
          <div class="kpi-sub">Average per event (selected range)</div>
        </div>
       
      </div>

      <div class="charts-row">
        <div class="chart-panel">
           <hr />
          <div class="section-title-with-button" style="align-items:flex-start; margin-bottom:8px;">
            <div style="display:flex; flex-direction:column; gap:6px;">
              <h4 style="margin:0">Historical Attendance</h4>
              <div class="date-text">Select a date range to view historical B1G attendance</div>
            </div>

            <div class="header-actions" style="display:flex; gap:8px; align-items:center;">
              <button class="view-overview-btn" @click="open = true">View Details</button>
              <ExportButton exportType="events" :eventsList="b1gEventsInRange" />
            </div>
          </div>

          <div class="date-controls" style="margin-bottom:10px;">
            <div class="controls-inline">
              <label class="date-label">From<input type="date" v-model="fromDate" /></label>
              <label class="date-label">To<input type="date" v-model="toDate" :max="todayStr" /></label>
            </div>
          </div>
          <div class="chart-wrapper"><BarChart v-if="historicalChartData.labels.length" :chartData="historicalChartData" :chartOptions="chartOptions" /><p v-else class="no-data">No B1G events found for selected range.</p></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.b1g-card { background: #fff; border-radius: 12px; padding: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; overflow: hidden; }
.b1g-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; border-bottom:1px solid #ECEFF1; }
hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}

.b1g-header .title { font-size:16px; font-weight:600; color:#0D47A1 }
.toggle-btn { background:#1976D2; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:600; cursor:pointer }
.b1g-body { padding:16px 20px }
.kpi-row { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px }
.kpi { background:#F9FAFB; border-radius:8px; padding:12px }
.kpi.small .kpi-label { font-size:12px; color:#546E7A }
.kpi-value { font-size:22px; font-weight:700; color:#0D47A1 }
.kpi-sub { font-size:12px; color:#78909C; margin-top:6px }
.section-title-with-button { display:flex; justify-content:space-between; align-items: center }
.view-overview-btn {
  padding: 8px 12px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.date-text {
  font-size: 13px;
  color: #546E7A;
  margin-left: 2px;
}
.date-label { display:inline-flex; flex-direction:column; font-size:12px; color:#546E7A }
.date-label input[type="date"] { margin-top:4px; padding:6px 8px; border-radius:8px; border:1px solid #E0E0E0; background:white }
.charts-row { display:block }
.chart-panel { background:transparent; padding:0; width:100% }
.chart-wrapper { height:220px; background:white; border-radius:8px; padding:8px; box-shadow: 0 1px 4px rgba(0,0,0,0.03) }
.no-data { color:#78909C; padding:24px; text-align:center }
@media (max-width:900px) { .charts-row { grid-template-columns: 1fr } }
</style>
