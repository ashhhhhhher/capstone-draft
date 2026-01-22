<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import DgroupMatchingModal from '../components/dgmComponents/DgroupMatchingModal.vue'
import AttendanceOverviewModal from '../components/dgmComponents/AttendanceOverviewModal.vue'
import ExportButton from '../components/dgmComponents/ExportButton.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, activeMembers, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showDgroupModal = ref(false)
const showAttendanceOverview = ref(false)
const showFullVolunteerList = ref(false)

// --- Chart Options ---
const historicalChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, datalabels: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
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
  scales: { x: { stacked: false }, y: { beginAtZero: true, stacked: false, ticks: { stepSize: 1 } } }
})

// --- KPI Data Computations ---
const demographics = computed(() => {
  return {
    total: activeMembers.value.length,
    leaders: activeMembers.value.filter(m => m.finalTags.isDgroupLeader).length,
    volunteers: activeMembers.value.filter(m => !m.finalTags.isDgroupLeader && m.finalTags.isVolunteer).length,
    firstTimers: activeMembers.value.filter(m => m.finalTags.isFirstTimer).length,
    regulars: activeMembers.value.filter(m => 
      !m.finalTags.isDgroupLeader && 
      !m.finalTags.isVolunteer && 
      !m.finalTags.isFirstTimer
    ).length,
  }
})

const attendanceTrends = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
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
    if (isConverted && attendanceCount >= 2) convertedCount++
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
  return { seekers: seekers.value.length, openSlots: openSlots > 0 ? openSlots : 0 }
})

// --- Chart Data Computations ---
const categoryDistributionData = computed(() => {
  const d = demographics.value;
  return {
    labels: ['Regulars', 'Dgroup Leaders', 'Volunteers', 'First Timers'],
    datasets: [{
      backgroundColor: ['#1976D2', '#42A5F5', '#66BB6A', '#FFCA28'],
      data: [d.regulars, d.leaders, d.volunteers, d.firstTimers]
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
      { label: 'Male', backgroundColor: '#0D47A1', data: [malesElevate, malesB1G] },
      { label: 'Female', backgroundColor: '#42A5F5', data: [femalesElevate, femalesB1G] }
    ]
  }
})

// --- VOLUNTEER TRACKING REPORT LOGIC ---
const totalServiceEventsCount = computed(() => {
  // Count all past or ended 'service' events to calculate percentage
  const today = new Date().toISOString().split('T')[0];
  return allEvents.value.filter(e => e.eventType === 'service' && e.date <= today).length;
})

const volunteerTrackingReport = computed(() => {
    // 1. Get ALL profiles tagged as volunteers (including DLs who are volunteers)
    // Note: We use activeMembers to exclude archived ones.
    const allVolunteers = activeMembers.value.filter(m => m.finalTags.isVolunteer);
    
    // 2. Build stats for each
    const stats = allVolunteers.map(member => {
        // Find attendance records for this member that are 'service' type events AND ministry != 'N/A'
        // We filter attendance first by memberId
        const memberAttendance = allAttendance.value.filter(att => 
            att.memberId === member.id && 
            att.ministry && 
            att.ministry !== 'N/A'
        );

        // Filter out attendance for non-service events if strictly tracking service volunteering
        // Assuming 'allAttendance' has eventId, we check against allEvents
        const validServiceAttendance = memberAttendance.filter(att => {
             const ev = allEvents.value.find(e => e.id === att.eventId);
             return ev && ev.eventType === 'service';
        });

        const totalEvents = validServiceAttendance.length;
        
        // Breakdown
        const ministryCounts = {};
        validServiceAttendance.forEach(att => {
            ministryCounts[att.ministry] = (ministryCounts[att.ministry] || 0) + 1;
        });
        
        const breakdown = Object.entries(ministryCounts)
            .map(([min, count]) => `${min}: ${count}`)
            .join(', ');

        return {
            name: `${member.lastName}, ${member.firstName}`,
            isLeader: member.finalTags.isDgroupLeader,
            totalEvents: totalEvents,
            breakdown: breakdown || 'No active service yet',
            ratio: `${totalEvents} / ${totalServiceEventsCount.value}`
        };
    });

    // 3. Sort by totalEvents descending
    return stats.sort((a, b) => b.totalEvents - a.totalEvents);
})

// Top 5 for dashboard view
const topVolunteers = computed(() => volunteerTrackingReport.value.slice(0, 5))

// --- Date range picker state (new) ---
const todayStr = new Date().toISOString().split('T')[0]
const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()
const fromDate = ref(defaultFrom)
const toDate = ref(todayStr)

const historicalAttendanceData = computed(() => {
  if (!fromDate.value || !toDate.value) return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }
  if (new Date(fromDate.value) > new Date(toDate.value)) return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }

  const eventsInRange = allEvents.value
    .filter(e => e.eventType === 'service' && e.date >= fromDate.value && e.date <= toDate.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!eventsInRange.length) return { labels: [], datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data: [] }] }

  const labels = eventsInRange.map(ev => `${ev.name} (${ev.date})`)
  const data = eventsInRange.map(ev => allAttendance.value.filter(att => att.eventId === ev.id).length)

  return { labels, datasets: [{ label: 'Total Attendance', backgroundColor: '#1E88E5', data }] }
})
</script>

