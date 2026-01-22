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
      eventType: event ? event.eventType : null
    }
  })
  .filter(r => r.date) // remove any remaining records without a valid date
  .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totalCount = computed(() => enrichedRecords.value.length)
const streak = computed(() => Math.min(totalCount.value, 5))
const isB1GMember = computed(() => authStore.userProfile?.finalTags?.ageCategory === 'B1G')
const wkndCount = computed(() => enrichedRecords.value.filter(r => r.eventType === 'service').length)
const b1gCount = computed(() => enrichedRecords.value.filter(r => r.eventType === 'b1g_event').length)

// Monthly stats: return array of { month, wknd, b1g, total }
const monthlyStats = computed(() => {
  const map = {}
  enrichedRecords.value.forEach(rec => {
    if (!rec.date) return
    const d = new Date(rec.date)
    if (isNaN(d)) return
    const month = d.toLocaleString('default', { month: 'short' })
    if (!map[month]) map[month] = { wknd: 0, b1g: 0 }
    if (rec.eventType === 'service') map[month].wknd += 1
    else if (rec.eventType === 'b1g_event') map[month].b1g += 1
  })
  const arr = Object.entries(map).map(([m, v]) => ({ month: m, wknd: v.wknd, b1g: v.b1g, total: v.wknd + v.b1g }))
  // sort by recent months order based on appearance in enrichedRecords (they're sorted desc), keep up to 4
  const ordered = []
  for (const rec of enrichedRecords.value) {
    const d = new Date(rec.date)
    const m = d.toLocaleString('default', { month: 'short' })
    if (!ordered.find(x => x.month === m) && arr.find(x => x.month === m)) {
      ordered.push(arr.find(x => x.month === m))
    }
    if (ordered.length >= 4) break
  }
  return ordered
})

const monthlyMax = computed(() => {
  const arr = monthlyStats.value || []
  if (!arr.length) return 0
  return Math.max(...arr.map(s => s.total))
})
</script>

<template>
  <div class="attendance-view">
    
    <div class="stats-column">
      <div class="stats-row">
        <div class="stat-card blue">
          <span class="label">Total WKND Attendance</span>
          <div class="value">{{ wkndCount }}</div>
        </div>
        <div class="stat-card fire">
          <span class="label">Streak</span>
          <div class="value">
            {{ streak }} <Flame :size="20" class="fire-icon" />
          </div>
        </div>
          <div v-if="isB1GMember" class="stat-card red">
            <span class="label">B1G Services</span>
            <div class="value">{{ b1gCount }}</div>
          </div>
      </div>

      <section class="chart-section">
        <h3>Monthly Overview</h3>
        <div class="bar-chart">
          <div v-for="(stat, index) in monthlyStats" :key="index" class="chart-col">
            <div class="bar-container">
              <div class="bar" style="position: relative; width: 40px; height: 130px;">
                <div v-if="monthlyMax > 0" class="bar-segment wknd" :style="{ height: `${(stat.wknd / monthlyMax) * 100}%`, bottom: '0%' }"></div>
                <div v-if="monthlyMax > 0" class="bar-segment b1g" :style="{ height: `${(stat.b1g / monthlyMax) * 100}%`, bottom: `${(stat.wknd / monthlyMax) * 100}%` }"></div>
                <span class="bar-val" style="position: absolute; top: -22px; left: 50%; transform: translateX(-50%);">{{ stat.total }}</span>
              </div>
            </div>
            <span class="month-label">{{ stat.month }}</span>
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
            <h4>{{ rec.eventName }} <span :class="['event-tag', rec.eventType === 'service' ? 'service-tag' : (rec.eventType === 'b1g_event' ? 'b1g-tag' : 'ccf-tag')]">{{ rec.eventType === 'service' ? 'WKND' : (rec.eventType === 'b1g_event' ? 'B1G' : 'CCF') }}</span></h4>
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
.stat-card.red { background: linear-gradient(135deg, #f54242, #c01515); }
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

/* Monthly stacked segments */
.bar-segment { position: absolute; left: 50%; transform: translateX(-50%); width: 16px; border-radius: 8px; }
.bar-segment.wknd { background: #1976D2; }
.bar-segment.b1g { background: #D32F2F; }

/* History event tag */
.event-tag { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 10px; margin-left: 8px; text-transform: uppercase; }
.event-tag.service-tag { background: #E3F2FD; color: #1565C0; }
.event-tag.b1g-tag { background: #FFEBEE; color: #D32F2F; }
.event-tag.ccf-tag { background: #FFF8E1; color: #F57C00; }

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