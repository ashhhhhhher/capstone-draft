<script setup>
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { 
  LayoutDashboard, Users, Calendar, BarChart3, Search, 
  ArrowUp, ArrowDown, UserPlus, CalendarDays, Activity,
  Clock, TrendingUp, Download, Eye
} from 'lucide-vue-next'

// Components
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import Modal from '../components/dgmComponents/Modal.vue'
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

// --- Volunteer Table State ---
const volunteerMinistries = ['DGM', 'Live Prod', 'Exalt', 'Events', 'Media']
const activeVolunteerTab = ref('DGM')
const modalVolunteerTab = ref('All')

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
    legend: { display: false }, 
    datalabels: { display: false }
  },
  cutout: '65%'
})

const genderAgeChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      display: true, 
      position: 'top', 
      align: 'start',
      labels: { usePointStyle: true, boxWidth: 8 }
    },
    datalabels: { display: false }
  },
  scales: { 
    x: { 
      grid: { display: false } 
    }, 
    y: { 
      beginAtZero: true, 
      ticks: { stepSize: 1, precision: 0 }, // Forces whole numbers
      grid: { color: '#F0F2F5' },
      border: { display: false }
    } 
  }
})

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

// 7. B1G Overview Stats
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

// 8. Member Category / Team Charts
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

// 9. Split Gender & Age Charts (ELEVATE & B1G) - Dynamic
const elevateAgeData = computed(() => {
  const rawData = {};
  
  activeMembers.value.forEach(m => {
    if (m.finalTags?.ageCategory === 'Elevate' && m.age >= 12 && m.age <= 21) {
      if (!rawData[m.age]) rawData[m.age] = { male: 0, female: 0 };
      if (m.gender === 'Male') rawData[m.age].male++;
      if (m.gender === 'Female') rawData[m.age].female++;
    }
  });

  const sortedAges = Object.keys(rawData).sort((a, b) => Number(a) - Number(b));
  const labels = [];
  const males = [];
  const females = [];

  sortedAges.forEach(age => {
    labels.push(age.toString());
    males.push(rawData[age].male);
    females.push(rawData[age].female);
  });
  
  return {
    labels,
    datasets: [
      { label: 'Male', backgroundColor: '#4C8BF5', data: males, borderRadius: 4 },
      { label: 'Female', backgroundColor: '#52C5D0', data: females, borderRadius: 4 }
    ]
  }
})

const b1gAgeData = computed(() => {
  const rawData = {
    '22-25': { male: 0, female: 0 },
    '26-30': { male: 0, female: 0 },
    '31-35': { male: 0, female: 0 },
    '36-40': { male: 0, female: 0 },
    '41+': { male: 0, female: 0 }
  };
  
  activeMembers.value.forEach(m => {
    if (m.finalTags?.ageCategory === 'B1G' && m.age >= 22) {
      let bracket = '';
      if (m.age >= 22 && m.age <= 25) bracket = '22-25';
      else if (m.age >= 26 && m.age <= 30) bracket = '26-30';
      else if (m.age >= 31 && m.age <= 35) bracket = '31-35';
      else if (m.age >= 36 && m.age <= 40) bracket = '36-40';
      else if (m.age >= 41) bracket = '41+';
      
      if (bracket) {
          if (m.gender === 'Male') rawData[bracket].male++;
          if (m.gender === 'Female') rawData[bracket].female++;
      }
    }
  });
  
  const labels = [];
  const males = [];
  const females = [];

  // Only include brackets that have actual data
  ['22-25', '26-30', '31-35', '36-40', '41+'].forEach(bracket => {
      if (rawData[bracket].male > 0 || rawData[bracket].female > 0) {
          labels.push(bracket);
          males.push(rawData[bracket].male);
          females.push(rawData[bracket].female);
      }
  });
  
  return {
    labels,
    datasets: [
      { label: 'Male', backgroundColor: '#4C8BF5', data: males, borderRadius: 4 },
      { label: 'Female', backgroundColor: '#52C5D0', data: females, borderRadius: 4 }
    ]
  }
})

