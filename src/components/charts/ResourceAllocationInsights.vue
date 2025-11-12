<template>
  <div class="resource-card">
    <div class="header">
      <h3>Resource Allocation Insights</h3>
      <p class="subtitle">Forecasted attendance → capacity utilization → volunteers needed</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="control">
        <label>Venue Capacity</label>
        <input type="number" min="1" v-model.number="capacity" />
      </div>
      <div class="control">
        <label>Volunteer Ratio (attendees per 1 volunteer)</label>
        <input type="number" min="1" v-model.number="volunteerRatio" />
      </div>
    </div>

    <!-- Summary -->
    <div v-if="forecastRows.length > 0" class="summary-grid">
      <div class="summary-box">
        <span class="label">Next Service (predicted)</span>
        <span class="value">{{ forecastRows[0].predicted }}</span>
      </div>
      <div class="summary-box">
        <span class="label">Utilization</span>
        <span class="value">{{ forecastRows[0].utilizationPct }}%</span>
      </div>
      <div class="summary-box">
        <span class="label">Volunteers Needed</span>
        <span class="value">{{ forecastRows[0].volunteersNeeded }}</span>
      </div>
      <div class="summary-box" :class="forecastRows[0].status">
        <span class="label">Capacity Status</span>
        <span class="value">{{ forecastRows[0].statusLabel }}</span>
      </div>
    </div>
    <p v-else class="no-data-text">Need at least 5 past events with attendance to forecast resources.</p>

    <!-- Chart -->
    <div v-if="forecastRows.length > 0" class="chart-wrapper" style="height:360px;">
      <BarChart :chartData="chartData" :chartOptions="chartOptions" />
    </div>

    <!-- Table -->
    <div v-if="forecastRows.length > 0" class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Predicted</th>
            <th>Capacity</th>
            <th>Utilization</th>
            <th>Volunteers Needed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in forecastRows" :key="row.date">
            <td>{{ row.dateLabel }}</td>
            <td>{{ row.predicted }}</td>
            <td>{{ capacity }}</td>
            <td>{{ row.utilizationPct }}%</td>
            <td>{{ row.volunteersNeeded }}</td>
            <td>
              <span class="status-pill" :class="row.status">{{ row.statusLabel }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import BarChart from './BarChart.vue'
import { AttendanceForecaster, prepareAttendanceData } from '../../utils/forecasting'

const props = defineProps({
  events: { type: Array, required: true },
  attendance: { type: Array, required: true },
  isBiWeekly: { type: Boolean, default: true }
})

const capacity = ref(150)
const volunteerRatio = ref(12) // 1 volunteer per 12 attendees by default

const forecastRows = ref([])

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

function classify(util) {
  if (util >= 0.9) return { cls: 'risk', label: 'At Risk' }
  if (util >= 0.7) return { cls: 'near', label: 'Near Limit' }
  return { cls: 'ok', label: 'Comfortable' }
}

function runForecast() {
  // Build historical attendance dataset
  const records = prepareAttendanceData(props.events, props.attendance)
  if (!records || records.length < 5) {
    forecastRows.value = []
    return
  }

  // Train forecaster
  const forecaster = new AttendanceForecaster()
  const ok = forecaster.train(records)
  if (!ok) {
    forecastRows.value = []
    return
  }

  // Determine start from last past event date
  const pastEvents = props.events.filter(e => new Date(e.date) <= new Date())
  const last = pastEvents.sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-1)[0]
  const startDate = last ? last.date : new Date().toISOString().slice(0,10)

  const preds = forecaster.forecast(startDate, 4, 'regular', props.isBiWeekly)

  forecastRows.value = preds.map(p => {
    const util = capacity.value > 0 ? p.prediction / capacity.value : 0
    const status = classify(util)
    return {
      date: p.date,
      dateLabel: formatDate(p.date),
      predicted: Math.max(0, Math.round(p.prediction)),
      utilizationPct: Math.round(util * 100),
      volunteersNeeded: Math.max(0, Math.ceil((p.prediction || 0) / Math.max(volunteerRatio.value, 1))),
      status: status.cls,
      statusLabel: status.label
    }
  })
}

onMounted(runForecast)

// Recompute when controls change
watchEffect(() => {
  // re-map with new capacity/ratio if we already have predictions
  if (forecastRows.value.length > 0) {
    forecastRows.value = forecastRows.value.map(row => {
      const util = capacity.value > 0 ? row.predicted / capacity.value : 0
      const status = classify(util)
      return {
        ...row,
        utilizationPct: Math.round(util * 100),
        volunteersNeeded: Math.max(0, Math.ceil((row.predicted || 0) / Math.max(volunteerRatio.value, 1))),
        status: status.cls,
        statusLabel: status.label
      }
    })
  }
})

const chartData = computed(() => {
  return {
    labels: forecastRows.value.map(r => r.dateLabel),
    datasets: [
      {
        label: 'Predicted Attendance',
        backgroundColor: '#1E88E5',
        data: forecastRows.value.map(r => r.predicted)
      },
      {
        label: 'Capacity',
        backgroundColor: 'rgba(76, 175, 80, 0.25)',
        borderColor: '#4CAF50',
        borderWidth: 2,
        type: 'line',
        tension: 0.2,
        pointRadius: 0,
        data: forecastRows.value.map(() => capacity.value)
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' }
  },
  scales: { y: { beginAtZero: true } }
}
</script>

<style scoped>
.resource-card { background:#fff; border-radius:16px; padding:24px; box-shadow:0 6px 18px rgba(0,0,0,0.06); border:1px solid #e0e0e0; }
.header h3 { margin:0 0 4px 0; font-size:20px; font-weight:700; }
.subtitle { margin:0; font-size:13px; color:#607D8B; }
.controls { display:flex; gap:16px; flex-wrap:wrap; margin:12px 0 8px; }
.control { display:flex; flex-direction:column; gap:6px; }
.control label { font-size:12px; font-weight:600; color:#78909C; }
.control input { padding:8px 10px; border:1px solid #CFD8DC; border-radius:8px; width:200px; }
.summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin:12px 0 18px; }
.summary-box { background:#F5F5F5; padding:12px 14px; border-radius:10px; text-align:center; }
.label { display:block; font-size:11px; font-weight:600; color:#78909C; text-transform:uppercase; letter-spacing:.5px; }
.value { display:block; font-size:22px; font-weight:800; color:#0D47A1; }
.summary-box.ok { border:2px solid #C8E6C9; }
.summary-box.near { border:2px solid #FFE082; }
.summary-box.risk { border:2px solid #FFAB91; }
.no-data-text { text-align:center; padding:40px 0; color:#90A4AE; }
.table-wrap { margin-top:16px; overflow-x:auto; }
.table-wrap table { width:100%; border-collapse:collapse; font-size:14px; }
th { background:#ECEFF1; text-align:left; padding:8px; font-weight:600; font-size:12px; color:#455A64; }
td { padding:8px; border-bottom:1px solid #F0F0F0; }
.status-pill { padding:4px 10px; border-radius:999px; font-weight:700; font-size:12px; }
.status-pill.ok { background:#E8F5E9; color:#2E7D32; }
.status-pill.near { background:#FFF8E1; color:#F57C00; }
.status-pill.risk { background:#FFEBEE; color:#C62828; }
.chart-wrapper { margin-top:8px; }
@media (max-width:700px){ .control input { width:140px; } }
</style>
