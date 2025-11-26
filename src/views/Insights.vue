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
import ExportButton from '../components/ExportButton.vue'
import EventComparison from '../components/EventComparison.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, activeMembers, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showDgroupModal = ref(false)
const showHistoryModal = ref(false)


// --- Chart Options ---
const historicalChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { 
    legend: { display: false },
    datalabels: { display: false }
  },
  scales: {
    y: { 
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  }
})

const doughnutChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    datalabels: {
      formatter: (value) => { return value > 0 ? value : ''; },
      color: '#333',
      font: { weight: 'bold', size: 14 }
    }
  }
})

const genderAgeChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true },
    datalabels: {
      formatter: (value) => { return value > 0 ? value : ''; },
      color: '#fff',
      anchor: 'center',
      align: 'center',
      font: { weight: 'bold' }
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
    total: activeMembers.value.length,
    regulars: activeMembers.value.filter(m => m.finalTags.isRegular).length,
    leaders: activeMembers.value.filter(m => m.finalTags.isDgroupLeader).length,
    firstTimers: activeMembers.value.filter(m => m.finalTags.isFirstTimer).length,
    volunteers: activeMembers.value.filter(m => m.finalTags.isVolunteer).length,
  }
})

const attendanceTrends = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastEvents = allEvents.value.filter(e => new Date(e.date + 'T00:00:00') <= today);
  if (pastEvents.length === 0) return { avg: 0, high: 0, low: 0 };
  
  const attendanceCounts = pastEvents.map(event => allAttendance.value.filter(att => att.eventId === event.id).length);
  const totalAttendance = attendanceCounts.reduce((sum, count) => sum + count, 0);
  const avg = (totalAttendance / pastEvents.length).toFixed(1);
  const high = Math.max(...attendanceCounts);
  const low = Math.min(...attendanceCounts);
  return { avg, high, low };
})

const conversionRate = computed(() => {
  const firstTimers = activeMembers.value.filter(m => m.finalTags.isFirstTimer);
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
  const totalMembersInDgroups = activeMembers.value.filter(m => !!m.dgroupLeader).length
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
    labels: ['Regulars', 'Dgroup Leaders', 'First Timers'],
    datasets: [{
      backgroundColor: ['#1976D2', '#42A5F5', '#FFCA28'],
      data: [d.regulars, d.leaders, d.firstTimers]
    }]
  }
})

const genderAgeDistributionData = computed(() => {
  const malesElevate = activeMembers.value.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'Elevate').length;
  const malesB1G = activeMembers.value.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'B1G').length;
  const femalesElevate = activeMembers.value.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'Elevate').length;
  const femalesB1G = activeMembers.value.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'B1G').length;
  
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

const volunteerBreakdown = computed(() => {
    const ministries = ['Host', 'Live Prod', 'Exalt', 'DGM'];
    const counts = {};
    let totalVolunteers = 0;

    activeMembers.value.filter(m => m.finalTags.isVolunteer).forEach(m => {
        m.finalTags.volunteerMinistry.forEach(ministry => {
            if (ministries.includes(ministry)) {
                counts[ministry] = (counts[ministry] || 0) + 1;
                totalVolunteers++;
            }
        });
    });

    return {
        total: totalVolunteers,
        data: ministries.map(name => ({
            name,
            count: counts[name] || 0,
            percent: totalVolunteers > 0 ? Math.round((counts[name] || 0) / totalVolunteers * 100) : 0
        }))
    }
})

const getMinistryColor = (name) => {
    switch(name) {
        case 'Host': return '#F57C00';
        case 'Live Prod': return '#00BCD4';
        case 'Exalt': return '#4CAF50';
        case 'Usher': return '#9C27B0';
        default: return '#90A4AE';
    }
}

// --- Date range picker state (new) ---
const todayStr = new Date().toISOString().split('T')[0]
const defaultFrom = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
})()
const fromDate = ref(defaultFrom)
const toDate = ref(todayStr)

// --- Chart Data Computations ---
// replace historicalAttendanceData logic so it respects fromDate/toDate
const historicalAttendanceData = computed(() => {
  // Validate range
  if (!fromDate.value || !toDate.value) return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }

  // Ensure from <= to
  if (new Date(fromDate.value) > new Date(toDate.value)) {
    return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }
  }

  // Filter service events inside the inclusive date range, sort ascending
  const eventsInRange = allEvents.value
    .filter(e => e.eventType === 'service' && e.date >= fromDate.value && e.date <= toDate.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!eventsInRange.length) {
    return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }
  }

  const labels = eventsInRange.map(ev => `${ev.name} (${ev.date})`)
  const data = eventsInRange.map(ev => allAttendance.value.filter(att => att.eventId === ev.id).length)

  return {
    labels,
    datasets: [{
      label: 'Total Attendance',
      backgroundColor: '#1E88E5',
      data
    }]
  }
})

// --- KPI UI state ---
const monitoringOpen = ref(true)

function toggleMonitoring() {
  monitoringOpen.value = !monitoringOpen.value
}

// Tab state for Overall / Event Comparison
const selectedTab = ref('Overall')

function selectTab(name) {
  selectedTab.value = name
}
</script>

