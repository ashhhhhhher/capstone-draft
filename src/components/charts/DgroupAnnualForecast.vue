<template>
  <div class="annual-forecast-card">
    <div class="header">
      <h3>D-Group Annual Forecast</h3>
      <p class="subtitle">Projected leaders & members (next year) via polynomial trend</p>
    </div>

    <div v-if="combined.length > 0" class="summary-grid">
      <div class="summary-box">
        <span class="label">Current Leaders</span>
        <span class="value">{{ currentLeaders }}</span>
      </div>
      <div class="summary-box">
        <span class="label">Projected Leaders +1y</span>
        <span class="value">{{ projectedLeaders }}</span>
      </div>
      <div class="summary-box">
        <span class="label">Current Members</span>
        <span class="value">{{ currentMembers }}</span>
      </div>
      <div class="summary-box">
        <span class="label">Projected Members +1y</span>
        <span class="value">{{ projectedMembers }}</span>
      </div>
    </div>

    <div v-if="combined.length > 0" class="chart-wrapper" style="height:360px;">
      <BarChart :chartData="chartData" :chartOptions="chartOptions" />
    </div>
    <p v-else class="no-data-text">Not enough historical data to produce an annual forecast (need ≥ 3 years or fallback assumptions).</p>

    <div v-if="combined.length > 0" class="increments-section">
      <h4>Yearly Increments</h4>
      <table class="inc-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Leaders</th>
            <th>Δ Leaders</th>
            <th>Members</th>
            <th>Δ Members</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in combined" :key="row.year">
            <td>{{ row.year }}</td>
            <td>{{ row.leaders }}</td>
            <td :class="row.leadersInc >= 0 ? 'pos' : 'neg'">{{ row.leadersInc }}</td>
            <td>{{ row.members }}</td>
            <td :class="row.membersInc >= 0 ? 'pos' : 'neg'">{{ row.membersInc }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { DgroupAnnualForecaster } from '../../utils/forecasting'
import BarChart from './BarChart.vue'

const props = defineProps({
  members: { type: Array, required: true },
  attendance: { type: Array, required: true }
})

const forecaster = new DgroupAnnualForecaster()
const combined = ref([])

function run() {
  forecaster.buildAnnualSeries(props.members, props.attendance)
  combined.value = forecaster.getCombinedWithIncrements(1)
}

watch(() => [props.members, props.attendance], run, { deep: true })
onMounted(run)

const currentLeaders = computed(() => {
  const last = combined.value[combined.value.length - 2] // second to last = current year (before forecast)
  return last ? last.leaders : 0
})
const projectedLeaders = computed(() => {
  const last = combined.value[combined.value.length - 1]
  return last ? last.leaders : 0
})
const currentMembers = computed(() => {
  const last = combined.value[combined.value.length - 2]
  return last ? last.members : 0
})
const projectedMembers = computed(() => {
  const last = combined.value[combined.value.length - 1]
  return last ? last.members : 0
})

const chartData = computed(() => {
  return {
    labels: combined.value.map(r => r.year),
    datasets: [
      {
        label: 'Leaders',
        backgroundColor: '#1976D2',
        data: combined.value.map(r => r.leaders)
      },
      {
        label: 'Members',
        backgroundColor: '#42A5F5',
        data: combined.value.map(r => r.members)
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { mode: 'index', intersect: false }
  },
  scales: {
    y: { beginAtZero: true }
  }
}
</script>

<style scoped>
.annual-forecast-card { background:#fff; border-radius:16px; padding:24px; box-shadow:0 6px 18px rgba(0,0,0,0.06); border:1px solid #e0e0e0; }
.header h3 { margin:0 0 4px 0; font-size:20px; font-weight:700; }
.subtitle { margin:0; font-size:13px; color:#607D8B; }
.summary-grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin:20px 0; }
.summary-box { background:#F5F5F5; padding:12px 14px; border-radius:10px; text-align:center; }
.label { display:block; font-size:11px; font-weight:600; color:#78909C; text-transform:uppercase; letter-spacing:.5px; }
.value { display:block; font-size:22px; font-weight:800; color:#0D47A1; }
.no-data-text { text-align:center; padding:40px 0; color:#90A4AE; }
.increments-section { margin-top:28px; }
.increments-section h4 { margin:0 0 12px 0; font-size:16px; font-weight:700; }
.inc-table { width:100%; border-collapse:collapse; font-size:14px; }
.inc-table th { background:#ECEFF1; text-align:left; padding:8px; font-weight:600; font-size:12px; color:#455A64; }
.inc-table td { padding:8px; border-bottom:1px solid #F0F0F0; }
.inc-table tr:last-child td { border-bottom:none; }
.pos { color:#2E7D32; font-weight:600; }
.neg { color:#D32F2F; font-weight:600; }
@media (max-width:700px){ .summary-grid { grid-template-columns:1fr 1fr; } }
</style>
