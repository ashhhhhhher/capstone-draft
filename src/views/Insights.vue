<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'

// Charts
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import AttendanceForecast from '../components/charts/AttendanceForecast.vue'

// DGM Components - Path fixed to match dgmComponents folder
import Modal from '../components/dgmComponents/Modal.vue'
import DgroupMatchingModal from '../components/dgmComponents/DgroupMatchingModal.vue'
import AttendanceOverviewModal from '../components/dgmComponents/AttendanceOverviewModal.vue'
import ExportButton from '../components/dgmComponents/ExportButton.vue'
import EventRecommendations from '../components/EventRecommendations.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, activeMembers, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showDgroupModal = ref(false)
const showAttendanceOverview = ref(false)

// --- KPI Data Computations ---
const demographics = computed(() => {
  return {
    total: activeMembers.value.length,
    regulars: activeMembers.value.filter(m => m.finalTags?.isRegular).length,
    leaders: activeMembers.value.filter(m => m.finalTags?.isDgroupLeader).length,
    firstTimers: activeMembers.value.filter(m => m.finalTags?.isFirstTimer).length,
    volunteers: activeMembers.value.filter(m => m.finalTags?.isVolunteer).length,
  }
})

// Logic for Inactive Members (Last 3 events)
const inactiveMembers = computed(() => {
  const serviceEvents = [...allEvents.value]
    .filter(e => e.eventType === 'service')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  
  if (serviceEvents.length < 3) return [];

  return activeMembers.value.filter(member => {
    const attendedCount = allAttendance.value.filter(att => 
      att.memberId === member.id && 
      serviceEvents.some(e => e.id === att.eventId)
    ).length;
    return attendedCount === 0;
  });
})

