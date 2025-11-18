<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import Modal from '../components/Modal.vue'
import DgroupMatchingModal from '../components/DgroupMatchingModal.vue'
import ServiceAttendanceHistory from '../components/ServiceAttendanceHistory.vue'
import AttendanceForecast from '../components/charts/AttendanceForecast.vue'
import ForecastInsights from '../components/ForecastInsights.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showDgroupModal = ref(false)
const showHistoryModal = ref(false)

// --- Forecast State ---
const forecastData = ref(null)

const onForecastReady = (data) => {
  forecastData.value = data
}

// --- Chart Options ---

// 1. Options for Historical Bar Chart (no labels)
const historicalChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { 
    legend: { display: false },
    datalabels: {
      display: false // Labels are OFF for this chart
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  }
})

// 2. NEW: Options for Doughnut Chart (with labels)
const doughnutChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' // Move legend to bottom
    },
    datalabels: {
      formatter: (value) => {
        return value > 0 ? value : ''; // Show number if > 0
      },
      color: '#333', // Dark text for labels
      font: {
        weight: 'bold',
        size: 14
      }
    }
  }
})

// 3. NEW: Options for Grouped Bar Chart (with labels)
const genderAgeChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true
    },
    datalabels: {
      formatter: (value) => {
        return value > 0 ? value : ''; // Show number if > 0
      },
      color: '#fff', // White text inside the bars
      anchor: 'center', // Position of the label
      align: 'center', // Alignment of the label
      font: {
        weight: 'bold'
      }
    }
  },
  scales: {
    x: { stacked: false },
    y: {
      beginAtZero: true,
      stacked: false,
      ticks: { stepSize: 1 }
    }
  }
})

// --- KPI Data Computations ---
const demographics = computed(() => {
  return {
    total: members.value.length,
    regulars: members.value.filter(m => m.finalTags.isRegular).length,
    leaders: members.value.filter(m => m.finalTags.isDgroupLeader).length,
    firstTimers: members.value.filter(m => m.finalTags.isFirstTimer).length,
    volunteers: members.value.filter(m => m.finalTags.isVolunteer).length,
  }
})

const attendanceTrends = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastEvents = allEvents.value.filter(
    e => new Date(e.date + 'T00:00:00') <= today
  );
  if (pastEvents.length === 0) return { avg: 0, high: 0, low: 0 };
  
  const attendanceCounts = pastEvents.map(event => {
    return allAttendance.value.filter(att => att.eventId === event.id).length;
  });
  const totalAttendance = attendanceCounts.reduce((sum, count) => sum + count, 0);
  const avg = (totalAttendance / pastEvents.length).toFixed(1);
  const high = Math.max(...attendanceCounts);
  const low = Math.min(...attendanceCounts);
  return { avg, high, low };
})

const conversionRate = computed(() => {
  const firstTimers = members.value.filter(m => m.finalTags.isFirstTimer);
  const totalFirstTimers = firstTimers.length;
  let convertedCount = 0;
  firstTimers.forEach(ft => {
    const isConverted = ft.finalTags.isRegular || !!ft.dgroupLeader
    const attendanceCount = allAttendance.value.filter(att => att.memberId === ft.id).length
    if (isConverted && attendanceCount >= 2) {
      convertedCount++
    }
  })
  const total = totalFirstTimers + convertedCount;
  if (total === 0) return { rate: 0, converted: 0, total: 0 };
  const rate = Math.round((convertedCount / total) * 100);
  return { rate, converted: convertedCount, total: total };
})

const dgroupMatching = computed(() => {
  const totalCapacity = leaders.value.reduce((sum, leader) => sum + (leader.dgroupCapacity || 8), 0)
  const totalMembersInDgroups = members.value.filter(m => !!m.dgroupLeader).length
  const openSlots = totalCapacity - totalMembersInDgroups
  return {
    seekers: seekers.value.length,
    openSlots: openSlots > 0 ? openSlots : 0
  }
})

// --- Chart Data Computations ---
const categoryDistributionData = computed(() => {
  const d = demographics.value;
  return {
    labels: ['Regulars', 'Dgroup Leaders', 'First Timers', 'Volunteers'],
    datasets: [{
      backgroundColor: ['#1976D2', '#42A5F5', '#FFCA28', '#90A4AE'],
      data: [d.regulars, d.leaders, d.firstTimers, d.volunteers]
    }]
  }
})

