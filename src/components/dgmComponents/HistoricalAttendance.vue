<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'
import { useMembersStore } from '../../stores/members'
import { Eye } from 'lucide-vue-next'
import BarChart from '../charts/BarChart.vue'
import LineChart from '../charts/LineChart.vue'
import Modal from './Modal.vue'
import AttendanceOverviewModal from './AttendanceOverviewModal.vue'
import ExportButton from './ExportButton.vue'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  eventType: {
    type: String,
    default: 'service' 
  }
})

const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()
const membersStore = useMembersStore()

const { allEvents } = storeToRefs(eventsStore)
const { members } = storeToRefs(membersStore)

// 🚀 OPTIMIZATION: Use a local ref to store ONLY the currently viewed range
const fetchedRangeAttendance = ref([])

// --- UI Controls State ---
const todayStr = new Date().toISOString().split('T')[0]
const activeFilter = ref('monthly') 
const chartType = ref('bar') 
const showAttendanceOverview = ref(false)

const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().toISOString().substring(0, 7)) 

const fromDate = ref((() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })())
const toDate = ref(todayStr)

// --- Watch Filters to Load Data ---
async function loadDataForRange() {
  let start = '';
  let end = '';

  if (activeFilter.value === 'yearly') {
    start = `${selectedYear.value}-01-01`;
    end = `${selectedYear.value}-12-31`;
  } else if (activeFilter.value === 'monthly') {
    // Basic calculation for end of month
    start = `${selectedMonth.value}-01`;
    const tempDate = new Date(`${selectedMonth.value}-01`);
    tempDate.setMonth(tempDate.getMonth() + 1);
    tempDate.setDate(0); 
    end = tempDate.toISOString().split('T')[0];
  } else if (activeFilter.value === 'custom') {
    start = fromDate.value;
    end = toDate.value;
  }

  if (start && end) {
    fetchedRangeAttendance.value = await attendanceStore.fetchAttendanceByDateRange(start, end);
  }
}

onMounted(() => {
  loadDataForRange();
})

watch([activeFilter, selectedYear, selectedMonth, fromDate, toDate], () => {
  loadDataForRange();
})

const chartThemeColor = computed(() => props.eventType === 'b1g' ? '#8AE1FC' : '#068FFF')
const chartThemeBgColor = computed(() => props.eventType === 'b1g' ? 'rgba(138, 225, 252, 0.2)' : 'rgba(6, 143, 255, 0.2)')

const historicalChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: chartType.value === 'bar' ? 25 : 0 
    }
  },
  plugins: { 
    legend: { display: false }, 
    datalabels: { 
      display: chartType.value === 'bar',
      anchor: 'end',
      align: 'end',
      offset: 4,
      color: '#546E7A',
      font: {
        weight: '600',
        size: 12
      }
    } 
  },
  scales: { 
    x: {
      grid: { display: false }
    },
    y: { 
      beginAtZero: true, 
      suggestedMax: 300, 
      ticks: { stepSize: 50, precision: 0 },
      grid: { color: '#F0F2F5' },
      border: { display: false }
    } 
  }
}))