<template>
  <div class="insights-container">
    <div class="insights-header">
      <h1>Analytics Insights</h1>
      <p>Analyze historical trends and member engagement.</p>
    </div>

      <!-- 1. Key Metrics -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-card-header"><h4>Total Members</h4><ExportButton exportType="members" /></div>
          <div class="kpi-value">{{ demographics.total }}</div>
          <div class="kpi-detail-grid">
            <div><strong>{{ demographics.regulars }}</strong><span>Regulars</span></div>
            <div><strong>{{ demographics.leaders }}</strong><span>Leaders</span></div>
            <div><strong>{{ demographics.firstTimers }}</strong><span>First Timers</span></div>
            <div><strong>{{ demographics.volunteers }}</strong><span>Volunteers</span></div>
          </div>
        </div>
        <div class="kpi-card">
          <h4>Attendance Trends</h4><div class="kpi-value">{{ attendanceTrends.avg }}</div><div class="kpi-detail">Average Attendance</div>
          <div class="kpi-sub-grid"><div><span class="kpi-sub-label">High</span><span class="kpi-sub-value">{{ attendanceTrends.high }}</span></div><div><span class="kpi-sub-label">Low</span><span class="kpi-sub-value">{{ attendanceTrends.low }}</span></div></div>
        </div>
        <div class="kpi-card">
          <h4>First Timer Conversion</h4><div class="kpi-value">{{ conversionRate.rate }}%</div><div class="kpi-detail">({{ conversionRate.converted }} of {{ conversionRate.total }} total)</div>
        </div>
        <div class="kpi-card is-clickable" @click="showDgroupModal = true">
          <h4>Dgroup Matching</h4><div class="kpi-value">{{ dgroupMatching.seekers }}</div><div class="kpi-detail">Seekers needing a group</div><div class="kpi-value-alt">{{ dgroupMatching.openSlots }}</div><div class="kpi-detail">Open Dgroup slots</div><span class="click-hint">Click to view details</span>
        </div>
      </div>

      <!-- 2. Charts Grid -->
      <div class="charts-grid">
        <div class="chart-card"><h3>Member Category Distribution</h3><div class="chart-wrapper" style="height: 350px;"><DoughnutChart v-if="demographics.total > 0" :chartData="categoryDistributionData" :chartOptions="doughnutChartOptions" /><p v-else class="no-data-text">No members registered yet.</p></div></div>
        <div class="chart-card"><h3>Gender & Age Distribution</h3><div class="chart-wrapper" style="height: 350px;"><BarChart v-if="members.length > 0" :chartData="genderAgeDistributionData" :chartOptions="genderAgeChartOptions" /><p v-else class="no-data-text">No members registered yet.</p></div></div>
      </div>
      
      <!-- 3. VOLUNTEER TRACKING REPORT -->
      <div class="chart-card-full">
         <div class="section-title-with-button">
            <h3>Volunteer Performance (Top Performers)</h3>
            <button class="view-overview-btn" @click="showFullVolunteerList = true">View Full List</button>
         </div>
         <p class="section-subtitle">Showing top 5 most active volunteers.</p>
         
         <div class="table-responsive">
            <table v-if="topVolunteers.length > 0" class="volunteer-table">
               <thead>
                  <tr>
                     <th>Volunteer Name</th>
                     <th>Number of times volunteered</th>
                     <th>Ministry Breakdown</th>
                  </tr>
               </thead>
               <tbody>
                  <tr v-for="row in topVolunteers" :key="row.name">
                     <td class="name-cell">
                        {{ row.name }}
                        <span v-if="row.isLeader" class="tag dl-small">DL</span>
                     </td>
                     <td class="count-cell">{{ row.ratio }}</td>
                     <td class="breakdown-cell">{{ row.breakdown }}</td>
                  </tr>
               </tbody>
            </table>
            <p v-else class="no-data-text">No active volunteer records found yet.</p>
         </div>
      </div>

      <!-- 4. Historical Attendance -->
      <div class="chart-card-full">
        <div class="section-title-with-button">
          <h3>Historical Events Attendance</h3>
          <div class="controls-inline">
            <button class="view-overview-btn" @click="showAttendanceOverview = true">View History</button>
            <label class="date-label">From<input type="date" v-model="fromDate" /></label>
            <label class="date-label">To<input type="date" v-model="toDate" :max="(new Date()).toISOString().split('T')[0]" /></label>
            <ExportButton exportType="events" />
          </div>
        </div>
        <div class="chart-wrapper" style="height: 350px;"><BarChart v-if="historicalAttendanceData.labels.length > 0" :chartData="historicalAttendanceData" :chartOptions="historicalChartOptions" /><p v-else class="no-data-text">No event data in the selected date range.</p></div>
      </div>

    <!-- Modals -->
    <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl"><DgroupMatchingModal @close="showDgroupModal = false" /></Modal>
    <Modal v-if="showAttendanceOverview" @close="showAttendanceOverview = false" size="xl"><AttendanceOverviewModal :events="allEvents" :attendance="allAttendance" :members="members" @close="showAttendanceOverview = false" /></Modal>
    
    <!-- Full Volunteer List Modal -->
    <Modal v-if="showFullVolunteerList" @close="showFullVolunteerList = false" size="xl">
        <div class="full-list-container">
            <h3>Full Volunteer Activity List</h3>
            <div class="table-responsive modal-table-wrap">
                <table class="volunteer-table">
                   <thead>
                      <tr>
                         <th>Volunteer Name</th>
                         <th>Number of times volunteered</th>
                         <th>Ministry Breakdown</th>
                      </tr>
                   </thead>
                   <tbody>
                      <tr v-for="row in volunteerTrackingReport" :key="row.name">
                         <td class="name-cell">{{ row.name }} <span v-if="row.isLeader" class="tag dl-small">DL</span></td>
                         <td class="count-cell">{{ row.ratio }}</td>
                         <td class="breakdown-cell">{{ row.breakdown }}</td>
                      </tr>
                   </tbody>
                </table>
            </div>
            <button class="close-btn" @click="showFullVolunteerList = false">Close</button>
        </div>
    </Modal>
  </div>
