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

  // 1. Instantly exit if trying to load a year before they joined (0 reads)
  if (selectedYear.value < minYear.value) {
    fetchedYearAttendance.value = [];
    loading.value = false;
    return;
  }
  
  loading.value = true;
  const startStr = `${selectedYear.value}-01-01`;
  const endStr = `${selectedYear.value}-12-31`;
  
  // 2. Try the ultra-fast indexed query for NEW records
  let myYearData = await attendanceStore.fetchMyAttendanceByDateRange(myId.value, startStr, endStr);
  
  // 3. FALLBACK for OLD records (Missing 'memberId' field)
  if (myYearData.length === 0 && eventsStore.allEvents.length > 0) {
      
      // OPTIMIZATION: Filter events to ONLY the selected year, AND on or after their exact join date!
      const eventsThisYear = eventsStore.allEvents.filter(e => {
          const isThisYear = e.date.startsWith(selectedYear.value.toString());
          const isAfterJoined = joinedDateStr ? e.date >= joinedDateStr : true;
          return isThisYear && isAfterJoined;
      });
      
      if (eventsThisYear.length > 0) {
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
  }
  
  fetchedYearAttendance.value = myYearData;
  loading.value = false;
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

const myAttendanceRecords = computed(() => {
  // Since the fetched data is ALREADY filtered to just this member, we only need to match the event!
  return fetchedYearAttendance.value.filter(rec => {
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
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totalCount = computed(() => enrichedRecords.value.length)
const streak = computed(() => Math.min(totalCount.value, 5))
const isB1GMember = computed(() => authStore.userProfile?.finalTags?.ageCategory === 'B1G')
const wkndCount = computed(() => enrichedRecords.value.filter(r => r.eventType === 'service').length)
const b1gCount = computed(() => enrichedRecords.value.filter(r => r.eventType === 'b1g_event').length)

const monthlyStats = computed(() => {
  const map = {}
  
  // Ensure all 12 months exist so the X-axis is always full and structured
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  monthNames.forEach((m, idx) => {
    map[m] = { wknd: 0, b1g: 0, sortIdx: idx }
  })

  enrichedRecords.value.forEach(rec => {
    const d = new Date(rec.date)
    const month = d.toLocaleString('default', { month: 'short' })
    if (map[month]) {
      if (rec.eventType === 'service') map[month].wknd += 1
      else if (rec.eventType === 'b1g_event') map[month].b1g += 1
    }
  })

  return Object.entries(map)
    .map(([m, v]) => ({ month: m, wknd: v.wknd, b1g: v.b1g, total: v.wknd + v.b1g, sortIdx: v.sortIdx }))
    .sort((a, b) => a.sortIdx - b.sortIdx)
})

const monthlyMax = computed(() => {
  const arr = monthlyStats.value || []
  if (!arr.length) return 1
  const maxVal = Math.max(...arr.flatMap(s => [s.wknd, s.b1g]))
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
        <h2 class="year-label">{{ selectedYear }} Attendance</h2>
        <button @click="changeYear(1)" class="year-btn" :disabled="selectedYear >= new Date().getFullYear()"><ChevronRight :size="20" /></button>
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
        <div v-if="isB1GMember" class="stat-card red">
          <span class="label">B1G Services</span>
          <div class="value">{{ b1gCount }}</div>
        </div>
      </div>

      <section class="chart-section">
        <div class="chart-header">
          <h3>Monthly Overview</h3>
          
          <!-- Dynamic Legend -->
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-box wknd-color"></span> WKND
            </div>
            <div v-if="isB1GMember" class="legend-item">
              <span class="legend-box b1g-color"></span> B1G
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
                  
                  <!-- WKND Bar (Only show if > 0 to avoid messy 0s) -->
                  <div class="bar-wrapper" v-if="stat.wknd > 0">
                    <span class="bar-val">{{ stat.wknd }}</span>
                    <div class="bar-segment wknd" :style="{ height: `${(stat.wknd / monthlyMax) * 100}%` }"></div>
                  </div>
                  
                  <!-- B1G Bar (Only show for B1G members AND if > 0) -->
                  <div class="bar-wrapper" v-if="isB1GMember && stat.b1g > 0">
                    <span class="bar-val">{{ stat.b1g }}</span>
                    <div class="bar-segment b1g" :style="{ height: `${(stat.b1g / monthlyMax) * 100}%` }"></div>
                  </div>

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
      <h3>History Log ({{ selectedYear }})</h3>
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
          No attendance records found for this year.
        </div>
      </div>
      <div v-else class="loading-text">Loading records...</div>
    </section>

  </div>
</template>

<style scoped>
.attendance-view { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 900px) { .attendance-view { grid-template-columns: 1fr 1fr; align-items: start; } }
.stats-column { display: flex; flex-direction: column; gap: 24px; }
.year-selector { display: flex; align-items: center; justify-content: center; gap: 20px; background: white; padding: 12px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.year-btn { background: #F5F5F5; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #37474F; transition: background 0.2s; }
.year-btn:hover:not(:disabled) { background: #EEEEEE; }
.year-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.year-label { font-size: 18px; font-weight: 700; color: #37474F; margin: 0; }
.stats-row { display: flex; gap: 16px; }
.stat-card { flex: 1; padding: 24px; border-radius: 16px; color: white; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.stat-card.blue { background: linear-gradient(135deg, #42A5F5, #1565C0); }
.stat-card.red { background: linear-gradient(135deg, #f54242, #c01515); }
.stat-card.fire { background: linear-gradient(135deg, #FFCA28, #F57C00); }
.stat-card .label { font-size: 13px; font-weight: 600; opacity: 0.9; text-transform: uppercase; }
.stat-card .value { font-size: 36px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.fire-icon { fill: white; stroke: none; }
.chart-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

/* --- NEW STRUCTURED CHART STYLES --- */
.chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.chart-header h3 { margin: 0; font-size: 18px; color: #37474F; }

.chart-legend { display: flex; gap: 16px; align-items: center; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #546E7A; }
.legend-box { width: 12px; height: 12px; border-radius: 3px; }
.wknd-color { background: #1976D2; }
.b1g-color { background: #D32F2F; }

.custom-chart-container {
  display: flex;
  height: 240px;
  gap: 12px;
  padding-top: 10px;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 30px; /* Offset for month labels */
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
  background: transparent; /* bottom line is covered by border-bottom */
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
  height: calc(100% - 30px); /* Leave room for month label below axis */
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

.bar-segment.wknd { background: #1976D2; }
.bar-segment.b1g { background: #D32F2F; }

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

/* --- OTHER STYLES --- */
.event-tag { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 10px; margin-left: 8px; text-transform: uppercase; }
.event-tag.service-tag { background: #E3F2FD; color: #1565C0; }
.event-tag.b1g-tag { background: #FFEBEE; color: #D32F2F; }
.event-tag.ccf-tag { background: #FFF8E1; color: #F57C00; }
.history-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); height: 100%; max-height: 500px; overflow-y: auto; }
.history-section h3 { font-size: 18px; color: #37474F; margin-bottom: 16px; position: sticky; top: 0; background: white; padding-bottom: 10px; z-index: 1; }
.history-item { background: #FAFAFA; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; border: 1px solid #F5F5F5; }
.info { flex: 1; }
.info h4 { margin: 0; font-size: 16px; color: #263238; }
.info .date { font-size: 13px; color: #78909C; }
.badge-attended { background: #E8F5E9; color: #2E7D32; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
.empty-text { text-align: center; color: #B0BEC5; margin-top: 20px; }
.no-data-chart { color: #B0BEC5; font-size: 14px; width: 100%; text-align: center; }
.loading-text { text-align: center; color: #78909C; padding: 40px; }
.mt-4 { margin-top: 16px; }

@media (max-width: 600px) {
  .month-label { font-size: 9px; }
  .bar-wrapper { width: 10px; }
}
</style>