// 10. Volunteer Performance Table (Tabbed & Processed per year)
const currentYearStr = new Date().getFullYear().toString();

const totalServiceEventsThisYear = computed(() => {
  return allEvents.value.filter(e => e.eventType === 'service' && e.date.startsWith(currentYearStr) && e.date <= new Date().toISOString().split('T')[0]);
});

const volunteerPerformanceStats = computed(() => {
  const stats = { All: [] };
  volunteerMinistries.forEach(min => stats[min] = []);

  const eventsThisYear = totalServiceEventsThisYear.value;
  const totalEvts = eventsThisYear.length;
  const eventIdsThisYear = eventsThisYear.map(e => e.id);

  activeMembers.value.forEach(member => {
    const memberMinistries = member.finalTags?.volunteerMinistry || [];
    
    // Overall service attendance for this member for the current year
    const memberTotalServiceAtt = allAttendance.value.filter(att => 
       att.memberId === member.id && 
       eventIdsThisYear.includes(att.eventId) &&
       att.ministry && att.ministry !== 'N/A'
    ).length;

    if (memberMinistries.length > 0 || memberTotalServiceAtt > 0) {
        const rateAll = totalEvts > 0 ? Math.round((memberTotalServiceAtt / totalEvts) * 100) : 0;
        
        stats.All.push({
           name: `${member.firstName} ${member.lastName.charAt(0)}.`,
           fullName: `${member.lastName}, ${member.firstName}`,
           totalEvents: totalEvts,
           volunteered: memberTotalServiceAtt,
           rate: rateAll,
           ministryStr: memberMinistries.join(', ') || 'Various'
        });

        // Specific Ministries Check
        memberMinistries.forEach(min => {
            if (stats[min]) {
                const minAtt = allAttendance.value.filter(att => 
                   att.memberId === member.id && 
                   att.ministry === min && 
                   eventIdsThisYear.includes(att.eventId)
                ).length;

                const rate = totalEvts > 0 ? Math.round((minAtt / totalEvts) * 100) : 0;
                stats[min].push({
                   name: `${member.firstName} ${member.lastName.charAt(0)}.`,
                   fullName: `${member.lastName}, ${member.firstName}`,
                   totalEvents: totalEvts,
                   volunteered: minAtt,
                   rate: rate,
                   ministry: min
                });
            }
        });
    }
  });

  // Sort descending by rate
  Object.keys(stats).forEach(key => {
     stats[key].sort((a, b) => b.rate - a.rate);
  });

  return stats;
});

const topVolunteers = computed(() => {
   return (volunteerPerformanceStats.value[activeVolunteerTab.value] || []).slice(0, 5);
});

const modalVolunteers = computed(() => {
   return volunteerPerformanceStats.value[modalVolunteerTab.value] || [];
});

const getRateColor = (rate) => {
  if (rate >= 90) return 'rate-green';
  if (rate >= 80) return 'rate-blue';
  return 'rate-orange';
};

