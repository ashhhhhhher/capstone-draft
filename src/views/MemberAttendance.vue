<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useAttendanceStore } from '../stores/attendance'
import { useEventsStore } from '../stores/events'
import { CheckCircle, Flame } from 'lucide-vue-next'

const authStore = useAuthStore()
const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()

const myId = computed(() => authStore.userProfile?.id)
const loading = ref(true)

onMounted(async () => {
  await eventsStore.fetchEvents()
  await attendanceStore.fetchAllAttendance()
  loading.value = false
})

const myAttendanceRecords = computed(() => {
  if (!myId.value) return []
  // Only include attendance records that reference an existing event
  return attendanceStore.allAttendance.filter(rec => {
    if (rec.memberId !== myId.value) return false
    const ev = eventsStore.allEvents.find(e => e.id === rec.eventId)
    return !!ev
  })
})

const enrichedRecords = computed(() => {
  return myAttendanceRecords.value.map(record => {
    const event = eventsStore.allEvents.find(e => e.id === record.eventId)
    const dateVal = event && event.date ? event.date : null
    return {
      ...record,
      eventName: event ? event.name : 'Unknown Event',
      date: dateVal,
    }
  })
  .filter(r => r.date) // remove any remaining records without a valid date
  .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totalCount = computed(() => enrichedRecords.value.length)
const streak = computed(() => Math.min(totalCount.value, 5))

const monthlyStats = computed(() => {
  const stats = {}
  enrichedRecords.value.forEach(rec => {
    if(!rec.date) return
    const d = new Date(rec.date)
    if (isNaN(d)) return
    const month = d.toLocaleString('default', { month: 'short' })
    stats[month] = (stats[month] || 0) + 1
  })
  return Object.entries(stats).slice(0, 4) 
})
</script>

<template>
  <div class="attendance-view">
    
    <div class="stats-column">
      <div class="stats-row">
        <div class="stat-card blue">
          <span class="label">Total Attendance</span>
          <div class="value">{{ totalCount }}</div>
        </div>
        <div class="stat-card fire">
          <span class="label">Streak</span>
          <div class="value">
            {{ streak }} <Flame :size="20" class="fire-icon" />
          </div>
        </div>
      </div>

      <section class="chart-section">
        <h3>Monthly Overview</h3>
        <div class="bar-chart">
          <div v-for="(month, index) in monthlyStats" :key="index" class="chart-col">
            <div class="bar-container">
              <div class="bar" :style="{ height: `${Math.min((month[1] / 4) * 100, 100)}%` }">
                <span class="bar-val">{{ month[1] }}</span>
              </div>
            </div>
            <span class="month-label">{{ month[0] }}</span>
          </div>
          <div v-if="monthlyStats.length === 0" class="no-data-chart">
            Attend events to see your stats!
          </div>
        </div>
      </section>
    </div>

    <section class="history-section">
      <h3>History Log</h3>
      <div class="history-list" v-if="!loading">
        <div v-for="rec in enrichedRecords" :key="rec.eventId" class="history-item">
          <div class="status-icon">
            <CheckCircle :size="20" color="#43A047" />
          </div>
          <div class="info">
            <h4>{{ rec.eventName }}</h4>
            <span class="date">{{ rec.date }}</span>
          </div>
          <div class="badge-attended">Present</div>
        </div>
        <div v-if="enrichedRecords.length === 0" class="empty-text">
          No attendance records found.
        </div>
      </div>
      <div v-else class="loading-text">Loading records...</div>
    </section>

  </div>
</template>

<style scoped>
.attendance-view { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 24px; 
}

@media (min-width: 900px) {
  .attendance-view {
    grid-template-columns: 1fr 1fr; /* Two columns on Desktop */
    align-items: start;
  }
}

.stats-column { display: flex; flex-direction: column; gap: 24px; }

/* Stats Row */
.stats-row { display: flex; gap: 16px; }
.stat-card { flex: 1; padding: 24px; border-radius: 16px; color: white; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.stat-card.blue { background: linear-gradient(135deg, #42A5F5, #1565C0); }
.stat-card.fire { background: linear-gradient(135deg, #FFCA28, #F57C00); }
.stat-card .label { font-size: 13px; font-weight: 600; opacity: 0.9; text-transform: uppercase; }
.stat-card .value { font-size: 36px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.fire-icon { fill: white; stroke: none; }

/* Chart */
.chart-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.chart-section h3 { margin: 0 0 24px 0; font-size: 18px; color: #37474F; }
.bar-chart { display: flex; justify-content: space-around; align-items: flex-end; height: 180px; padding-bottom: 10px; }
.chart-col { display: flex; flex-direction: column; align-items: center; height: 100%; width: 40px; justify-content: flex-end; }
.bar-container { width: 100%; height: 130px; display: flex; align-items: flex-end; justify-content: center; }
.bar { width: 16px; background: #1976D2; border-radius: 8px; position: relative; transition: height 0.5s ease; min-height: 4px; }
.bar-val { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-size: 12px; color: #546E7A; font-weight: 700; }
.month-label { margin-top: 10px; font-size: 13px; color: #90A4AE; }

/* History Log */
.history-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); height: 100%; max-height: 500px; overflow-y: auto; }
.history-section h3 { font-size: 18px; color: #37474F; margin-bottom: 16px; position: sticky; top: 0; background: white; padding-bottom: 10px; }
.history-item { background: #FAFAFA; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; border: 1px solid #F5F5F5; }
.info { flex: 1; }
.info h4 { margin: 0; font-size: 16px; color: #263238; }
.info .date { font-size: 13px; color: #78909C; }
.badge-attended { background: #E8F5E9; color: #2E7D32; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
.empty-text { text-align: center; color: #B0BEC5; margin-top: 20px; }
</style>