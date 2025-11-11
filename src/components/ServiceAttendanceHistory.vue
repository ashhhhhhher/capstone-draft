<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useMembersStore } from '../stores/members'
import { BarChart2, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-vue-next'
import DoughnutChart from './charts/DoughnutChart.vue'
import BarChart from './charts/BarChart.vue'

const emit = defineEmits(['close'])

const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()
const membersStore = useMembersStore()
const { allEvents } = storeToRefs(eventsStore)
const { allAttendance } = storeToRefs(attendanceStore)
const { members } = storeToRefs(membersStore)

// Track expanded service
const expandedServiceId = ref(null)

// Get today's date string
const todayStr = computed(() => {
  const today = new Date()
  const year = today.getFullYear()
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  const day = today.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
})

// Filter past weekend services only
const pastWeekendServices = computed(() => {
  return allEvents.value
    .filter(e => {
      const isPast = e.date < todayStr.value
      const isWeekendService = e.eventType === 'service' || e.name.toLowerCase().includes('service') || e.name.toLowerCase().includes('wknd')
      return isPast && isWeekendService
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Most recent first
})

// Calculate attendance count for each event
const servicesWithAttendance = computed(() => {
  return pastWeekendServices.value.map(event => {
    const attendanceCount = allAttendance.value.filter(
      att => att.eventId === event.id
    ).length
    
    return {
      ...event,
      attendanceCount
    }
  })
})

// Calculate statistics
const totalServices = computed(() => servicesWithAttendance.value.length)

const averageAttendance = computed(() => {
  if (totalServices.value === 0) return 0
  const total = servicesWithAttendance.value.reduce((sum, s) => sum + s.attendanceCount, 0)
  return Math.round(total / totalServices.value)
})

const highestAttendance = computed(() => {
  if (servicesWithAttendance.value.length === 0) return 0
  return Math.max(...servicesWithAttendance.value.map(s => s.attendanceCount))
})

const lowestAttendance = computed(() => {
  if (servicesWithAttendance.value.length === 0) return 0
  return Math.min(...servicesWithAttendance.value.map(s => s.attendanceCount))
})

// Get attendance trend (growth/decline)
const attendanceTrend = computed(() => {
  if (servicesWithAttendance.value.length < 2) return null
  
  const recent = servicesWithAttendance.value.slice(0, 3)
  const older = servicesWithAttendance.value.slice(-3)
  
  const recentAvg = recent.reduce((sum, s) => sum + s.attendanceCount, 0) / recent.length
  const olderAvg = older.reduce((sum, s) => sum + s.attendanceCount, 0) / older.length
  
  const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100
  
  return {
    direction: percentChange > 0 ? 'growing' : percentChange < 0 ? 'declining' : 'stable',
    percent: Math.abs(Math.round(percentChange))
  }
})

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

function getAttendanceClass(count) {
  if (count >= averageAttendance.value * 1.2) return 'high'
  if (count <= averageAttendance.value * 0.8) return 'low'
  return 'average'
}

function toggleServiceDetails(serviceId) {
  expandedServiceId.value = expandedServiceId.value === serviceId ? null : serviceId
}

// Get attendees for a specific service
function getServiceAttendees(serviceId) {
  const attendeeIds = allAttendance.value
    .filter(att => att.eventId === serviceId)
    .map(att => att.memberId)
  
  return members.value.filter(m => attendeeIds.includes(m.id))
}

// Chart options
const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom'
    },
    datalabels: {
      formatter: (value) => value > 0 ? value : '',
      color: '#333',
      font: {
        weight: 'bold',
        size: 12
      }
    }
  }
}

const genderAgeChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom'
    },
    datalabels: {
      formatter: (value) => value > 0 ? value : '',
      color: '#fff',
      anchor: 'center',
      align: 'center',
      font: {
        weight: 'bold',
        size: 12
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
}

// Get category distribution for a specific service
function getCategoryDistribution(serviceId) {
  const attendees = getServiceAttendees(serviceId)
  
  const regulars = attendees.filter(m => m.finalTags?.isRegular).length
  const leaders = attendees.filter(m => m.finalTags?.isDgroupLeader).length
  const firstTimers = attendees.filter(m => m.finalTags?.isFirstTimer).length
  const volunteers = attendees.filter(m => m.finalTags?.isVolunteer).length
  
  return {
    labels: ['Regulars', 'Dgroup Leaders', 'First Timers', 'Volunteers'],
    datasets: [{
      backgroundColor: ['#1976D2', '#42A5F5', '#FFCA28', '#90A4AE'],
      data: [regulars, leaders, firstTimers, volunteers]
    }]
  }
}

// Get gender & age distribution for a specific service
function getGenderAgeDistribution(serviceId) {
  const attendees = getServiceAttendees(serviceId)
  
  const malesElevate = attendees.filter(m => m.gender === 'Male' && m.finalTags?.ageCategory === 'Elevate').length
  const malesB1G = attendees.filter(m => m.gender === 'Male' && m.finalTags?.ageCategory === 'B1G').length
  const femalesElevate = attendees.filter(m => m.gender === 'Female' && m.finalTags?.ageCategory === 'Elevate').length
  const femalesB1G = attendees.filter(m => m.gender === 'Female' && m.finalTags?.ageCategory === 'B1G').length
  
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
}
</script>

<template>
  <div class="history-container">
    <div class="history-header">
      <BarChart2 :size="24" class="header-icon" />
      <h2>Weekend Service Attendance History</h2>
    </div>

    <!-- Summary Statistics -->
    <div v-if="totalServices > 0" class="stats-summary">
      <div class="stat-card">
        <Calendar :size="20" />
        <div class="stat-content">
          <span class="stat-label">Total Services</span>
          <span class="stat-value">{{ totalServices }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <Users :size="20" />
        <div class="stat-content">
          <span class="stat-label">Average Attendance</span>
          <span class="stat-value">{{ averageAttendance }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">▲</div>
        <div class="stat-content">
          <span class="stat-label">Highest</span>
          <span class="stat-value">{{ highestAttendance }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">▼</div>
        <div class="stat-content">
          <span class="stat-label">Lowest</span>
          <span class="stat-value">{{ lowestAttendance }}</span>
        </div>
      </div>
    </div>

    <!-- Trend Indicator -->
    <div v-if="attendanceTrend" class="trend-card" :class="attendanceTrend.direction">
      <span class="trend-label">Recent Trend:</span>
      <span class="trend-value">
        <span v-if="attendanceTrend.direction === 'growing'" class="trend-indicator growing">↑ Growing</span>
        <span v-else-if="attendanceTrend.direction === 'declining'" class="trend-indicator declining">↓ Declining</span>
        <span v-else class="trend-indicator stable">→ Stable</span>
        <span class="trend-percent">{{ attendanceTrend.percent }}%</span>
      </span>
    </div>

    <!-- Service History List -->
    <div class="history-list">
      <h3>Service History</h3>
      
      <div v-if="servicesWithAttendance.length > 0" class="service-list">
        <div 
          v-for="service in servicesWithAttendance" 
          :key="service.id"
          class="service-item-wrapper"
        >
          <div 
            class="service-item"
            @click="toggleServiceDetails(service.id)"
          >
            <div class="service-info">
              <div class="service-name">{{ service.name }}</div>
              <div class="service-date">{{ formatDate(service.date) }}</div>
            </div>
            
            <div class="service-actions">
              <div class="service-attendance" :class="getAttendanceClass(service.attendanceCount)">
                <Users :size="16" />
                <span class="attendance-count">{{ service.attendanceCount }}</span>
              </div>
              
              <button class="expand-btn">
                <ChevronDown v-if="expandedServiceId !== service.id" :size="20" />
                <ChevronUp v-else :size="20" />
              </button>
            </div>
          </div>
          
          <!-- Expandable Details Section -->
          <div v-if="expandedServiceId === service.id" class="service-details">
            <div class="details-grid">
              <!-- Category Distribution Chart -->
              <div class="detail-chart">
                <h4>Member Category Distribution</h4>
                <div class="chart-wrapper" style="height: 250px;">
                  <DoughnutChart 
                    :chartData="getCategoryDistribution(service.id)" 
                    :chartOptions="doughnutChartOptions"
                  />
                </div>
              </div>
              
              <!-- Gender & Age Distribution Chart -->
              <div class="detail-chart">
                <h4>Gender & Age Distribution</h4>
                <div class="chart-wrapper" style="height: 250px;">
                  <BarChart 
                    :chartData="getGenderAgeDistribution(service.id)" 
                    :chartOptions="genderAgeChartOptions"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="no-data">
        <p>No past weekend services found.</p>
        <p class="hint">Service attendance history will appear here after events are completed.</p>
      </div>
    </div>

    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.history-container {
  padding: 24px;
  width: 95vw;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #E3F2FD;
}

.header-icon {
  color: #1976D2;
}

.history-header h2 {
  margin: 0;
  color: #0D47A1;
  font-size: 22px;
}

/* Summary Statistics */
.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: #F5F5F5;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.stat-card:hover {
  border-color: #1976D2;
  transform: translateY(-2px);
}

.stat-card svg,
.stat-icon {
  color: #1976D2;
  font-size: 20px;
  font-weight: bold;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  color: #546E7A;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #0D47A1;
}

/* Trend Card */
.trend-card {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 4px solid #1976D2;
}

.trend-card.growing {
  background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%);
  border-left-color: #2E7D32;
}

.trend-card.declining {
  background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%);
  border-left-color: #F57C00;
}

.trend-label {
  font-weight: 600;
  color: #37474F;
  font-size: 14px;
}

.trend-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #0D47A1;
  font-size: 16px;
}

