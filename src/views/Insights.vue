<script setup>
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { 
  LayoutDashboard, Users, Calendar, BarChart3, Search, 
  ArrowUp, ArrowDown, UserPlus, CalendarDays, Activity,
  Clock, TrendingUp 
} from 'lucide-vue-next'

// Components
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import DgroupMatchingModal from '../components/dgmComponents/DgroupMatchingModal.vue'
import AttendanceOverviewModal from '../components/dgmComponents/AttendanceOverviewModal.vue'
import ExportButton from '../components/dgmComponents/ExportButton.vue'
import HistoricalAttendance from '../components/dgmComponents/HistoricalAttendance.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, activeMembers, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- UI State ---
const currentTab = ref('overview') // 'overview', 'wknd', 'b1g'
const showDgroupModal = ref(false)
const showAttendanceOverview = ref(false)
const showFullVolunteerList = ref(false)
const showB1GAttendanceOverview = ref(false)

// --- Date State for B1G ---
const todayStr = new Date().toISOString().split('T')[0]
const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split('T')[0] })()
const b1gFromDate = ref(defaultFrom)
const b1gToDate = ref(todayStr)

// --- Chart Options ---
const doughnutChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
    datalabels: { display: false }
  },
  cutout: '65%'
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

const b1gChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
}

// --- DATA COMPUTATIONS ---

// 1. Demographics
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

// 2. New This Month
const newMembersStats = computed(() => {
  const count = demographics.value.firstTimers;
  return { count, percent: 3, trend: 'up' }; 
})

// 3. Monthly Attendance
const monthlyAttendanceStats = computed(() => {
  const now = new Date();
  const currentMonthEvents = allEvents.value.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  const total = currentMonthEvents.reduce((sum, ev) => {
    return sum + allAttendance.value.filter(a => a.eventId === ev.id).length;
  }, 0);

  return { total, percent: 8, trend: 'up' }; 
})

// 4. Growth Rate
const growthRate = computed(() => {
  if (demographics.value.total === 0) return { rate: 0, percent: 0 };
  const rate = Math.round((demographics.value.firstTimers / demographics.value.total) * 100);
  return { rate, percent: 5, trend: 'up' };
})

// 5. Attendance Stats Helper
function getEventStats(eventType) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const relevantEvents = allEvents.value.filter(e => 
    (eventType === 'b1g' ? (e.eventType === 'b1g' || e.name.toLowerCase().includes('b1g')) : e.eventType === eventType) 
    && new Date(e.date + 'T00:00:00') <= today
  );

  if (relevantEvents.length === 0) return { avg: 0, high: 0, low: 0 };
  
  const counts = relevantEvents.map(event => allAttendance.value.filter(att => att.eventId === event.id).length);
  const avg = Math.round(counts.reduce((sum, c) => sum + c, 0) / relevantEvents.length);
  const high = Math.max(...counts);
  const low = Math.min(...counts);
  
  return { avg, high, low };
}

const wkndStats = computed(() => getEventStats('service'));
const b1gStats = computed(() => getEventStats('b1g'));

// 6. WKND Overview Stats
const wkndOverviewStats = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const pastEvents = allEvents.value.filter(e => e.eventType === 'service' && new Date(e.date + 'T00:00:00') <= today);
  
  if (pastEvents.length === 0) return { avg: 0, servicesHeld: 0, peak: 0, peakEventName: 'N/A' };

  const servicesHeld = pastEvents.filter(e => new Date(e.date).getFullYear() === currentYear).length;
  
  const counts = pastEvents.map(e => ({
      name: e.name,
      date: e.date,
      count: allAttendance.value.filter(att => att.eventId === e.id).length
  }));

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const avg = Math.round(total / pastEvents.length);
  const peak = counts.reduce((max, c) => c.count > max.count ? c : max, { count: 0, name: '-' });

  return { avg, servicesHeld, peak: peak.count, peakEventName: peak.name };
})