const allEventsOfType = computed(() => {
  return (allEvents.value || [])
    .filter(e => {
      return props.eventType === 'b1g' 
        ? (e.eventType === 'b1g' || e.name.toLowerCase().includes('b1g'))
        : e.eventType === props.eventType;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
});

const availableYears = computed(() => {
  const years = new Set(allEventsOfType.value.map(e => e.date.substring(0, 4)));
  if (years.size === 0) years.add(new Date().getFullYear().toString());
  return Array.from(years).sort().reverse();
});

const processedChartData = computed(() => {
  let labels = [];
  let data = [];

  if (activeFilter.value === 'yearly') {
     labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
     data = new Array(12).fill(0);
     
     allEventsOfType.value.forEach(e => {
        if (e.date.startsWith(selectedYear.value.toString())) {
           const d = new Date(e.date);
           const monthIdx = d.getMonth();
           const count = fetchedRangeAttendance.value.filter(a => a.eventId === e.id).length;
           data[monthIdx] += count;
        }
     });

  } else if (activeFilter.value === 'monthly') {
     labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
     data = new Array(5).fill(0);
     
     allEventsOfType.value.forEach(e => {
        if (e.date.startsWith(selectedMonth.value)) {
           const day = parseInt(e.date.split('-')[2]);
           let weekIdx = Math.floor((day - 1) / 7);
           if (weekIdx > 4) weekIdx = 4; 
           
           const count = fetchedRangeAttendance.value.filter(a => a.eventId === e.id).length;
           data[weekIdx] += count;
        }
     });

  } else if (activeFilter.value === 'custom') {
     const customEvents = allEventsOfType.value.filter(e => e.date >= fromDate.value && e.date <= toDate.value);
     
     customEvents.forEach(e => {
        const d = new Date(e.date);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        data.push(fetchedRangeAttendance.value.filter(a => a.eventId === e.id).length);
     });
  }

  return { labels, data };
});

const historicalAttendanceData = computed(() => {
  const { labels, data } = processedChartData.value;
  
  if (labels.length === 0 || data.every(v => v === 0) && activeFilter.value === 'custom') {
     return { labels: [], datasets: [] }; 
  }

  return { 
    labels, 
    datasets: [{ 
      label: 'Attendance', 
      backgroundColor: chartType.value === 'line' ? chartThemeBgColor.value : chartThemeColor.value,
      borderColor: chartThemeColor.value,
      borderWidth: 2,
      borderRadius: chartType.value === 'bar' ? 4 : 0,
      fill: chartType.value === 'line', 
      tension: 0.4, 
      pointBackgroundColor: '#fff',
      pointBorderColor: chartThemeColor.value,
      pointBorderWidth: 2,
      pointRadius: chartType.value === 'line' ? 4 : 0,
      data 
    }] 
  }
})

const filteredEventsForExport = computed(() => {
  if (activeFilter.value === 'yearly') {
    return allEventsOfType.value.filter(e => e.date.startsWith(selectedYear.value.toString()));
  } else if (activeFilter.value === 'monthly') {
    return allEventsOfType.value.filter(e => e.date.startsWith(selectedMonth.value));
  } else if (activeFilter.value === 'custom') {
    return allEventsOfType.value.filter(e => e.date >= fromDate.value && e.date <= toDate.value);
  }
  return allEventsOfType.value;
});

const latestEventsForTable = computed(() => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  return allEventsOfType.value
    .filter(e => new Date(e.date) <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
});

const tableRecords = computed(() => {
  return latestEventsForTable.value.map(event => {
    // Use the locally fetched range instead of ALL history
    const eventAttendance = fetchedRangeAttendance.value.filter(a => a.eventId === event.id)
    
    let elevF = 0, elevM = 0, b1gF = 0, b1gM = 0, dl = 0, vols = 0;
    
    eventAttendance.forEach(a => {
      const m = (members.value || []).find(mem => mem.id === a.memberId)
      if (!m) return;
      
      const isElev = m.finalTags?.ageCategory === 'Elevate'
      const isB1g = m.finalTags?.ageCategory === 'B1G'
      const isF = m.gender === 'Female'
      const isM = m.gender === 'Male'
      
      if (isElev && isF) elevF++;
      if (isElev && isM) elevM++;
      if (isB1g && isF) b1gF++;
      if (isB1g && isM) b1gM++;
      
      if (m.role === 'dleader' || m.finalTags?.isDgroupLeader) dl++;
      else if (m.role === 'volunteer' || m.finalTags?.isVolunteer || (a.ministry && a.ministry !== 'N/A')) vols++;
    })

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      total: eventAttendance.length,
      elevF, elevM, b1gF, b1gM, dl, vols
    }
  });
})

const formatDate = (dateString) => {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>

<template>
  <div class="historical-section">
    <!-- Chart Section Header -->
    <div class="section-badge-header">
       <span class="badge">{{ eventType === 'service' ? 'WKND' : 'B1G' }}</span>
       <span class="title-text">HISTORICAL ATTENDANCE</span>
    </div>

    <!-- Main Chart Card -->
    <div class="chart-card">
      <div class="toolbar">
        <div class="filters-group">
          <!-- Timeframe Pills -->
          <div class="pill-group">
            <button class="pill" :class="{ active: activeFilter === 'yearly' }" @click="activeFilter = 'yearly'">Yearly</button>
            <button class="pill" :class="{ active: activeFilter === 'monthly' }" @click="activeFilter = 'monthly'">Monthly</button>
            <button class="pill" :class="{ active: activeFilter === 'custom' }" @click="activeFilter = 'custom'">Custom</button>
          </div>

          <div class="divider"></div>

          <!-- Dynamic Date Pickers -->
          <div class="date-pickers" v-if="activeFilter === 'yearly'">
            <span class="label">Year</span>
            <select v-model="selectedYear" class="input-styled">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>

          <div class="date-pickers" v-else-if="activeFilter === 'monthly'">
            <span class="label">Month</span>
            <input type="month" v-model="selectedMonth" class="input-styled" />
          </div>

          <div class="date-pickers" v-else-if="activeFilter === 'custom'">
            <span class="label">From</span>
            <input type="date" v-model="fromDate" class="input-styled" />
            <span class="label">To</span>
            <input type="date" v-model="toDate" :max="todayStr" class="input-styled" />
          </div>

          <div class="divider"></div>

          <!-- Chart Type Toggle -->
          <div class="chart-toggles">
            <button class="toggle-btn" :class="{ active: chartType === 'bar' }" @click="chartType = 'bar'">Bar</button>
            <button class="toggle-btn" :class="{ active: chartType === 'line' }" @click="chartType = 'line'">Line</button>
          </div>
        </div>
        
        <div class="actions">
          <div class="export-wrap">
             <ExportButton 
                exportType="events" 
                :eventsList="filteredEventsForExport" 
                :yearlySummaryData="activeFilter === 'yearly' ? { year: selectedYear, labels: processedChartData.labels, data: processedChartData.data } : null"
             />
          </div>
        </div>
      </div>

      <div class="chart-wrapper" style="height: 350px;">
        <BarChart v-if="chartType === 'bar' && historicalAttendanceData.labels.length > 0" :chartData="historicalAttendanceData" :chartOptions="historicalChartOptions" />
        <LineChart v-else-if="chartType === 'line' && historicalAttendanceData.labels.length > 0" :chartData="historicalAttendanceData" :chartOptions="historicalChartOptions" />
        <p v-else class="no-data-text">No event data available for the selected range.</p>
      </div>
    </div>

    <!-- Detailed Records Table (Always Latest 10) -->
    <div class="records-header mt-8">
       <div class="section-badge-header">
           <span class="badge">{{ eventType === 'service' ? 'WKND' : 'B1G' }}</span>
           <span class="title-text">LATEST ATTENDANCE RECORDS</span>
       </div>
       <!-- Note: The Overview modal might need similar pagination if it shows all time. For now, we will pass the fetched range to it. -->
       <button class="view-full-btn" @click="showAttendanceOverview = true">
          <Eye :size="16" /> View Full History
       </button>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>SERVICE / EVENT</th>
            <th>DATE</th>
            <th>TOTAL</th>
            <th>ELEV. F</th>
            <th>ELEV. M</th>
            <th>B1G F</th>
            <th>B1G M</th>
            <th>D-LEADERS</th>
            <th>VOLUNTEERS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in tableRecords" :key="record.id">
            <td class="event-name">{{ record.name }}</td>
            <td class="text-blue">{{ formatDate(record.date) }}</td>
            <td class="total-col">{{ record.total }}</td>
            <td>{{ record.elevF }}</td>
            <td>{{ record.elevM }}</td>
            <td>{{ record.b1gF }}</td>
            <td>{{ record.b1gM }}</td>
            <td>{{ record.dl }}</td>
            <td>{{ record.vols }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="tableRecords.length === 0" class="no-data-text pt-4">No records to display.</p>
    </div>

    <!-- Full History Modal - Passes Range Data to avoid fetching all history -->
    <Modal v-if="showAttendanceOverview" @close="showAttendanceOverview = false" size="xl">
      <AttendanceOverviewModal :events="allEventsOfType" :attendance="fetchedRangeAttendance" :members="members" @close="showAttendanceOverview = false" />
    </Modal>
  </div>
</template>

<style scoped>
.historical-section {
  margin-top: 24px;
}

/* Headers matching the design */
.section-badge-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.badge {
  background: #E3F2FD;
  color: #1976D2;
  font-weight: 700;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.5px;
}
.title-text {
  font-size: 14px;
  font-weight: 600;
  color: #78909C;
  letter-spacing: 0.5px;
}

/* Main Cards */
.chart-card, .table-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  border: 1px solid #ECEFF1;
}

.table-card {
  padding: 0;
  overflow-x: auto;
}

/* Toolbar & Filters */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.filters-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.divider {
  width: 1px;
  height: 24px;
  background-color: #ECEFF1;
}

/* Pills */
.pill-group {
  display: flex;
  background: #F5F7FA;
  border-radius: 8px;
  padding: 4px;
}
.pill {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #546E7A;
  cursor: pointer;
  transition: all 0.2s;
}
.pill.active {
  background: #068FFF;
  color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Date Pickers */
.date-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}
.date-pickers .label {
  font-size: 13px;
  color: #78909C;
}
.input-styled {
  border: 1px solid #CFD8DC;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  color: #37474F;
  background: #F5F7FA;
  outline: none;
  font-family: inherit;
}

/* Toggles */
.chart-toggles {
  display: flex;
  background: #F5F7FA;
  border-radius: 8px;
  padding: 4px;
  border: 1px solid #ECEFF1;
}
.toggle-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #78909C;
  cursor: pointer;
  transition: 0.2s;
}
.toggle-btn.active {
  background: #068FFF;
  color: white;
}

/* Export Button Wrap */
:deep(.export-trigger-btn) {
  background-color: #1976D2 !important;
  color: white !important;
  border: none !important;
}
:deep(.export-trigger-btn:hover) {
  background-color: #1565C0 !important;
}

/* Chart Area */
.chart-wrapper {
  position: relative;
  width: 100%;
}
.no-data-text {
  text-align: center;
  color: #90A4AE;
  padding: 40px;
  font-size: 14px;
}

/* Records Table Header */
.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.mt-8 {
  margin-top: 32px;
}
.view-full-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1976D2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.view-full-btn:hover {
  background: #1565C0;
}

/* Table styling */
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  background: #F8F9FA;
  color: #78909C;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 16px;
  text-align: left;
  border-bottom: 2px solid #ECEFF1;
  letter-spacing: 0.5px;
}
td {
  padding: 16px;
  border-bottom: 1px solid #ECEFF1;
  color: #455A64;
  font-size: 14px;
}
tr:last-child td {
  border-bottom: none;
}
.event-name {
  font-weight: 700;
  color: #263238;
}
.text-blue {
  color: #1976D2;
}
.total-col {
  font-weight: 700;
  font-size: 15px;
  color: #263238;
}

@media (max-width: 900px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .filters-group {
    justify-content: space-between;
  }
  .divider {
    display: none;
  }
}
</style>