const attendanceTrends = computed(() => {
  const today = new Date();
  const pastEvents = allEvents.value.filter(e => new Date(e.date) <= today);
  if (pastEvents.length === 0) return { avg: 0, high: 0, low: 0 };
  
  const attendanceCounts = pastEvents.map(event => allAttendance.value.filter(att => att.eventId === event.id).length);
  const totalAttendance = attendanceCounts.reduce((sum, count) => sum + count, 0);
  return { 
    avg: (totalAttendance / pastEvents.length).toFixed(1), 
    high: Math.max(...attendanceCounts), 
    low: Math.min(...attendanceCounts) 
  };
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

// --- Chart Data ---
const categoryDistributionData = computed(() => {
  const d = demographics.value;
  return {
    labels: ['Regulars', 'Leaders', 'First Timers'],
    datasets: [{
      backgroundColor: ['#1976D2', '#42A5F5', '#FFCA28'],
      data: [d.regulars, d.leaders, d.firstTimers]
    }]
  }
})

const volunteerBreakdown = computed(() => {
    const ministries = ['Host', 'Live Prod', 'Exalt', 'DGM'];
    const counts = {};
    let totalVolunteers = 0;

    activeMembers.value.filter(m => m.finalTags?.isVolunteer).forEach(m => {
        m.finalTags.volunteerMinistry?.forEach(min => {
            if (ministries.includes(min)) {
                counts[min] = (counts[min] || 0) + 1;
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

const fromDate = ref(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
const toDate = ref(new Date().toISOString().split('T')[0])

const historicalAttendanceData = computed(() => {
  const eventsInRange = allEvents.value
    .filter(e => e.eventType === 'service' && e.date >= fromDate.value && e.date <= toDate.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return {
    labels: eventsInRange.map(ev => `${ev.name} (${ev.date})`),
    datasets: [{
      label: 'Total Attendance',
      backgroundColor: '#1E88E5',
      data: eventsInRange.map(ev => allAttendance.value.filter(att => att.eventId === ev.id).length)
    }]
  }
})
</script>

<template>
  <div class="insights-container">
    <div class="insights-header">
      <h1>Analytics Insights</h1>
      <p>Analyze historical trends and member engagement.</p>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-card-header">
            <h4>Total Members</h4>
            <ExportButton exportType="members" /> 
        </div>
        <div class="kpi-value">{{ demographics.total }}</div>
        <div class="kpi-detail-grid">
          <div><strong>{{ demographics.regulars }}</strong><span>Regulars</span></div>
          <div><strong>{{ demographics.leaders }}</strong><span>Leaders</span></div>
          <div><strong>{{ demographics.firstTimers }}</strong><span>First Timers</span></div>
        </div>
      </div>
      
      <div class="kpi-card">
        <h4>Attendance Trends</h4>
        <div class="kpi-value">{{ attendanceTrends.avg }}</div>
        <div class="kpi-detail">Average Attendance</div>
        <div class="kpi-sub-grid">
          <div><span class="kpi-sub-label">High</span><span class="kpi-sub-value">{{ attendanceTrends.high }}</span></div>
          <div><span class="kpi-sub-label">Low</span><span class="kpi-sub-value">{{ attendanceTrends.low }}</span></div>
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

    <div class="charts-grid">
      <div class="chart-card">
        <h3>Member Category Distribution</h3>
        <div class="chart-wrapper" style="height: 350px;">
          <DoughnutChart v-if="demographics.total > 0" :chartData="categoryDistributionData" />
          <p v-else class="no-data-text">No data available.</p>
        </div>
      </div>
      
      <div class="chart-card">
        <h3>Volunteer Ministry Breakdown</h3>
        <div v-if="volunteerBreakdown.total > 0" class="volunteer-progress-list">
          <div v-for="item in volunteerBreakdown.data" :key="item.name" class="ministry-item">
            <div class="ministry-label"><strong>{{ item.name }}</strong><span>{{ item.count }} Members</span></div>
            <div class="progress-bar-wrapper">
              <div class="ministry-progress-bar" :style="{ width: item.percent + '%', backgroundColor: '#1976D2' }"></div>
            </div>
          </div>
        </div>
        <p v-else class="no-data-text">No volunteers found.</p>
      </div>
    </div>

    <div class="chart-card-full">
      <div class="section-title-with-button">
        <h3>Historical Events Attendance</h3>
        <div class="controls-inline">
          <button class="view-overview-btn" @click="showAttendanceOverview = true">View Overview</button>
          <input type="date" v-model="fromDate" />
          <input type="date" v-model="toDate" />
          <ExportButton exportType="events" />
        </div>
      </div>
      <div class="chart-wrapper" style="height: 350px;">
        <BarChart v-if="historicalAttendanceData.labels.length > 0" :chartData="historicalAttendanceData" />
        <p v-else class="no-data-text">No data in range.</p>
      </div>
    </div>

    <div class="list-card">
      <h3>Inactive Members (Last 3 Events)</h3>
      <ul v-if="inactiveMembers.length > 0" class="member-follow-list">
        <li v-for="member in inactiveMembers" :key="member.id">
          <strong>{{ member.firstName }} {{ member.lastName }}</strong>
          <span>{{ member.email || 'No Email' }}</span>
        </li>
      </ul>
      <p v-else class="no-data-text">All members are active!</p>
    </div>

    <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl">
      <DgroupMatchingModal @close="showDgroupModal = false" />
    </Modal>

    <Modal v-if="showAttendanceOverview" @close="showAttendanceOverview = false" size="xl">
      <AttendanceOverviewModal @close="showAttendanceOverview = false" />
    </Modal>
  </div>
</template>

<style scoped>
/* Same as your previous styles, keeping them clean */
.insights-container { padding: 20px; }
.insights-header { margin-bottom: 20px; border-bottom: 1px solid #ECEFF1; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
.kpi-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.kpi-value { font-size: 40px; font-weight: 700; color: #0D47A1; }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
.chart-card, .chart-card-full, .list-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; }
.progress-bar-wrapper { height: 12px; background: #ECEFF1; border-radius: 6px; overflow: hidden; }
.ministry-progress-bar { height: 100%; transition: width 0.5s ease; }
.member-follow-list { list-style: none; padding: 0; }
.member-follow-list li { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ECEFF1; }
</style>