<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useNotificationsStore } from '../stores/notifications'
import { Archive, Mail, Bell, CheckCircle } from 'lucide-vue-next'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import Modal from '../components/Modal.vue'
import DgroupMatchingModal from '../components/DgroupMatchingModal.vue'
import ExportButton from '../components/ExportButton.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { members, activeMembers, leaders, seekers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())
const notificationsStore = useNotificationsStore()

// --- Modal State ---
const showDgroupModal = ref(false)

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
    y: { beginAtZero: true, stacked: false, ticks: { stepSize: 1 } }
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

const historicalAttendanceData = computed(() => {
  const recentEvents = allEvents.value.filter(e => e.eventType === 'service').slice(0, 10).reverse()
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

// --- Absence Monitoring Logic ---
const monitoringList = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  const pastServices = allEvents.value
    .filter(e => e.eventType === 'service' && e.date <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pastServices.length === 0) return [];

  const results = [];
  const listToCheck = activeMembers.value;

  listToCheck.forEach(member => {
    let consecutiveAbsences = 0;
    
    // Calculate streak
    for (const event of pastServices) {
      const attended = allAttendance.value.some(
        att => att.eventId === event.id && att.memberId === member.id
      );
      if (!attended) consecutiveAbsences++;
      else break; 
    }

    // Assign Status & Flags
    if (consecutiveAbsences >= 3) {
      let statusLabel = 'At Risk';
      let statusClass = 'status-yellow';
      let showNotifyLeader = false;
      let showArchive = false;

      if (consecutiveAbsences === 4) {
        statusLabel = 'Needs Follow-Up';
        statusClass = 'status-orange';
        showNotifyLeader = true;
      } else if (consecutiveAbsences >= 5) {
        statusLabel = 'Inactive';
        statusClass = 'status-red';
        showArchive = true;
      }
      
      const type = member.finalTags.isDgroupLeader ? 'Leader' : 
                   member.finalTags.isRegular ? 'Regular' : 'Member';

      const msgSent = !!member.monitoringState?.msgSentDate;
      const leaderNotified = !!member.monitoringState?.leaderNotifiedDate;

      results.push({
        ...member,
        typeString: type,
        consecutiveAbsences,
        statusLabel,
        statusClass,
        showNotifyLeader,
        showArchive,
        msgSent,
        leaderNotified
      });
    }
  });

  return results.sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);
});

// --- Action Functions ---

async function handleMessageMember(member) {
  if (member.email) {
    window.location.href = `mailto:${member.email}?subject=Checking in - Elevate Baguio&body=Hi ${member.firstName}, we noticed you missed a few services. Hope everything is okay!`;
  } else {
    alert(`No email for ${member.firstName}. Marked as sent.`);
  }
  
  await notificationsStore.sendNotification(
    member.id, 
    "We missed you!", 
    "Hey! We noticed you haven't been around lately. We hope to see you at the next service!"
  );

  await membersStore.logMonitoringAction(member.id, 'message');
}

async function handleNotifyLeader(member) {
  if (member.dgroupLeader) {
    alert(`Notification sent to leader (${member.dgroupLeader}) regarding ${member.firstName}.`);
    await membersStore.logMonitoringAction(member.id, 'notifyLeader');
  } else {
    alert("No Dgroup Leader assigned.");
  }
}

function handleArchiveMember(member) {
  if (confirm(`Archive ${member.firstName}? They will be moved to the Archived list.`)) {
    membersStore.archiveMember(member.id);
  }
}
</script>