// 7. B1G Overview Stats (Top Cards)
const b1gOverviewStats = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const pastEvents = allEvents.value.filter(e => 
    (e.eventType === 'b1g' || e.name.toLowerCase().includes('b1g')) 
    && new Date(e.date + 'T00:00:00') <= today
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (pastEvents.length === 0) return { totalEvents: 0, avg: 0, peak: 0, peakEventName: 'N/A' };

  const totalEvents = pastEvents.filter(e => new Date(e.date).getFullYear() === currentYear).length;

  const counts = pastEvents.map(e => ({
      name: e.name,
      date: e.date,
      count: allAttendance.value.filter(att => att.eventId === e.id).length
  }));

  const totalAttendance = counts.reduce((sum, c) => sum + c.count, 0);
  const avg = Math.round(totalAttendance / pastEvents.length);
  const peak = counts.reduce((max, c) => c.count > max.count ? c : max, { count: 0, name: '-' });

  return { totalEvents, avg, peak: peak.count, peakEventName: peak.name };
})

// 8. B1G Historical Chart Data (Date Range Filtered)
const b1gEventsInRange = computed(() => {
  if (!b1gFromDate.value || !b1gToDate.value) return []
  if (new Date(b1gFromDate.value) > new Date(b1gToDate.value)) return []
  
  return allEvents.value.filter(e => 
    (e.eventType === 'b1g' || e.name.toLowerCase().includes('b1g'))
    && e.date >= b1gFromDate.value 
    && e.date <= b1gToDate.value
  ).sort((a, b) => new Date(a.date) - new Date(b.date));
})

const filteredB1GAttendance = computed(() => {
  const evIds = b1gEventsInRange.value.map(e => e.id)
  return allAttendance.value.filter(att => evIds.includes(att.eventId))
})

const b1gChartData = computed(() => {
  const evs = b1gEventsInRange.value;
  if (!evs.length) return { labels: [], datasets: [] };
  
  const labels = evs.map(e => `${e.name} (${e.date})`);
  const data = evs.map(e => allAttendance.value.filter(att => att.eventId === e.id).length);

  return {
    labels,
    datasets: [{
      label: 'Attendance',
      backgroundColor: '#2962FF',
      borderRadius: 4,
      data
    }]
  }
})

// 9. Chart Data (General)
const categoryDistributionData = computed(() => {
  const d = demographics.value;
  return {
    labels: ['Regulars', 'First Timers'],
    datasets: [{
      backgroundColor: ['#00C853', '#00B0FF'],
      borderWidth: 0,
      data: [d.regulars + d.leaders + d.volunteers, d.firstTimers]
    }]
  }
})