<template>
  <div class="insights-container">
    <div class="insights-header">
      <h1>Analytics Insights</h1>
      <p>Analyze historical trends and member engagement.</p>
    </div>

    <div class="insights-tabs-row">
      <div class="insights-tabs">
        <button :class="['tab-button', { active: selectedTab === 'Overall' }]" @click="selectTab('Overall')">Overall</button>
        <button :class="['tab-button', { active: selectedTab === 'Event Comparison' }]" @click="selectTab('Event Comparison')">Event Comparison</button>
      </div>
    </div>

    <!-- Overall tab content -->
    <div v-if="selectedTab === 'Overall'">
      <!-- 1. Key Metrics Row -->
      <div class="kpi-grid">
      <!-- Total Members -->
      <div class="kpi-card">
        <div class="kpi-card-header">
            <h4>Total Members</h4>
            <ExportButton exportType="members" /> 
        </div>
        
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
      
      <!-- Attendance Trends -->
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
      
      <!-- Conversion -->
      <div class="kpi-card">
        <h4>First Timer Conversion</h4>
        <div class="kpi-value">{{ conversionRate.rate }}%</div>
        <div class="kpi-detail">
          ({{ conversionRate.converted }} of {{ conversionRate.total }} total)
        </div>
      </div>
      
      <!-- Matching -->
      <div class="kpi-card is-clickable" @click="showDgroupModal = true">
        <h4>Dgroup Matching</h4>
        <div class="kpi-value">{{ dgroupMatching.seekers }}</div>
        <div class="kpi-detail">Seekers needing a group</div>
        <div class="kpi-value-alt">{{ dgroupMatching.openSlots }}</div>
        <div class="kpi-detail">Open Dgroup slots</div>
        <span class="click-hint">Click to view details</span>
      </div>
      </div>

      <!-- 2. Charts Grid -->
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
      
      <!-- 3. Volunteer Breakdown Section -->
      <div class="chart-card-full">
      <h3>Volunteer Ministry Breakdown (Total: {{ volunteerBreakdown.total }})</h3>
      <div v-if="volunteerBreakdown.total > 0" class="volunteer-progress-list">
        <div v-for="item in volunteerBreakdown.data" :key="item.name" class="ministry-item">
          <div class="ministry-label">
            <strong>{{ item.name }}</strong>
            <span>{{ item.count }} Members ({{ item.percent }}%)</span>
          </div>
          <div class="progress-bar-wrapper">
            <div 
              class="ministry-progress-bar" 
              :style="{ width: item.percent + '%', backgroundColor: getMinistryColor(item.name) }"
            ></div>
          </div>
        </div>
      </div>
      <p v-else class="no-data-text">No volunteers currently tagged to a specific ministry.</p>
      </div>

      <!-- 4. Historical Attendance Chart -->
      <div class="chart-card-full">
      <div class="section-title-with-button">
        <h3>Historical Events Attendance</h3>

        <!-- Date range picker + Export button -->
        <div class="controls-inline">
          <label class="date-label">From
            <input type="date" v-model="fromDate" />
          </label>
          <label class="date-label">To
            <input type="date" v-model="toDate" :max="(new Date()).toISOString().split('T')[0]" />
          </label>
          <ExportButton exportType="events" />
        </div>
      </div>

      <div class="chart-wrapper" style="height: 350px;">
        <BarChart 
          v-if="historicalAttendanceData.labels.length > 0"
          :chartData="historicalAttendanceData" 
          :chartOptions="historicalChartOptions" 
        />
        <p v-else class="no-data-text">No event data in the selected date range. Adjust the range to view attendance.</p>
      </div>
      </div>
    </div>

    <!-- Event Comparison tab content -->
    <div v-else class="event-comparison-panel">
      <EventComparison />
    </div>

    <!-- 6. Dgroup Matching Modal (available regardless of tab) -->
    <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl">
      <DgroupMatchingModal @close="showDgroupModal = false" />
    </Modal>
  </div>
</template>

<style scoped>
.insights-container {
  padding: 20px;
}

.insights-header {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ECEFF1;
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

/* improved header card */

.insights-tabs-row { border-bottom: 1px solid #ECEFF1;}
.insights-tabs { margin: 0 }
.tab-button { padding: 8px 12px }

/* --- KPI Cards --- */
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

.kpi-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.kpi-card-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #546E7A;
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

@media (min-width: 900px) {
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

.chart-card h3,
.chart-card-full h3,
.list-card h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.chart-wrapper {
  position: relative;
}

/* --- Export/Title Styles --- */
.section-title-with-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title-with-button h3 {
  margin: 0;
}

@media (max-width: 600px) {
  .section-title-with-button {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

/* --- Volunteer Progress Bar Styles --- */
.volunteer-progress-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 10px;
}

.ministry-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ministry-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.ministry-label strong {
  color: #37474F;
  font-weight: 600;
}

.ministry-label span {
  color: #546E7A;
}

.progress-bar-wrapper {
  height: 12px;
  background-color: #ECEFF1;
  border-radius: 6px;
  overflow: hidden;
}

.ministry-progress-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

/* simple inline controls for the date range */
.section-title-with-button .controls-inline {
  display: inline-flex;
  gap: 8px;
  align-items: center;
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

/* responsive adjustments */
@media (max-width: 600px) {
  .section-title-with-button .controls-inline {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}

/* --- Tabs --- */
.insights-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  align-items: center;
}
.tab-button {
  padding: 8px 12px;
  border-radius: 0;
  border: none;
  background: transparent;
  color: #37474F;
  cursor: pointer;
  font-weight: 600;
  position: relative;
}
.tab-button:hover { color: #1E6FB8; }
.tab-button.active { color: #1976D2; }
.tab-button.active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -12px;
  height: 3px;
  background: #1976D2;
  border-radius: 2px;
}
.event-comparison-panel {
  margin-top: 8px;
}
</style>