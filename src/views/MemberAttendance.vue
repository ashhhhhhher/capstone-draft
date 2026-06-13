<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useAttendanceStore } from '../stores/attendance'
import { useEventsStore } from '../stores/events'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import { CheckCircle, Flame, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const authStore = useAuthStore()
const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()

const myId = computed(() => authStore.userProfile?.id)
const loading = ref(true)
const selectedYear = ref(new Date().getFullYear())
const historyFilter = ref('present')
const eventTypeFilter = ref('service')

// Store only the current year's attendance locally
const fetchedYearAttendance = ref([])

// Calculate the earliest year this member can view based on their registration date
const minYear = computed(() => {
  if (authStore.userProfile?.createdAt) {
    return new Date(authStore.userProfile.createdAt).getFullYear()
  }
  return new Date().getFullYear() // Default to current year if missing
})

// 🚀 OPTIMIZATION & SMART FALLBACK: Fetch MY records safely
async function loadYearlyAttendance() {
  if (!myId.value) return;

  const profile = authStore.userProfile;
  const joinedDateStr = profile?.createdAt ? new Date(profile.createdAt).toISOString().split('T')[0] : null;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Instantly exit if trying to load a year before they joined (0 reads)
  if (selectedYear.value < minYear.value) {
    fetchedYearAttendance.value = [];
    loading.value = false;
    return;
  }
  
  loading.value = true;
  try {
    await eventsStore.fetchEvents()

    const startStr = `${selectedYear.value}-01-01`;
    const endStr = `${selectedYear.value}-12-31`;
    
    // 2. Try the ultra-fast indexed query for NEW records
    let myYearData = await attendanceStore.fetchMyAttendanceByDateRange(myId.value, startStr, endStr);

    const yearPrefix = `${selectedYear.value}-`
    const eventsThisYear = eventsStore.allEvents
      .filter(e => {
        const eventDate = e?.date || ''
        const isThisYear = eventDate.startsWith(yearPrefix)
        const isAfterJoined = joinedDateStr ? eventDate >= joinedDateStr : true
        const isNotFuture = selectedYear.value === new Date().getFullYear() ? eventDate <= todayStr : true
        return isThisYear && isAfterJoined && isNotFuture
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    
    // 3. FALLBACK for OLD records (Missing 'memberId' field)
    if (myYearData.length === 0 && eventsThisYear.length > 0) {
      const fallbackRecords = [];
      for (const event of eventsThisYear) {
        try {
          const attRef = doc(db, 'branches', authStore.branchId, 'events', event.id, 'attendance', myId.value);
          const attSnap = await getDoc(attRef);
          if (attSnap.exists()) {
            fallbackRecords.push({ eventId: event.id, memberId: myId.value, ...attSnap.data() });
          }
        } catch(e) {
          // Silenced to prevent console spam from Firebase permission errors on records they didn't attend
        }
      }
      myYearData = fallbackRecords;
    }

    const presentByEventId = new Map(myYearData.map(record => [record.eventId, record]))

    fetchedYearAttendance.value = eventsThisYear.map(event => {
      const presentRecord = presentByEventId.get(event.id)
      return {
        eventId: event.id,
        memberId: myId.value,
        status: presentRecord ? 'present' : 'absent',
        ...presentRecord,
        eventName: event.name || 'Unknown Event',
        date: event.date || null,
        eventType: event.eventType || null
      }
    })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await eventsStore.fetchEvents()
  if (myId.value) {
    loadYearlyAttendance()
  }
})

// Watchers ensure we fetch if the user ID loads slightly after mount, or if they change the year
watch(myId, (newId) => {
  if (newId) loadYearlyAttendance()
})

watch(selectedYear, () => {
  loadYearlyAttendance()
})

const changeYear = (delta) => {
  selectedYear.value += delta
}

const historyRecords = computed(() => {
  return fetchedYearAttendance.value
    .map(record => {
      const event = eventsStore.allEvents.find(e => e.id === record.eventId)
      return {
        ...record,
        eventName: event ? event.name : record.eventName || 'Unknown Event',
        date: event && event.date ? event.date : record.date || null,
        eventType: event ? event.eventType : record.eventType || null,
        status: record.status === 'absent' ? 'absent' : 'present'
      }
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const eventTypeOptions = computed(() => {
  if (isB1GMember.value) {
    return [
      { value: 'service', label: 'WKND' },
      { value: 'b1g_event', label: 'B1G' }
    ]
  }
  return [{ value: 'service', label: 'WKND' }]
})

const filteredHistoryRecords = computed(() => {
  return historyRecords.value.filter(rec => {
    const statusMatch = historyFilter.value === 'all' || rec.status === historyFilter.value
    const typeMatch = isB1GMember.value ? rec.eventType === eventTypeFilter.value : rec.eventType === 'service'
    return statusMatch && typeMatch
  })
})

const presentAttendanceRecords = computed(() => historyRecords.value.filter(rec => rec.status === 'present'))

const enrichedRecords = computed(() => {
  return presentAttendanceRecords.value.map(record => {
    const event = eventsStore.allEvents.find(e => e.id === record.eventId)
    const dateVal = event && event.date ? event.date : null
    return {
      ...record,
      eventName: event ? event.name : 'Unknown Event',
      date: dateVal,
      eventType: event ? event.eventType : null
    }
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totalCount = computed(() => presentAttendanceRecords.value.length)
const streak = computed(() => Math.min(totalCount.value, 5))
const isB1GMember = computed(() => authStore.userProfile?.finalTags?.ageCategory === 'B1G')
const wkndCount = computed(() => presentAttendanceRecords.value.filter(r => r.eventType === 'service').length)
const b1gCount = computed(() => presentAttendanceRecords.value.filter(r => r.eventType === 'b1g_event').length)

const monthlySeries = computed(() => {
  if (historyFilter.value === 'present') {
    return [{ key: 'present', label: 'Present', colorClass: 'present-color' }]
  }
  if (historyFilter.value === 'absent') {
    return [{ key: 'absent', label: 'Absent', colorClass: 'absent-color' }]
  }
  return [
    { key: 'present', label: 'Present', colorClass: 'present-color' },
    { key: 'absent', label: 'Absent', colorClass: 'absent-color' }
  ]
})

const monthlyStats = computed(() => {
  const map = {}
  
  // Ensure all 12 months exist so the X-axis is always full and structured
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  monthNames.forEach((m, idx) => {
    map[m] = { present: 0, absent: 0, sortIdx: idx }
  })

  filteredHistoryRecords.value.forEach(rec => {
    const d = new Date(rec.date)
    const month = d.toLocaleString('default', { month: 'short' })
    if (map[month]) {
      if (rec.status === 'present') map[month].present += 1
      else if (rec.status === 'absent') map[month].absent += 1
    }
  })

  return Object.entries(map)
    .map(([m, v]) => ({ month: m, present: v.present, absent: v.absent, total: v.present + v.absent, sortIdx: v.sortIdx }))
    .sort((a, b) => a.sortIdx - b.sortIdx)
})

const monthlyMax = computed(() => {
  const arr = monthlyStats.value || []
  if (!arr.length) return 1
  const maxVal = Math.max(...arr.flatMap(s => [s.present, s.absent]))
  return maxVal > 0 ? maxVal : 1 // Prevent division by zero
})

// Generate 3 labels for the Y-Axis (Top, Middle, Bottom)
const yAxisLabels = computed(() => {
  const max = monthlyMax.value;
  if (max <= 2) return [max, 0];
  return [max, Math.round(max / 2), 0];
})
</script>

<template>
  <div class="attendance-view">
    
    <div class="stats-column">
      <!-- Year Selector UI -->
      <div class="year-selector">
        <button @click="changeYear(-1)" class="year-btn" :disabled="selectedYear <= minYear"><ChevronLeft :size="20" /></button>
        <h2 class="year-label">{{ selectedYear }}</h2>
        <button @click="changeYear(1)" class="year-btn" :disabled="selectedYear >= new Date().getFullYear()"><ChevronRight :size="20" /></button>
              <div v-if="isB1GMember" class="event-toggle event-toggle-top">
        <button
          v-for="option in eventTypeOptions"
          :key="option.value"
          class="toggle-btn"
          :class="{ active: eventTypeFilter === option.value }"
          @click="eventTypeFilter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      </div>



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
      </div>

      <section class="chart-section">
        <div class="chart-header">
          <h3>Monthly Overview</h3>
          
          <!-- Dynamic Legend -->
          <div class="chart-legend">
            <div v-for="series in monthlySeries" :key="series.key" class="legend-item">
              <span class="legend-box" :class="series.colorClass"></span> {{ series.label }}
            </div>
          </div>
        </div>

        <div class="custom-chart-container" v-if="!loading">
          
          <!-- Y-Axis -->
          <div class="y-axis">
            <span v-for="val in yAxisLabels" :key="val">{{ val }}</span>
          </div>
          
          <!-- Structured Chart Area -->
          <div class="chart-content-area">
            <!-- Background Grid Lines -->
            <div class="grid-lines">
              <div class="grid-line"></div>
              <div class="grid-line" v-if="yAxisLabels.length > 2"></div>
              <div class="grid-line"></div>
            </div>
            
            <!-- The Bars -->
            <div class="bar-chart">
              <div v-for="(stat, index) in monthlyStats" :key="index" class="chart-col">
                <div class="bar-group">
                  <template v-for="series in monthlySeries" :key="series.key">
                    <div v-if="stat[series.key] > 0" class="bar-wrapper">
                      <span class="bar-val">{{ stat[series.key] }}</span>
                      <div
                        class="bar-segment"
                        :class="series.colorClass"
                        :style="{ height: `${(stat[series.key] / monthlyMax) * 100}%` }"
                      ></div>
                    </div>
                  </template>

                </div>
                <span class="month-label">{{ stat.month }}</span>
              </div>
            </div>
          </div>

        </div>
        <div v-else class="no-data-chart mt-4">Loading chart...</div>
      </section>
    </div>

    <section class="history-section">
      <div class="history-header">
        <h3>History Log ({{ selectedYear }})</h3>
        <div class="history-controls">
          <div class="history-filter">
            <label for="historyFilter">Status</label>
            <select id="historyFilter" v-model="historyFilter">
              <option value="all">All</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
      </div>
      <div class="history-list" v-if="!loading">
        <div v-for="rec in filteredHistoryRecords" :key="`${rec.eventId}-${rec.status}`" class="history-item" :class="[`status-${rec.status}`]">
          <div class="status-icon" :class="rec.status">
            <CheckCircle v-if="rec.status === 'present'" :size="20" color="#43A047" />
            <span v-else class="absent-mark">×</span>
          </div>
          <div class="info">
            <h4>{{ rec.eventName }} <span :class="['event-tag', rec.eventType === 'service' ? 'service-tag' : (rec.eventType === 'b1g_event' ? 'b1g-tag' : 'ccf-tag')]">{{ rec.eventType === 'service' ? 'WKND' : (rec.eventType === 'b1g_event' ? 'B1G' : 'CCF') }}</span></h4>
            <span class="date">{{ rec.date }}</span>
          </div>
          <div :class="['badge-attended', rec.status === 'present' ? 'present' : 'absent']">{{ rec.status === 'present' ? 'Present' : 'Absent' }}</div>
        </div>
        <div v-if="filteredHistoryRecords.length === 0" class="empty-text">
          No {{ historyFilter === 'all' ? 'attendance or absence' : historyFilter }} records found for this year.
        </div>
      </div>
      <div v-else class="loading-text">Loading records...</div>
    </section>

  </div>
</template>

<style scoped>
/* Fixes to ensure uniform left/right margins regardless of screen size */
.attendance-view { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 24px; 
  padding: 16px; 
  box-sizing: border-box;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  overflow-x: hidden; 
}
@media (min-width: 900px) { 
  .attendance-view { grid-template-columns: 1fr 1fr; align-items: start; } 
}

.stats-column { display: flex; flex-direction: column; gap: 24px; width: 100%; box-sizing: border-box; }
.year-selector { display: flex; align-items: center; justify-content: center; gap: 20px; background: white; padding: 12px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.year-btn { background: #F5F5F5; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #37474F; transition: background 0.2s; }
.year-btn:hover:not(:disabled) { background: #EEEEEE; }
.year-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.year-label { font-size: 18px; font-weight: 700; color: #37474F; margin: 0; }

.stats-row { display: flex; gap: 16px; flex-wrap: wrap; }
.stat-card { flex: 1; min-width: 120px; box-sizing: border-box; padding: 24px; border-radius: 16px; color: white; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.stat-card.blue { background: linear-gradient(135deg, #42A5F5, #1565C0); }
.stat-card.fire { background: linear-gradient(135deg, #FFCA28, #F57C00); }
.stat-card .label { font-size: 13px; font-weight: 600; opacity: 0.9; text-transform: uppercase; }
.stat-card .value { font-size: 36px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.fire-icon { fill: white; stroke: none; }

.chart-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box; }
.chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.chart-header h3 { margin: 0; font-size: 18px; color: #37474F; }
.chart-legend { display: flex; gap: 16px; align-items: center; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #546E7A; }
.legend-box { width: 12px; height: 12px; border-radius: 3px; }
.present-color { background: #2E7D32; }
.absent-color { background: #D32F2F; }

.custom-chart-container {
  display: flex;
  height: 240px;
  gap: 12px;
  padding-top: 10px;
  width: 100%;
  box-sizing: border-box;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 30px; 
  color: #90A4AE;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  min-width: 20px;
}

.chart-content-area {
  position: relative;
  flex-grow: 1;
  border-left: 2px solid #ECEFF1;
  border-bottom: 2px solid #ECEFF1;
  display: flex;
  align-items: flex-end;
  padding-bottom: 0;
}

.grid-lines {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 30px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 0;
}

.grid-line {
  width: 100%;
  height: 1px;
  background: #F0F2F5;
}
.grid-line:last-child {
  background: transparent; 
}

.bar-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.chart-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  flex: 1;
}

.bar-group {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: calc(100% - 30px); 
  width: 100%;
  justify-content: center;
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  width: 14px;
}

.bar-segment {
  width: 100%;
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
  min-height: 2px;
}

.bar-segment.present-color { background: #2E7D32; }
.bar-segment.absent-color { background: #D32F2F; }

.bar-val {
  font-size: 10px;
  color: #546E7A;
  font-weight: 800;
  margin-bottom: 4px;
}

.month-label {
  height: 30px;
  display: flex;
  align-items: center;
  font-size: 10px;
  color: #90A4AE;
  font-weight: 700;
  margin-top: 4px;
  text-transform: uppercase;
}

.event-tag { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 10px; margin-left: 8px; text-transform: uppercase; }
.event-tag.service-tag { background: #E3F2FD; color: #1565C0; }
.event-tag.b1g-tag { background: #E8F3FF; color: #1E88E5; }
.event-tag.ccf-tag { background: #FFF8E1; color: #F57C00; }

.history-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); height: 100%; max-height: 500px; overflow-y: auto; width: 100%; box-sizing: border-box; }
.history-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; position: sticky; top: 0; background: white; padding-bottom: 10px; z-index: 1; }
.history-section h3 { font-size: 18px; color: #37474F; margin: 0; }
.history-controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.event-toggle { display: inline-flex; border: 1px solid #DDE3E8; border-radius: 12px; overflow: hidden; background: #fff; }
.event-toggle-top { align-self: center; margin: 8px auto 0; width: fit-content; }
.toggle-btn { border: none; background: #fff; color: #546E7A; font-size: 13px; font-weight: 700; padding: 8px 14px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.toggle-btn + .toggle-btn { border-left: 1px solid #DDE3E8; }
.toggle-btn:hover { background: #F5F9FF; }
.toggle-btn.active { background: #E3F2FD; color: #1565C0; }
.history-filter { display: flex; align-items: center; gap: 8px; }
.history-filter label { font-size: 12px; font-weight: 700; color: #546E7A; text-transform: uppercase; }
.history-filter select { border: 1px solid #DDE3E8; border-radius: 10px; background: #fff; color: #37474F; font-size: 13px; font-weight: 600; padding: 8px 10px; outline: none; }
.history-filter select:focus { border-color: #90CAF9; box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.12); }
.history-item { background: #FAFAFA; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; border: 1px solid #F5F5F5; }
.history-item.status-absent { background: #FFF5F5; border-color: #FFE0E0; }
.info { flex: 1; }
.info h4 { margin: 0; font-size: 16px; color: #263238; }
.info .date { font-size: 13px; color: #78909C; }
.status-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.status-icon.absent { color: #D32F2F; }
.absent-mark { font-size: 18px; font-weight: 800; line-height: 1; color: #D32F2F; }
.badge-attended { font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
.badge-attended.present { background: #E8F5E9; color: #2E7D32; }
.badge-attended.absent { background: #FFEBEE; color: #C62828; }
.empty-text { text-align: center; color: #B0BEC5; margin-top: 20px; }
.no-data-chart { color: #B0BEC5; font-size: 14px; width: 100%; text-align: center; }
.loading-text { text-align: center; color: #78909C; padding: 40px; }
.mt-4 { margin-top: 16px; }

@media (max-width: 600px) {
  .history-header { flex-direction: column; align-items: flex-start; }
  .history-controls { width: 100%; }
  .event-toggle { width: 100%; }
  .event-toggle-top { width: 100%; }
  .toggle-btn { flex: 1; }
  .month-label { font-size: 9px; }
  .bar-wrapper { width: 10px; }
}
</style>