.trend-indicator {
  font-weight: 700;
  font-size: 16px;
}

.trend-indicator.growing {
  color: #2E7D32;
}

.trend-indicator.declining {
  color: #F57C00;
}

.trend-indicator.stable {
  color: #1976D2;
}

.trend-percent {
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 14px;
}

/* History List */
.history-list {
  margin-bottom: 20px;
}

.history-list h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #37474F;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.service-list {
  max-height: 600px;
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid #ECEFF1;
}

.service-item-wrapper {
  border-bottom: 1px solid #ECEFF1;
}

.service-item-wrapper:last-child {
  border-bottom: none;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  transition: background 0.2s ease;
  cursor: pointer;
}

.service-item:hover {
  background: #F5F5F5;
}

.service-item:last-child {
  border-bottom: none;
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-name {
  font-weight: 600;
  color: #37474F;
  font-size: 15px;
}

.service-date {
  font-size: 13px;
  color: #78909C;
}

.service-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.service-attendance {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 16px;
}

.service-attendance.high {
  background: #E8F5E9;
  color: #2E7D32;
}

.service-attendance.average {
  background: #E3F2FD;
  color: #1976D2;
}

.service-attendance.low {
  background: #FFF3E0;
  color: #F57C00;
}

.attendance-count {
  min-width: 30px;
  text-align: right;
}

.expand-btn {
  background: none;
  border: 1px solid #CFD8DC;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1976D2;
  padding: 0;
}

.expand-btn:hover {
  background: #E3F2FD;
  border-color: #1976D2;
}

/* Service Details Section */
.service-details {
  padding: 20px;
  background: #F8F9FA;
  border-top: 2px solid #E3F2FD;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 768px) {
  .details-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.detail-chart {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.detail-chart h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #37474F;
  text-align: center;
}

.chart-wrapper {
  position: relative;
}

/* No Data */
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #78909C;
}

.no-data p {
  margin: 8px 0;
}

.no-data .hint {
  font-size: 13px;
  color: #B0BEC5;
}

/* Close Button */
.close-btn {
  width: 100%;
  padding: 14px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.close-btn:hover {
  background-color: #1565C0;
}

/* Mobile Responsive */
@media (max-width: 600px) {
  .history-container {
    padding: 16px;
  }

  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .service-actions {
    width: 100%;
    justify-content: space-between;
  }

  .service-attendance {
    align-self: flex-start;
  }
  
  .service-details {
    padding: 12px;
  }
  
  .detail-chart {
    padding: 12px;
  }
}
</style>