const openVolunteerModal = () => {
  modalVolunteerTab.value = activeVolunteerTab.value;
  showFullVolunteerList.value = true;
};
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
      <button class="tab-btn" :class="{ active: currentTab === 'overview' }" @click="currentTab = 'overview'">
        <LayoutDashboard :size="18" /> Org Overview
      </button>
      <button class="tab-btn" :class="{ active: currentTab === 'wknd' }" @click="currentTab = 'wknd'">
        <Users :size="18" /> WKND Service
      </button>
      <button class="tab-btn" :class="{ active: currentTab === 'b1g' }" @click="currentTab = 'b1g'">
        <Calendar :size="18" /> B1G Events
      </button>
    </div>

    <!-- 3. TAB CONTENT -->
    
    <!-- TAB 1: ORG OVERVIEW -->
    <div v-if="currentTab === 'overview'" class="tab-content">
        
        <!-- Row 1: Top Metrics Cards -->
        <div class="metrics-row">
            <div class="metric-card primary-blue">
                <div class="metric-info">
                    <span class="metric-label">Total Members</span>
                    <div class="metric-number">{{ demographics.total }}</div>
                    <div class="metric-subtext">Active registered members</div>
                </div>
                <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
                    <ExportButton exportType="members" variant="on-blue" :iconOnly="true" />
                </div>
            </div>

            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Monthly Attendance</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">{{ monthlyAttendanceStats.total }}</div>
                            <div class="trend-badge positive"><ArrowUp :size="12" /> {{ monthlyAttendanceStats.percent }}%</div>
                        </div>
                        <div class="metric-subtext">Total attendees this month</div>
                    </div>
                    <div class="icon-circle soft-blue"><CalendarDays :size="20" color="#2962FF" /></div>
                 </div>
            </div>

            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">Growth Rate</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">+{{ growthRate.rate }}%</div>
                            <div class="trend-badge positive"><ArrowUp :size="12" /> {{ growthRate.percent }}%</div>
                        </div>
                        <div class="metric-subtext">Compared to last quarter</div>
                    </div>
                    <div class="icon-circle soft-purple"><Activity :size="20" color="#6200EA" /></div>
                 </div>
            </div>

            <div class="metric-card white-card">
                 <div class="metric-header">
                    <div class="metric-info">
                        <span class="metric-label">New This Month</span>
                        <div class="metric-number-row">
                            <div class="metric-number-dark">{{ newMembersStats.count }}</div>
                            <div class="trend-badge negative"><ArrowDown :size="12" /> {{ newMembersStats.percent }}%</div>
                        </div>
                        <div class="metric-subtext">First-time visitors</div>
                    </div>
                    <div class="icon-circle soft-blue"><UserPlus :size="20" color="#2962FF" /></div>
                 </div>
            </div>
        </div>

        <!-- Row 2: Attendance Stats Breakdown -->
        <div class="attendance-breakdown-row">
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

        <!-- Row 3: Charts Grid (Expanded to 4 items) -->
        <div class="charts-grid-auto">
            <!-- ELEVATE Age -->
            <div class="chart-card">
                <h3>Gender & Age Group <span class="chart-sub">ELEVATE Members</span></h3>
                <div class="chart-wrapper" style="height: 240px;">
                    <BarChart v-if="members.length > 0 && elevateAgeData.labels.length > 0" :chartData="elevateAgeData" :chartOptions="genderAgeChartOptions" />
                    <p v-else class="no-data-text">No Elevate members found.</p>
                </div>
            </div>

            <!-- B1G Age -->
            <div class="chart-card">
                <h3>Gender & Age Group <span class="chart-sub">B1G Members</span></h3>
                <div class="chart-wrapper" style="height: 240px;">
                    <BarChart v-if="members.length > 0 && b1gAgeData.labels.length > 0" :chartData="b1gAgeData" :chartOptions="genderAgeChartOptions" />
                    <p v-else class="no-data-text">No B1G members found.</p>
                </div>
            </div>

            <!-- Member Categories -->
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

            <!-- Service Team -->
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
        
        <!-- PERFORMANCE VOLUNTEER TABLE -->
         <div class="perf-container mt-6">
            <div class="perf-header">
                <div class="perf-title">
                   <span class="text-blue uppercase">PERFORMANCE (THIS YEAR)</span>
                   <span class="text-gray uppercase ml-4">VOLUNTEER TABLE</span>
                </div>
                
                <div class="vol-tabs mt-4">
                    <button v-for="tab in volunteerMinistries" :key="tab"
                            class="vol-tab" :class="{active: activeVolunteerTab === tab}"
                            @click="activeVolunteerTab = tab">
                        {{ tab }}
                    </button>
                </div>
            </div>

            <div class="table-responsive">
                <table class="perf-table">
                    <thead>
                        <tr>
                            <th>MEMBER</th>
                            <th>TOTAL EVENTS</th>
                            <th>VOLUNTEERED</th>
                            <th>ATTENDANCE</th>
                            <th>RATE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in topVolunteers" :key="row.name">
                            <td class="font-bold text-dark">{{ row.name }}</td>
                            <td>{{ row.totalEvents }}</td>
                            <td>{{ row.volunteered }}</td>
                            <td>
                               <div class="attendance-bar-cell">
                                  <div class="progress-track">
                                      <div class="progress-fill" :style="{width: row.rate + '%'}"></div>
                                  </div>
                                  <span class="progress-text">{{row.volunteered}}/{{row.totalEvents}}</span>
                               </div>
                            </td>
                            <td>
                               <span class="rate-badge" :class="getRateColor(row.rate)">{{ row.rate }}%</span>
                            </td>
                        </tr>
                        <tr v-if="topVolunteers.length === 0">
                            <td colspan="5" class="text-center py-6 text-gray-500">No active volunteers for this ministry yet.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="view-all-row mt-4">
                <button class="view-all-btn" @click="openVolunteerModal">
                   <Eye :size="16" /> View All
                </button>
            </div>
        </div>

    </div>

    <!-- TAB 2: WKND SERVICE -->
    <div v-if="currentTab === 'wknd'" class="tab-content">
        <div class="metrics-row">
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
        <HistoricalAttendance eventType="service" />
    </div>

    <!-- TAB 3: B1G EVENTS -->
    <div v-if="currentTab === 'b1g'" class="tab-content">
        <div class="metrics-row">
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
        <HistoricalAttendance eventType="b1g" />
    </div>

    <!-- Full Volunteer Modal -->
    <Modal v-if="showFullVolunteerList" @close="showFullVolunteerList = false" size="xl">
        <div class="full-list-container p-4">
            <div class="modal-header-row mb-6">
                <h3 class="text-xl font-bold text-dark">Volunteer Activity List (This Year)</h3>
                <!-- Replaced local export logic with ExportButton -->
                <ExportButton 
                  exportType="volunteers" 
                  :volunteersData="modalVolunteers" 
                  :volunteerTab="modalVolunteerTab"
                  customLabel="Export Excel" 
                />
            </div>
            
            <div class="vol-tabs mb-6">
                <button class="vol-tab" :class="{active: modalVolunteerTab === 'All'}" @click="modalVolunteerTab = 'All'">All</button>
                <button v-for="tab in volunteerMinistries" :key="tab"
                        class="vol-tab" :class="{active: modalVolunteerTab === tab}"
                        @click="modalVolunteerTab = tab">
                    {{ tab }}
                </button>
            </div>

             <div class="table-responsive modal-table-wrap">
                <table class="perf-table w-full">
                   <thead>
                        <tr>
                            <th>MEMBER</th>
                            <th v-if="modalVolunteerTab === 'All'">MINISTRY</th>
                            <th>TOTAL EVENTS</th>
                            <th>VOLUNTEERED</th>
                            <th>ATTENDANCE</th>
                            <th>RATE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in modalVolunteers" :key="row.name">
                            <td class="font-bold text-dark">{{ row.fullName }}</td>
                            <td v-if="modalVolunteerTab === 'All'" class="text-sm text-gray-600">{{ row.ministryStr }}</td>
                            <td>{{ row.totalEvents }}</td>
                            <td>{{ row.volunteered }}</td>
                            <td>
                               <div class="attendance-bar-cell">
                                  <div class="progress-track">
                                      <div class="progress-fill" :style="{width: row.rate + '%'}"></div>
                                  </div>
                                  <span class="progress-text">{{row.volunteered}}/{{row.totalEvents}}</span>
                               </div>
                            </td>
                            <td>
                               <span class="rate-badge" :class="getRateColor(row.rate)">{{ row.rate }}%</span>
                            </td>
                        </tr>
                        <tr v-if="modalVolunteers.length === 0">
                            <td :colspan="modalVolunteerTab === 'All' ? 6 : 5" class="text-center py-8 text-gray-500">No records found for this selection.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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