<template>
  <div class="insights-container">
    <div class="insights-header">
      <h1>Analytics Insights</h1>
      <p>Analyze historical trends and member engagement.</p>
    </div>

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
        <ExportButton exportType="events" />
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

    <!-- 5. Absence Monitoring Table -->
    <div class="list-card">
      <div class="monitoring-header">
        <h3>Absence Monitoring & Engagement</h3>
        <div class="legend-badges">
          <span class="badge status-yellow">At Risk (3)</span>
          <span class="badge status-orange">Follow-Up (4)</span>
          <span class="badge status-red">Inactive (5+)</span>
        </div>
      </div>
      <p class="list-subtitle">Members requiring attention due to consecutive absences.</p>
      
      <div v-if="monitoringList.length > 0" class="monitoring-table-wrapper">
        <table class="monitoring-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Type</th>
              <th>Status | Absences</th>
              <th>Dgroup Leader</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in monitoringList" :key="member.id">
              <td>
                <div class="member-name">{{ member.firstName }} {{ member.lastName }}</div>
                <div class="member-email">{{ member.email }}</div>
              </td>
              <td>{{ member.typeString }}</td>
              <td>
                <div class="status-cell">
                  <span class="status-pill" :class="member.statusClass">
                    {{ member.statusLabel }}
                  </span>
                  <span class="abs-count">{{ member.consecutiveAbsences }} missed</span>
                </div>
              </td>
              <td>
                <div class="leader-cell">
                  <span>{{ member.dgroupLeader || 'None' }}</span>
                  <span v-if="member.leaderNotified" class="notified-badge">
                    <CheckCircle :size="12" /> Notified
                  </span>
                </div>
              </td>
              <td>
                <div class="action-row">
                  <!-- Message Button / Sent Badge -->
                  <span v-if="member.msgSent" class="action-done-badge" :class="member.statusClass">
                    Message Sent
                  </span>
                  <button v-else class="action-btn message" @click="handleMessageMember(member)" title="Send Check-in Message">
                    <Mail :size="16" /> Send Message
                  </button>

                  <!-- Notify Leader (Only for 4+) -->
                  <button v-if="member.showNotifyLeader && !member.leaderNotified" class="action-btn notify" @click="handleNotifyLeader(member)" title="Notify Dgroup Leader">
                    <Bell :size="16" /> Notify Leader
                  </button>

                  <!-- Archive (Only for 5+) -->
                  <button v-if="member.showArchive" class="action-btn archive" @click="handleArchiveMember(member)" title="Archive Member">
                    <Archive :size="16" /> Archive
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">✨</div>
        <p>Great news! No members are currently at risk.</p>
      </div>
    </div>
  </div>
  
  <Modal v-if="showDgroupModal" @close="showDgroupModal = false" size="xl">
    <DgroupMatchingModal @close="showDgroupModal = false" />
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
.chart-card h3, .chart-card-full h3, .list-card h3 {
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

/* --- List Card & Monitoring Table --- */
.list-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.monitoring-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}
.monitoring-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.legend-badges {
  display: flex;
  gap: 8px;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.status-yellow { background: #FFF8E1; color: #FBC02D; }
.status-orange { background: #FFF3E0; color: #F57C00; }
.status-red { background: #FFEBEE; color: #D32F2F; }

.list-subtitle {
  font-size: 14px;
  color: #546E7A;
  margin-top: 0;
  margin-bottom: 20px;
}

.monitoring-table-wrapper {
  overflow-x: auto;
}
.monitoring-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}
.monitoring-table th {
  text-align: left;
  font-size: 12px;
  color: #90A4AE;
  text-transform: uppercase;
  padding: 12px;
  border-bottom: 1px solid #eee;
}
.monitoring-table td {
  padding: 12px;
  border-bottom: 1px solid #f5f5f5;
  vertical-align: middle;
}
.monitoring-table tr:last-child td {
  border-bottom: none;
}

.member-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}
.member-email {
  font-size: 12px;
  color: #78909C;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 700;
  color: #37474F;
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.abs-count {
  font-size: 11px;
  color: #78909C;
}
.status-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  width: fit-content;
}
.status-pill.status-yellow { background: #FFFDE7; color: #FBC02D; }
.status-pill.status-orange { background: #FFF3E0; color: #EF6C00; }
.status-pill.status-red { background: #FFEBEE; color: #C62828; }

.leader-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.notified-badge {
  font-size: 11px;
  color: #2E7D32;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.action-row {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  align-items: center;
}
.action-btn {
  border: none;
  border-radius: 6px;
  height: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.action-btn.message { background: #E3F2FD; color: #1976D2; }
.action-btn.message:hover { background: #1976D2; color: white; }
.action-btn.notify { background: #FFF3E0; color: #F57C00; }
.action-btn.notify:hover { background: #F57C00; color: white; }
.action-btn.archive { background: #FFEBEE; color: #D32F2F; }
.action-btn.archive:hover { background: #D32F2F; color: white; }

.action-done-badge {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}
.action-done-badge.status-yellow { background: #FFFDE7; color: #FBC02D; border: 1px solid #FBC02D; }
.action-done-badge.status-orange { background: #FFF3E0; color: #EF6C00; border: 1px solid #EF6C00; }

.empty-state {
  text-align: center;
  padding: 40px;
  background: #FAFAFA;
  border-radius: 8px;
  border: 1px dashed #E0E0E0;
}
.empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
}
.no-data-text {
  text-align: center;
  padding: 40px;
  color: #78909C;
}
</style>