const serviceTeamData = computed(() => {
  const d = demographics.value;
  return {
    labels: ['Volunteers', 'D-Leaders'],
    datasets: [{
      backgroundColor: ['#00C853', '#6200EA'],
      borderWidth: 0,
      data: [d.volunteers, d.leaders]
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

const dgroupMatching = computed(() => {
  const totalCapacity = leaders.value.reduce((sum, leader) => sum + (leader.dgroupCapacity || 8), 0)
  const totalMembersInDgroups = activeMembers.value.filter(m => !!m.dgroupLeader).length
  const openSlots = totalCapacity - totalMembersInDgroups
  return { seekers: seekers.value.length, openSlots: openSlots > 0 ? openSlots : 0 }
})

// Volunteer Tracking for Table
const volunteerTrackingReport = computed(() => {
    const volunteerIds = new Set(
      (allAttendance.value || []).filter(att => att.ministry && att.ministry !== 'N/A').map(att => att.memberId)
    )
    const allVolunteers = activeMembers.value.filter(m => volunteerIds.has(m.id) || m.finalTags.isVolunteer)
    const totalServiceEvents = allEvents.value.filter(e => e.eventType === 'service' && e.date <= new Date().toISOString().split('T')[0]).length;

    const stats = allVolunteers.map(member => {
      const memberAttendance = allAttendance.value.filter(att =>
        att.memberId === member.id && att.ministry && att.ministry !== 'N/A'
      );
      const validServiceAttendance = memberAttendance.filter(att => {
           const ev = allEvents.value.find(e => e.id === att.eventId);
           return ev && ev.eventType === 'service';
      });
      const totalEvents = validServiceAttendance.length;
      const ministryCounts = {};
      validServiceAttendance.forEach(att => { ministryCounts[att.ministry] = (ministryCounts[att.ministry] || 0) + 1; });
      const breakdown = Object.entries(ministryCounts).map(([min, count]) => `${min}: ${count}`).join(', ');

      return {
          name: `${member.lastName}, ${member.firstName}`,
          isLeader: member.finalTags.isDgroupLeader,
          totalEvents: totalEvents,
          breakdown: breakdown || 'No active service yet',
          ratio: `${totalEvents} / ${totalServiceEvents}`
      };
    });
    return stats.sort((a, b) => b.totalEvents - a.totalEvents).slice(0, 5);
})
</script>

<template>
  <div class="insights-container">
    
    <!-- 1. HEADER SECTION -->
    <div class="dashboard-header">
       <div class="header-icon">
          <BarChart3 color="white" :size="28" />
       </div>
       <div class="header-text">
          <h1>Insights Dashboard</h1>
          <p>Member & Attendance Monitoring</p>
       </div>
    </div>

    <!-- 2. TABS NAVIGATION -->
    <div class="tabs-header">
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'overview' }"
        @click="currentTab = 'overview'"
      >
        <LayoutDashboard :size="18" /> Org Overview
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'wknd' }"
        @click="currentTab = 'wknd'"
      >
        <Users :size="18" /> WKND Service
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'b1g' }"
        @click="currentTab = 'b1g'"
      >
        <Calendar :size="18" /> B1G Events
      </button>
    </div>

    <!-- 3. TAB CONTENT -->
    
    <!-- TAB 1: ORG OVERVIEW -->
    <div v-if="currentTab === 'overview'" class="tab-content">
        
        <!-- Row 1: Top Metrics Cards -->
        <div class="metrics-row">
            <!-- Total Members (Blue) -->
            <div class="metric-card primary-blue">
                <div class="metric-info">
                    <span class="metric-label">Total Members</span>
                    <div class="metric-number">{{ demographics.total }}</div>
                    <div class="metric-subtext">Active registered members</div>
                </div>
                <!-- Export Button -->
                <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
                    <ExportButton exportType="members" variant="on-blue" :iconOnly="true" />
                </div>
            </div>

            <!-- Monthly Attendance -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Monthly Attendance</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">{{ monthlyAttendanceStats.total }}</div>
                            <div class="trend-badge positive">
                                <ArrowUp :size="12" /> {{ monthlyAttendanceStats.percent }}%
                            </div>
                        </div>
                        <div class="metric-subtext">Total attendees this month</div>
                    </div>
                    <div class="icon-circle soft-blue"><CalendarDays :size="20" color="#2962FF" /></div>
                 </div>
            </div>

            <!-- Growth Rate -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Growth Rate</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">+{{ growthRate.rate }}%</div>
                            <div class="trend-badge positive">
                                <ArrowUp :size="12" /> {{ growthRate.percent }}%
                            </div>
                        </div>
                        <div class="metric-subtext">Compared to last quarter</div>
                    </div>
                    <div class="icon-circle soft-purple"><Activity :size="20" color="#6200EA" /></div>
                 </div>
            </div>

             <!-- New This Month -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">New This Month</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">{{ newMembersStats.count }}</div>
                            <div class="trend-badge negative">
                                <ArrowDown :size="12" /> {{ newMembersStats.percent }}%
                            </div>
                        </div>
                        <div class="metric-subtext">First-time visitors</div>
                    </div>
                    <div class="icon-circle soft-blue"><UserPlus :size="20" color="#2962FF" /></div>
                 </div>
            </div>
        </div>

        <!-- Row 2: Attendance Stats Breakdown -->
        <div class="attendance-breakdown-row">
            <!-- WKND Service Stats -->
            <div class="stats-group">
                <div class="stats-group-header">
                    <span class="dot-indicator blue"></span> WKND Service Attendance
                </div>
                <div class="stats-cards-container">
                    <div class="mini-stat-card soft-green-bg">
                        <div class="mini-stat-val success-text"><ArrowUp :size="14"/> {{ wkndStats.high }}</div>
                        <div class="mini-stat-label">High</div>
                    </div>
                    <div class="mini-stat-card soft-blue-bg">
                        <div class="mini-stat-val">{{ wkndStats.avg }}</div>
                        <div class="mini-stat-label">Average</div>
                    </div>
                    <div class="mini-stat-card soft-red-bg">
                        <div class="mini-stat-val error-text"><ArrowDown :size="14"/> {{ wkndStats.low }}</div>
                        <div class="mini-stat-label">Low</div>
                    </div>
                </div>
            </div>

            <!-- B1G Event Stats -->
            <div class="stats-group">
                <div class="stats-group-header">
                    <span class="dot-indicator light-blue"></span> B1G Event Attendance
                </div>
                <div class="stats-cards-container">
                    <div class="mini-stat-card soft-green-bg">
                        <div class="mini-stat-val success-text"><ArrowUp :size="14"/> {{ b1gStats.high }}</div>
                        <div class="mini-stat-label">High</div>
                    </div>
                    <div class="mini-stat-card soft-cyan-bg">
                        <div class="mini-stat-val">{{ b1gStats.avg }}</div>
                        <div class="mini-stat-label">Average</div>
                    </div>
                    <div class="mini-stat-card soft-red-bg">
                        <div class="mini-stat-val error-text"><ArrowDown :size="14"/> {{ b1gStats.low }}</div>
                        <div class="mini-stat-label">Low</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 3: Charts Grid -->
        <div class="charts-grid-3-col">
            <!-- 1. Age & Group Distribution -->
            <div class="chart-card">
                <h3>Gender & Age Distribution</h3>
                <div class="chart-wrapper" style="height: 300px;">
                    <BarChart v-if="members.length > 0" :chartData="genderAgeDistributionData" :chartOptions="genderAgeChartOptions" />
                    <p v-else class="no-data-text">No members registered yet.</p>
                </div>
            </div>

            <!-- 2. Member Categories -->
            <div class="chart-card">
                <div class="chart-header-row">
                    <h3>Member Categories</h3>
                    <span class="total-badge">Total: {{ demographics.total }}</span>
                </div>
                <div class="chart-wrapper donut-wrapper">
                    <DoughnutChart :chartData="categoryDistributionData" :chartOptions="doughnutChartOptions" />
                </div>
                <div class="chart-legend-custom">
                     <div class="legend-item"><span class="box regular"></span> Regulars: {{ demographics.regulars + demographics.leaders + demographics.volunteers }}</div>
                     <div class="legend-item"><span class="box ft"></span> First Timers: {{ demographics.firstTimers }}</div>
                </div>
            </div>

            <!-- 3. Service Team -->
            <div class="chart-card">
                <div class="chart-header-row">
                    <h3>Service Team</h3>
                    <span class="total-badge">Total: {{ demographics.volunteers + demographics.leaders }}</span>
                </div>
                <div class="chart-wrapper donut-wrapper">
                    <DoughnutChart :chartData="serviceTeamData" :chartOptions="doughnutChartOptions" />
                </div>
                 <div class="chart-legend-custom">
                     <div class="legend-item"><span class="box vol"></span> Volunteers: {{ demographics.volunteers }}</div>
                     <div class="legend-item"><span class="box dl"></span> D-Leaders: {{ demographics.leaders }}</div>
                </div>
            </div>
        </div>
        
        <!-- Volunteer Leaderboard -->
         <div class="chart-card-full" style="margin-top: 20px;">
            <div class="section-title-with-button">
                <h3>Volunteer Top Performers</h3>
                <button class="view-overview-btn" @click="showFullVolunteerList = true">View Full List</button>
            </div>
            <div class="table-responsive">
                <table v-if="volunteerTrackingReport.length > 0" class="volunteer-table">
                <thead>
                    <tr><th>Volunteer Name</th><th>Count</th><th>Ministry Breakdown</th></tr>
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
        </div>

    </div>

    <!-- TAB 2: WKND SERVICE -->
    <div v-if="currentTab === 'wknd'" class="tab-content">
        
        <!-- Metrics Row -->
        <div class="metrics-row">
            <!-- Avg Attendance (Blue) -->
            <div class="metric-card primary-blue">
                <div class="metric-info">
                    <span class="metric-label">Avg. Attendance</span>
                    <div class="metric-number-row">
                        <div class="metric-number">{{ wkndOverviewStats.avg }}</div>
                        <div class="trend-badge positive" style="background: rgba(255,255,255,0.2); color: white;">
                            <ArrowUp :size="12" /> 8%
                        </div>
                    </div>
                    <div class="metric-subtext">Per weekend service</div>
                </div>
                <div class="metric-icon-glass"><Users color="white" :size="24" /></div>
            </div>

            <!-- Services Held -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Services Held</span>
                        <div class="metric-number">{{ wkndOverviewStats.servicesHeld }}</div>
                        <div class="metric-subtext">This year</div>
                    </div>
                    <div class="icon-circle soft-blue"><Clock :size="20" color="#2962FF" /></div>
                 </div>
            </div>

            <!-- Peak Attendance -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Peak Attendance</span>
                        <div class="metric-number">{{ wkndOverviewStats.peak }}</div>
                        <div class="metric-subtext">{{ wkndOverviewStats.peakEventName }}</div>
                    </div>
                    <div class="icon-circle soft-blue"><TrendingUp :size="20" color="#2962FF" /></div>
                 </div>
            </div>
        </div>

        <HistoricalAttendance />
        
    </div>

    <!-- TAB 3: B1G EVENTS (UPDATED) -->
    <div v-if="currentTab === 'b1g'" class="tab-content">
        
        <!-- Metrics Row -->
        <div class="metrics-row">
            <!-- Total Events (Blue) -->
            <div class="metric-card primary-blue">
                <div class="metric-info">
                    <span class="metric-label">Total Events</span>
                    <div class="metric-number-row">
                        <div class="metric-number">{{ b1gOverviewStats.totalEvents }}</div>
                        <div class="trend-badge positive" style="background: rgba(255,255,255,0.2); color: white;">
                            <ArrowUp :size="12" /> 20%
                        </div>
                    </div>
                    <div class="metric-subtext">Events held this year</div>
                </div>
                <div class="metric-icon-glass"><Calendar color="white" :size="24" /></div>
            </div>

            <!-- Avg Attendance -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Avg. Attendance</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">{{ b1gOverviewStats.avg }}</div>
                            <div class="trend-badge positive">
                                <ArrowUp :size="12" /> 15%
                            </div>
                        </div>
                        <div class="metric-subtext">Per B1G event</div>
                    </div>
                    <div class="icon-circle soft-blue"><Users :size="20" color="#2962FF" /></div>
                 </div>
            </div>

            <!-- Peak Attendance -->
            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Peak Attendance</span>
                        <div class="metric-number">{{ b1gOverviewStats.peak }}</div>
                        <div class="metric-subtext">{{ b1gOverviewStats.peakEventName }}</div>
                    </div>
                    <div class="icon-circle soft-blue"><TrendingUp :size="20" color="#2962FF" /></div>
                 </div>
            </div>
        </div>

        <!-- Attendance Graph (Inline) -->
        <div class="chart-card-full">
            <div class="section-header">
                <div class="header-left">
                    <h3>Historical B1G Attendance</h3>
                    <div class="date-text">Select a date range to view historical B1G attendance</div>
                </div>
                <div class="header-actions">
                    <button class="view-overview-btn" @click="showB1GAttendanceOverview = true">View History</button>
                    <ExportButton exportType="events" :eventsList="b1gEventsInRange" />
                </div>
            </div>

            <div class="date-controls">
                <div class="controls-inline">
                    <label class="date-label">From<input type="date" v-model="b1gFromDate" /></label>
                    <label class="date-label">To<input type="date" v-model="b1gToDate" :max="todayStr" /></label>
                </div>
            </div>

            <div class="chart-wrapper" style="height: 350px;">
                <BarChart v-if="b1gChartData.labels.length > 0" :chartData="b1gChartData" :chartOptions="b1gChartOptions" />
                <p v-else class="no-data-text">No B1G event data found in the selected date range.</p>
            </div>
        </div>

    </div>

    <!-- Modals -->
    <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl"><DgroupMatchingModal @close="showDgroupModal = false" /></Modal>
    
    <!-- WKND Attendance Modal -->
    <Modal v-if="showAttendanceOverview" @close="showAttendanceOverview = false" size="xl">
      <AttendanceOverviewModal :events="allEvents.filter(e => e.eventType === 'service')" :attendance="allAttendance" :members="members" @close="showAttendanceOverview = false" />
    </Modal>

    <!-- B1G Attendance Modal -->
    <Modal v-if="showB1GAttendanceOverview" @close="showB1GAttendanceOverview = false" size="xl">
      <AttendanceOverviewModal :events="b1gEventsInRange" :attendance="filteredB1GAttendance" :members="members" @close="showB1GAttendanceOverview = false" />
    </Modal>

    <Modal v-if="showFullVolunteerList" @close="showFullVolunteerList = false" size="xl">
        <div class="full-list-container">
            <h3>Full Volunteer Activity List</h3>
             <div class="table-responsive modal-table-wrap">
                <table class="volunteer-table">
                   <thead><tr><th>Volunteer Name</th><th>Number of times volunteered</th><th>Ministry Breakdown</th></tr></thead>
                   <tbody>
                      <tr v-for="row in volunteerTrackingReport" :key="row.name">
                          <td class="name-cell">{{ row.name }}</td><td class="count-cell">{{ row.ratio }}</td><td class="breakdown-cell">{{ row.breakdown }}</td>
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
.insights-container { padding: 20px; height: 100%; display: flex; flex-direction: column; background-color: #F5F7FA; }

/* --- HEADER STYLES --- */
.dashboard-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.header-icon { width: 48px; height: 48px; background-color: #2962FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(41, 98, 255, 0.2); }
.header-text h1 { font-size: 24px; font-weight: 700; color: #0D47A1; margin: 0; line-height: 1.2; }
.header-text p { font-size: 14px; color: #546E7A; margin: 4px 0 0 0; }

/* --- TABS --- */
.tabs-header { display: flex; gap: 12px; border-bottom: 2px solid #ECEFF1; margin-bottom: 24px; overflow-x: auto; background: #fff; padding: 8px 8px 0 8px; border-radius: 8px; }
.tab-btn { display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: none; border: none; border-bottom: 3px solid transparent; font-size: 15px; font-weight: 600; color: #546E7A; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.tab-btn:hover { color: #1976D2; background-color: #F5F7FA; }
.tab-btn.active { color: #1976D2; border-bottom-color: #1976D2; }
.tab-content { flex: 1; animation: fadeIn 0.3s ease; }

/* --- NEW LAYOUT STYLES --- */

/* 1. Metrics Row */
.metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; }

.metric-card {
    border-radius: 16px; padding: 24px;
    display: flex; justify-content: space-between; align-items: flex-start;
    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
    position: relative; 
    /* removed overflow: hidden to allow export dropdown to show */
}
.metric-card.primary-blue { background: #2962FF; color: white; }
.metric-card.white-card { background: white; border: 1px solid #ECEFF1; }

.metric-info { display: flex; flex-direction: column; z-index: 2; }
.metric-label { font-size: 13px; font-weight: 500; margin-bottom: 8px; opacity: 0.9; }
.metric-card.primary-blue .metric-label { color: rgba(255,255,255,0.8); }
.metric-card.white-card .metric-label { color: #78909C; }

.metric-number { font-size: 36px; font-weight: 700; line-height: 1.1; margin-bottom: 4px; }
.metric-number-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.metric-number-dark { font-size: 32px; font-weight: 700; color: #37474F; }

.trend-badge { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center; gap: 2px; }
.trend-badge.positive { background: #E8F5E9; color: #2E7D32; }
.trend-badge.negative { background: #FFEBEE; color: #C62828; }

.metric-subtext { font-size: 12px; margin-top: 4px; }
.metric-card.primary-blue .metric-subtext { color: rgba(255,255,255,0.7); }
.metric-card.white-card .metric-subtext { color: #90A4AE; }

.metric-icon-glass { background: rgba(255,255,255,0.2); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.metric-header { display: flex; width: 100%; justify-content: space-between; align-items: flex-start; }
.icon-circle { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.icon-circle.soft-blue { background: #E3F2FD; }
.icon-circle.soft-purple { background: #EDE7F6; }

/* 2. Attendance Breakdown */
.attendance-breakdown-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px; }
.stats-group { background: white; padding: 20px; border-radius: 16px; border: 1px solid #ECEFF1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.stats-group-header { font-size: 15px; font-weight: 600; color: #546E7A; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.dot-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-indicator.blue { background: #2962FF; }
.dot-indicator.light-blue { background: #00B0FF; }

.stats-cards-container { display: flex; gap: 16px; }
.mini-stat-card { flex: 1; padding: 16px; border-radius: 12px; text-align: center; }
.soft-blue-bg { background: #E3F2FD; }
.soft-cyan-bg { background: #E0F7FA; }
.soft-green-bg { background: #E8F5E9; }
.soft-red-bg { background: #FFEBEE; }

.mini-stat-val { font-size: 24px; font-weight: 700; color: #37474F; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; }
.mini-stat-label { font-size: 12px; font-weight: 500; color: #78909C; text-transform: uppercase; letter-spacing: 0.5px; }
.success-text { color: #2E7D32; }
.error-text { color: #C62828; }

/* 3. Charts Grid */
.charts-grid-3-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.chart-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #ECEFF1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; flex-direction: column; }
.chart-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.chart-card h3 { margin: 0; font-size: 16px; font-weight: 600; color: #455A64; margin-bottom: 16px; }
.total-badge { font-size: 12px; font-weight: 600; color: #78909C; }
.chart-wrapper { height: 220px; position: relative; width: 100%; display: flex; justify-content: center; }
.donut-wrapper { height: 180px; margin: 10px 0; }

.chart-legend-custom { display: flex; justify-content: center; gap: 16px; margin-top: auto; padding-top: 16px; font-size: 13px; color: #546E7A; }
.chart-footer-info { display: flex; justify-content: center; gap: 16px; margin-top: 12px; font-size: 13px; color: #546E7A; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.box, .dot { width: 10px; height: 10px; display: inline-block; border-radius: 2px; }
.dot { border-radius: 50%; }

/* Colors for custom legend */
.box.regular { background: #00C853; }
.box.ft { background: #00B0FF; }
.box.vol { background: #00C853; }
.box.dl { background: #6200EA; }
.dot.male { background: #2962FF; }
.dot.female { background: #FF4081; }

/* Legacy styles preserved for other tabs */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 20px; }
.kpi-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.2s ease; border: 1px solid #ECEFF1; }
.kpi-card h4 { margin: 0 0 12px 0; font-size: 16px; color: #546E7A; }
.kpi-value { font-size: 40px; font-weight: 700; color: #0D47A1; }
.kpi-detail { font-size: 14px; color: #78909C; }
.chart-card-full { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #ECEFF1; }
.section-title-with-button { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.section-title-with-button h3 { margin: 0; }
.view-overview-btn { padding: 8px 16px; background: #1976D2; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.volunteer-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.volunteer-table th { background: #F5F7FA; padding: 12px; text-align: left; color: #546E7A; font-weight: 600; border-bottom: 1px solid #CFD8DC; }
.volunteer-table td { padding: 12px; border-bottom: 1px solid #ECEFF1; color: #37474F; }
.name-cell { font-weight: 600; color: #1976D2; }
.count-cell { font-weight: 700; text-align: center; color: #1565C0; background: #E3F2FD; border-radius: 6px; padding: 6px; }
.breakdown-cell { font-size: 13px; color: #546E7A; }

/* Historical Section Specifics */
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
.header-left h3 {
    margin: 0;
    font-size: 18px;
    color: #0D47A1;
}
.date-text {
  font-size: 13px;
  color: #546E7A;
  margin-left: 2px;
}
.header-actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
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

@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 900px) { .charts-grid-3-col { grid-template-columns: 1fr; } .attendance-breakdown-row { grid-template-columns: 1fr; } .section-header { flex-direction: column; align-items: flex-start; } .header-actions { margin-top: 6px; } }
</style>