/* --- METRICS ROW --- */
.metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; }

.metric-card {
    border-radius: 16px; padding: 24px;
    display: flex; justify-content: space-between; align-items: flex-start;
    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
    position: relative; 
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

/* 3. Charts Grid Auto */
.charts-grid-auto { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; }
.chart-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #ECEFF1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; flex-direction: column; }
.chart-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.chart-card h3 { margin: 0; font-size: 16px; font-weight: 700; color: #263238; margin-bottom: 16px; }
.chart-sub { font-size: 13px; font-weight: 400; color: #90A4AE; display: block; margin-top: 4px; }
.total-badge { font-size: 12px; font-weight: 600; color: #78909C; }
.chart-wrapper { position: relative; width: 100%; display: flex; justify-content: center; }
.donut-wrapper { height: 200px; margin: 10px 0; }

.chart-legend-custom { display: flex; justify-content: center; gap: 16px; margin-top: auto; padding-top: 16px; font-size: 13px; color: #546E7A; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.box { width: 12px; height: 12px; display: inline-block; border-radius: 2px; }

/* Colors for custom legend */
.box.regular { background: #00C853; }
.box.ft { background: #00B0FF; }
.box.vol { background: #00C853; }
.box.dl { background: #6200EA; }

/* --- PERFORMANCE VOLUNTEER TABLE --- */
.perf-container {
    background: white;
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #ECEFF1;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
}
.perf-title { display: flex; align-items: center; border-bottom: 1px solid #ECEFF1; padding-bottom: 12px; }
.perf-title .text-blue { color: #1976D2; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;}
.perf-title .text-gray { color: #90A4AE; font-weight: 600; font-size: 13px; letter-spacing: 0.5px;}

.vol-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
.vol-tab { 
    background: #F5F7FA; border: 1px solid #E0E0E0; color: #546E7A; 
    padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; 
    cursor: pointer; transition: 0.2s; white-space: nowrap;
}
.vol-tab.active { background: #1976D2; border-color: #1976D2; color: white; }

.table-responsive { overflow-x: auto; width: 100%; }
.perf-table { width: 100%; border-collapse: collapse; min-width: 600px; }
.perf-table th { 
    background: #F5F7FA; color: #78909C; font-size: 11px; font-weight: 700; 
    text-transform: uppercase; padding: 12px 16px; text-align: left; letter-spacing: 0.5px;
}
.perf-table td { padding: 16px; border-bottom: 1px solid #ECEFF1; color: #455A64; font-size: 14px; }
.perf-table tr:last-child td { border-bottom: none; }
.text-dark { color: #263238; }

.attendance-bar-cell { display: flex; align-items: center; gap: 12px; width: 200px; }
.progress-track { flex-grow: 1; height: 6px; background: #E3F2FD; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: #4C8BF5; border-radius: 4px; transition: width 0.3s ease; }
.progress-text { font-size: 13px; color: #546E7A; font-weight: 500; min-width: 40px; }

.rate-badge { padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 12px; display: inline-block; text-align: center; }
.rate-green { background: #E8F5E9; color: #2E7D32; }
.rate-blue { background: #E3F2FD; color: #1565C0; }
.rate-orange { background: #FFF3E0; color: #E65100; }

.view-all-row { border-top: 1px solid #ECEFF1; padding-top: 16px; }
.view-all-btn { 
    display: inline-flex; align-items: center; gap: 8px; background: #1976D2; color: white; 
    border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; 
    cursor: pointer; transition: 0.2s; 
}
.view-all-btn:hover { background: #1565C0; }

/* MODAL EXTRAS */
.modal-header-row { display: flex; justify-content: space-between; align-items: center; }
/* Replaced locally managed export-csv-btn styling, handled by ExportButton component now */

@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 900px) {
  .charts-grid-auto { grid-template-columns: 1fr; }
  .attendance-breakdown-row { grid-template-columns: 1fr; }
  .chart-card { padding: 16px; }
  .metric-number { font-size: 28px; }
  .metric-number-dark { font-size: 24px; }
}

@media (max-width: 480px) {
  .insights-container { padding: 10px; }
  .metrics-row { grid-template-columns: 1fr; gap: 12px; }
  .vol-tabs { padding-bottom: 12px; }
}
</style>