const genderAgeDistributionData = computed(() => {
  const malesElevate = members.value.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'Elevate').length;
  const malesB1G = members.value.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'B1G').length;
  const femalesElevate = members.value.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'Elevate').length;
  const femalesB1G = members.value.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'B1G').length;
  
  return {
    labels: ['Elevate (12-21)', 'B1G (22+)'],
    datasets: [
      {
        label: 'Male',
        backgroundColor: '#0D47A1',
        data: [malesElevate, malesB1G]
      },
      {
        label: 'Female',
        backgroundColor: '#42A5F5',
        data: [femalesElevate, femalesB1G]
      }
    ]
  }
})

const historicalAttendanceData = computed(() => {
  const recentEvents = allEvents.value.slice(0, 10).reverse()
  const labels = recentEvents.map(event => event.name)
  const data = recentEvents.map(event => {
    return allAttendance.value.filter(att => att.eventId === event.id).length
  })
  return {
    labels: labels,
    datasets: [{
      label: 'Total Attendance',
      backgroundColor: '#1E88E5',
      data: data
    }]
  }
})

const inactiveMembers = computed(() => {
  const recentEventIds = allEvents.value.slice(0, 3).map(e => e.id)
  if (recentEventIds.length === 0) return []
  const activeMemberIds = new Set(
    allAttendance.value
      .filter(att => recentEventIds.includes(att.eventId))
      .map(att => att.memberId)
  )
  return members.value.filter(member => 
    !activeMemberIds.has(member.id) && !member.finalTags.isFirstTimer
  )
})
</script>

<template>
  <div class="insights-container">
    <div class="insights-header">
      <h1>Analytics Insights</h1>
      <p>Analyze historical trends and member engagement.</p>
    </div>

    <!-- 1. Key Metrics Row (NEW STYLES) -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <h4>Total Members</h4>
        <div class="kpi-value">{{ demographics.total }}</div>
        <div class="kpi-detail-grid">
          <div>
            <strong>{{ demographics.regulars }}</strong>
            <span>Regulars</span>
          </div>
          <div>
            <strong>{{ demographics.leaders }}</strong>
            <span>Leaders</span>
          </div>
          <div>
            <strong>{{ demographics.firstTimers }}</strong>
            <span>First Timers</span>
          </div>
          <div>
            <strong>{{ demographics.volunteers }}</strong>
            <span>Volunteers</span>
          </div>
        </div>
      </div>
      
      <div class="kpi-card">
        <h4>Attendance Trends</h4>
        <div class="kpi-value">{{ attendanceTrends.avg }}</div>
        <div class="kpi-detail">Average Attendance</div>
        <div class="kpi-sub-grid">
          <div>
            <span class="kpi-sub-label">High</span>
            <span class="kpi-sub-value">{{ attendanceTrends.high }}</span>
          </div>
          <div>
            <span class="kpi-sub-label">Low</span>
            <span class="kpi-sub-value">{{ attendanceTrends.low }}</span>
          </div>
        </div>
      </div>
      
      <div class="kpi-card">
        <h4>First Timer Conversion</h4>
        <div class="kpi-value">{{ conversionRate.rate }}%</div>
        <div class="kpi-detail">
          ({{ conversionRate.converted }} of {{ conversionRate.total }} total)
        </div>
      </div>
      
      <div class="kpi-card is-clickable" @click="showDgroupModal = true">
        <h4>Dgroup Matching</h4>
        <div class="kpi-value">{{ dgroupMatching.seekers }}</div>
        <div class="kpi-detail">Seekers needing a group</div>
        <div class="kpi-value-alt">{{ dgroupMatching.openSlots }}</div>
        <div class="kpi-detail">Open Dgroup slots</div>
        <span class="click-hint">Click to view details</span>
      </div>
    </div>

    <!-- 2. Charts Grid (UPDATED) -->
    <div class="charts-grid">
      <div class="chart-card">
        <h3>Member Category Distribution</h3>
        <div class="chart-wrapper" style="height: 350px;">
          <DoughnutChart 
            v-if="demographics.total > 0"
            :chartData="categoryDistributionData" 
            :chartOptions="doughnutChartOptions"
          />
          <p v-else class="no-data-text">No members registered yet.</p>
        </div>
      </div>
      
      <div class="chart-card">
        <h3>Gender & Age Distribution</h3>
        <div class="chart-wrapper" style="height: 350px;">
          <BarChart 
            v-if="members.length > 0"
            :chartData="genderAgeDistributionData" 
            :chartOptions="genderAgeChartOptions" 
          />
          <p v-else class="no-data-text">No members registered yet.</p>
        </div>
      </div>
    </div>

    <!-- 3. Historical Attendance Chart -->
    <div class="chart-card-full">
      <div class="section-title-with-button">
        <h3>Historical Attendance (Last 10 Events)</h3>
        <button class="view-details-btn" @click="showHistoryModal = true">
          View Weekend Service History
        </button>
      </div>
      <div class="chart-wrapper" style="height: 350px;">
        <BarChart 
          v-if="historicalAttendanceData.labels.length > 0"
          :chartData="historicalAttendanceData" 
          :chartOptions="historicalChartOptions" 
        />
        <p v-else class="no-data-text">No event data yet. Create an event and record attendance to see a trend.</p>
      </div>
    </div>
    
    <!-- 4. Forecasting Section -->
    <div class="forecasting-section">
      <div class="forecast-grid">
        <AttendanceForecast 
          :events="allEvents"
          :attendance="allAttendance"
          @forecast-ready="onForecastReady"
        />
        
        <ForecastInsights 
          v-if="forecastData"
          :forecastData="forecastData"
        />
      </div>
    </div>

    <!-- 5. Inactive Member List -->
    <div class="list-card">
      <h3>Inactive Members (For Follow-up)</h3>
      <p class="list-subtitle">Members who have not attended the last 3 events.</p>
      <ul v-if="inactiveMembers.length > 0" class="member-follow-list">
        <li v-for="member in inactiveMembers" :key="member.id">
          <strong>{{ member.firstName }} {{ member.lastName }}</strong>
          <span>{{ member.email || 'No Email' }}</span>
        </li>
      </ul>
      <p v-else class="no-data-text">No inactive members found. Great job!</p>
    </div>


  </div>
  
  <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl">
    <DgroupMatchingModal @close="showDgroupModal = false" />
  </Modal>
  
  <Modal v-if="showHistoryModal" @close="showHistoryModal = false" size="xl">
    <ServiceAttendanceHistory @close="showHistoryModal = false" />
  </Modal>
  