</template>

<style scoped>
.insights-container { padding: 20px; }
.insights-header { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #ECEFF1; }
.insights-header h1 { font-size: 28px; font-weight: 700; margin: 0; }
.insights-header p { font-size: 16px; color: #546E7A; margin-top: 4px; }

/* KPI Cards */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
.kpi-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.2s ease; }
.kpi-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.kpi-card-header h4 { margin: 0; font-size: 16px; font-weight: 600; color: #546E7A; }
.kpi-card.is-clickable { cursor: pointer; border: 2px solid transparent; }
.kpi-card.is-clickable:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); border-color: #1976D2; }
.click-hint { font-size: 12px; color: #1976D2; font-weight: 500; margin-top: 8px; display: block; }
.kpi-value { font-size: 40px; font-weight: 700; color: #0D47A1; line-height: 1; }
.kpi-value-alt { font-size: 28px; font-weight: 600; color: #333; line-height: 1; margin-top: 12px; }
.kpi-detail { font-size: 14px; color: #78909C; margin-top: 4px; }
.kpi-detail-grid { display: grid; grid-template-columns: 1fr 1fr; row-gap: 8px; column-gap: 4px; font-size: 14px; color: #546E7A; margin-top: 12px; }
.kpi-detail-grid div { display: flex; flex-direction: column; }
.kpi-detail-grid strong { font-size: 16px; font-weight: 600; color: #333; }
.kpi-sub-grid { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ECEFF1; }
.kpi-sub-grid div { display: flex; flex-direction: column; align-items: center; flex-grow: 1; }
.kpi-sub-label { font-size: 12px; font-weight: 500; color: #78909C; margin-bottom: 2px; }
.kpi-sub-value { font-size: 20px; font-weight: 600; color: #333; }

/* Charts */
.charts-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
@media (min-width: 900px) { .charts-grid { grid-template-columns: 1fr 1fr; } }
.chart-card, .chart-card-full { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.chart-card-full { margin-bottom: 20px; }
.chart-card h3, .chart-card-full h3 { margin-top: 0; margin-bottom: 20px; font-size: 18px; font-weight: 600; text-align: center; }
.chart-wrapper { position: relative; }

/* Controls */
.section-title-with-button { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.section-title-with-button h3 { margin: 0; }
.section-title-with-button .controls-inline { display: inline-flex; gap: 8px; align-items: center; }
.view-overview-btn { padding: 8px 16px; background: #1976D2; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.view-overview-btn:hover { background: #1565C0; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3); }
.date-label { display: inline-flex; flex-direction: column; font-size: 12px; color: #546E7A; }
.date-label input[type="date"] { margin-top: 4px; padding: 6px 8px; border-radius: 8px; border: 1px solid #E0E0E0; background: white; }

/* Table */
.section-subtitle { color: #78909C; font-size: 14px; margin-top: -16px; margin-bottom: 24px; text-align: center; }
.table-responsive { width: 100%; overflow-x: auto; }
.volunteer-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.volunteer-table th { background-color: #F5F7FA; padding: 12px; text-align: left; font-weight: 700; color: #37474F; border-bottom: 2px solid #ECEFF1; }
.volunteer-table td { padding: 12px; border-bottom: 1px solid #ECEFF1; color: #37474F; }
.volunteer-table tr:hover { background-color: #FAFAFA; }
.name-cell { font-weight: 600; color: #1976D2; }
.count-cell { font-weight: 700; text-align: center; color: #1565C0; background-color: #E3F2FD; border-radius: 6px; }
.breakdown-cell { font-size: 13px; color: #546E7A; }
.dl-small { font-size: 10px; background: #E3F2FD; color: #1976D2; padding: 2px 4px; border-radius: 4px; margin-left: 6px; vertical-align: middle; }

/* Modal Content */
.full-list-container { display: flex; flex-direction: column; height: 100%; }
.full-list-container h3 { margin-top: 0; color: #0D47A1; margin-bottom: 16px; }
.modal-table-wrap { flex-grow: 1; overflow-y: auto; max-height: 60vh; border: 1px solid #eee; border-radius: 8px; }
.close-btn { margin-top: 16px; padding: 12px; width: 100%; background: #ECEFF1; color: #37474F; border: none; font-weight: 600; border-radius: 8px; cursor: pointer; }
.close-btn:hover { background: #CFD8DC; }

@media (max-width: 600px) { .section-title-with-button { flex-direction: column; align-items: flex-start; gap: 12px; } .section-title-with-button .controls-inline { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; } }
</style>