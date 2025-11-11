<template>
  <div class="pipeline-card">
    <div class="pipeline-header">
      <div>
        <h3>D-Group Pipeline & Capacity</h3>
        <p class="subtitle">Edge analytics: real-time funnel, capacity, and risk insights</p>
      </div>
      <div class="metrics-row">
        <div class="metric">
          <span class="metric-label">Endorsement Rate</span>
          <span class="metric-value">{{ (conversionRate * 100).toFixed(0) }}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Avg Weeks to Endorse</span>
          <span class="metric-value">{{ avgWeeksToConvert.toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <!-- Funnel -->
    <div class="section">
      <h4>Pipeline Funnel</h4>
      <div class="funnel">
        <div class="funnel-row">
          <div class="funnel-label">First Timers</div>
          <div class="funnel-bar">
            <div class="bar bar-yellow" :style="{ width: pct(firstTimers, maxFunnel) }"></div>
          </div>
          <div class="funnel-count">{{ firstTimers }}</div>
        </div>
        <div class="funnel-row">
          <div class="funnel-label">Seekers</div>
          <div class="funnel-bar">
            <div class="bar bar-blue" :style="{ width: pct(seekers, maxFunnel) }"></div>
          </div>
          <div class="funnel-count">{{ seekers }}</div>
        </div>
        <div class="funnel-row">
          <div class="funnel-label">Endorsed Members</div>
          <div class="funnel-bar">
            <div class="bar bar-green" :style="{ width: pct(membersCount, maxFunnel) }"></div>
          </div>
          <div class="funnel-count">{{ membersCount }}</div>
        </div>
      </div>
      <div class="funnel-inline">
        <div class="step">
          <span class="step-label">First Timers → Seekers</span>
          <span class="step-value">{{ rate(firstTimers, seekers) }}</span>
        </div>
        <div class="step">
          <span class="step-label">Seekers → Members</span>
          <span class="step-value">{{ rate(seekers, membersCount) }}</span>
        </div>
      </div>
    </div>

    <!-- Capacity -->
    <div class="section">
      <h4>D-Group Capacity</h4>
      <div class="capacity">
        <div class="capacity-top">
          <div class="capacity-progress">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: utilizationPct }"></div>
            </div>
            <div class="progress-labels">
              <span>{{ usedSlots }} used</span>
              <span>{{ totalCapacity }} total</span>
            </div>
          </div>
          <div class="capacity-metrics">
            <div class="metric">
              <span class="metric-label">Utilization</span>
              <span class="metric-value">{{ utilizationPct }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Leaders</span>
              <span class="metric-value">{{ leadersCount }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Est. Weeks Until Full</span>
              <span class="metric-value">{{ weeksUntilFullDisplay }}</span>
            </div>
          </div>
        </div>
        <p class="hint">Estimate assumes current seekers endorse at ~{{ (endorsementsPerWeek || 0).toFixed(1) }}/week.</p>
      </div>
    </div>

    <!-- Risk Table -->
    <div class="section">
      <h4>At-Risk Seekers (Need Follow-up)</h4>
      <p class="list-subtitle">Seekers active for longer than expected without endorsement.</p>
      <div v-if="atRiskSeekers.length > 0" class="table">
        <div class="table-header">
          <span>Name</span>
          <span>Weeks Active</span>
          <span>Last Attendance</span>
        </div>
        <div v-for="row in atRiskSeekers" :key="row.id" class="table-row">
          <span>{{ row.name }}</span>
          <span>{{ row.weeks }}</span>
          <span>{{ row.lastSeen }}</span>
        </div>
      </div>
      <p v-else class="no-data-text">No at-risk seekers right now. Keep the momentum!</p>
    </div>
  </div>
</template>

<script setup>
import { computed, watchEffect, ref } from 'vue'
import { DgroupGrowthForecaster } from '../../utils/forecasting'

const props = defineProps({
  members: { type: Array, required: true },
  attendance: { type: Array, required: true }
})

// Derive core sets
const leaders = computed(() => props.members.filter(m => m.finalTags?.isDgroupLeader))
const seekersList = computed(() => props.members.filter(m => m.finalTags?.isSeeker && !m.dgroupLeader))
const membersInDgroups = computed(() => props.members.filter(m => !!m.dgroupLeader))
const firstTimersCount = computed(() => props.members.filter(m => m.finalTags?.isFirstTimer).length)

// Conversion analytics (reuse existing analyzer)
const conversionRateRef = ref(0.25)
const avgWeeksRef = ref(4)

watchEffect(() => {
  const f = new DgroupGrowthForecaster()
  f.analyzeConversionPatterns(props.members, props.attendance)
  conversionRateRef.value = isFinite(f.conversionRate) ? f.conversionRate : 0.25
  avgWeeksRef.value = isFinite(f.avgTimeToConvert) && f.avgTimeToConvert > 0 ? f.avgTimeToConvert : 4
})

// Counts
const firstTimers = computed(() => firstTimersCount.value)
const seekers = computed(() => seekersList.value.length)
const membersCount = computed(() => membersInDgroups.value.length)
const leadersCount = computed(() => leaders.value.length)

// Funnel helpers
const maxFunnel = computed(() => Math.max(firstTimers.value, seekers.value, membersCount.value, 1))
const pct = (num, den) => `${Math.round((den ? (num / den) : 0) * 100)}%`
const rate = (from, to) => {
  if (!from) return '—'
  const r = Math.round((to / from) * 100)
  return `${isFinite(r) ? r : 0}%`
}

// Capacity
const totalCapacity = computed(() => leaders.value.reduce((sum, l) => sum + (l.dgroupCapacity || 8), 0))
const usedSlots = computed(() => membersCount.value)
const utilizationPct = computed(() => pct(usedSlots.value, Math.max(totalCapacity.value, 1)))

// Simple endorsement throughput estimate
const conversionRate = computed(() => conversionRateRef.value)
const avgWeeksToConvert = computed(() => avgWeeksRef.value)
const endorsementsPerWeek = computed(() => {
  if (seekers.value <= 0 || avgWeeksToConvert.value <= 0 || conversionRate.value <= 0) return 0
  // Approx: portion of seekers converting per week based on rate and avg time
  const weekly = (seekers.value * conversionRate.value) / avgWeeksToConvert.value
  return Math.max(0, weekly)
})

const weeksUntilFull = computed(() => {
  const remaining = Math.max(totalCapacity.value - usedSlots.value, 0)
  const weekly = endorsementsPerWeek.value
  if (weekly <= 0) return null
  const weeks = remaining / weekly
  return Number.isFinite(weeks) ? Math.ceil(weeks) : null
})

const weeksUntilFullDisplay = computed(() => weeksUntilFull.value == null ? '—' : `${weeksUntilFull.value}`)

// Risk: seekers beyond expected endorsement time
function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

const atRiskSeekers = computed(() => {
  const threshold = Math.ceil(avgWeeksToConvert.value * 1.25)
  const rows = []
  for (const m of seekersList.value) {
    const records = props.attendance.filter(a => a.memberId === m.id)
    const weeks = records.length
    if (weeks >= threshold) {
      const last = records.length > 0 ? records.reduce((max, r) => {
        const dt = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp)
        return dt > max ? dt : max
      }, new Date(0)) : null
      rows.push({
        id: m.id,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        weeks,
        lastSeen: last ? last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
      })
    }
  }
  return rows.sort((a, b) => b.weeks - a.weeks).slice(0, 8)
})
</script>

<style scoped>
.pipeline-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  border: 1px solid #e0e0e0;
}
.pipeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}
.pipeline-header h3 { margin: 0; font-size: 20px; font-weight: 800; }
.subtitle { margin: 4px 0 0 0; color: #607D8B; font-size: 13px; }
.metrics-row { display: flex; gap: 16px; }
.metric { background: #F5F5F5; border-radius: 10px; padding: 10px 12px; min-width: 140px; text-align: center; }
.metric-label { display: block; font-size: 11px; color: #78909C; text-transform: uppercase; font-weight: 600; letter-spacing: .4px; }
.metric-value { display: block; font-size: 20px; font-weight: 800; color: #0D47A1; }

.section { margin-top: 16px; }
.section h4 { margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #37474F; }

/* Funnel */
.funnel { display: flex; flex-direction: column; gap: 10px; }
.funnel-row { display: grid; grid-template-columns: 140px 1fr 70px; align-items: center; gap: 12px; }
.funnel-label { font-size: 13px; color: #546E7A; font-weight: 600; }
.funnel-bar { background: #ECEFF1; border-radius: 999px; overflow: hidden; height: 14px; }
.bar { height: 100%; border-radius: 999px; }
.bar-yellow { background: #FFCA28; }
.bar-blue { background: #42A5F5; }
.bar-green { background: #66BB6A; }
.funnel-count { text-align: right; font-weight: 700; color: #263238; }
.funnel-inline { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
.step { background: #FAFAFA; border: 1px solid #EEE; border-radius: 8px; padding: 8px 12px; }
.step-label { font-size: 12px; color: #607D8B; margin-right: 8px; }
.step-value { font-weight: 800; color: #0D47A1; }

/* Capacity */
.capacity-top { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; }
.progress-track { width: 100%; height: 16px; background: #ECEFF1; border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #42A5F5, #0D47A1); }
.progress-labels { display: flex; justify-content: space-between; margin-top: 6px; color: #546E7A; font-size: 12px; }
.capacity-metrics { display: flex; gap: 16px; }
.hint { color: #90A4AE; font-size: 12px; margin-top: 8px; }

/* Risk Table */
.table { border: 1px solid #ECEFF1; border-radius: 12px; overflow: hidden; }
.table-header, .table-row { display: grid; grid-template-columns: 2fr 1fr 1.2fr; gap: 12px; padding: 12px; }
.table-header { background: #F5F5F5; font-weight: 700; color: #455A64; font-size: 13px; }
.table-row { border-top: 1px solid #F0F0F0; font-size: 14px; color: #37474F; }
.no-data-text { text-align: center; padding: 16px; color: #90A4AE; }

@media (max-width: 700px) {
  .metrics-row { flex-direction: column; width: 160px; }
  .capacity-top { grid-template-columns: 1fr; }
  .table-header, .table-row { grid-template-columns: 1.5fr .8fr 1fr; font-size: 13px; }
}
</style>