</template>

<style scoped>
.insights-container {
  padding: 20px;
}
.insights-header {
  margin-bottom: 24px;
}
.insights-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}
.insights-header p {
  font-size: 16px;
  color: #546E7A;
  margin-top: 4px;
}

/* --- NEW KPI Card Styles --- */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}
.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: all 0.2s ease;
}
.kpi-card.is-clickable {
  cursor: pointer;
  border: 2px solid transparent;
}
.kpi-card.is-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #1976D2;
}
.click-hint {
  font-size: 12px;
  color: #1976D2;
  font-weight: 500;
  margin-top: 8px;
  display: block;
}

.kpi-card h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #546E7A;
}
.kpi-value {
  font-size: 40px;
  font-weight: 700;
  color: #0D47A1;
  line-height: 1;
}
.kpi-value-alt {
  font-size: 28px;
  font-weight: 600;
  color: #333;
  line-height: 1;
  margin-top: 12px;
}
.kpi-detail {
  font-size: 14px;
  color: #78909C;
  margin-top: 4px;
}
.kpi-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 8px;
  column-gap: 4px;
  font-size: 14px;
  color: #546E7A;
  margin-top: 12px;
}
.kpi-detail-grid div {
  display: flex;
  flex-direction: column;
}
.kpi-detail-grid strong {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.kpi-sub-grid {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ECEFF1;
}
.kpi-sub-grid div {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-grow: 1;
}
.kpi-sub-label {
  font-size: 12px;
  font-weight: 500;
  color: #78909C;
  margin-bottom: 2px;
}
.kpi-sub-value {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

/* --- Chart Cards --- */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 20px;
}
@media (min-width: 900px) { /* Changed breakpoint */
  .charts-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.chart-card-full {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}
.chart-card h3, .chart-card-full h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
.chart-wrapper {
  position: relative;
}

/* --- List Card --- */
.list-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.list-card h3 {
  margin-top: 0;
  margin-bottom: 4px;
  font-size: 18px;
  font-weight: 600;
}
.list-subtitle {
  font-size: 14px;
  color: #546E7A;
  margin-top: 0;
  margin-bottom: 20px;
}
.member-follow-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}
.member-follow-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #ECEFF1;
}
.member-follow-list li:last-child {
  border-bottom: none;
}
.member-follow-list li strong {
  font-weight: 600;
  color: #333;
}
.member-follow-list li span {
  font-size: 14px;
  color: #546E7A;
}

.no-data-text {
  text-align: center;
  padding: 40px;
  color: #78909C;
}

/* --- Section Title with Button --- */
.section-title-with-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title-with-button h3 {
  margin: 0;
}

.view-details-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
}

.view-details-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%);
}

@media (max-width: 600px) {
  .section-title-with-button {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .view-details-btn {
    width: 100%;
  }
}

/* --- Forecasting Section --- */
.forecasting-section {
  margin: 40px 0;
  padding: 24px 0;
  border-top: 2px solid #E3F2FD;
}

.forecast-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

@media (min-width: 768px) {
  .forecast-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>