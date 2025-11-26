<script setup>
import BarChart from './charts/BarChart.vue'
import DoughnutChart from './charts/DoughnutChart.vue'
import ExportButton from './ExportButton.vue'
import { ref, computed, onMounted } from 'vue'
import { useEventsStore } from '../stores/events'

import { useAttendanceStore } from '../stores/attendance'
import { useMembersStore } from '../stores/members'

const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()
const membersStore = useMembersStore()

// selection mode
const mode = ref('events') // 'events' or 'months'

// selection sets
const baseIds = ref([])       // selected base event ids (can be multiple)
const compareIds = ref([])    // selected comparison event ids (can be multiple)
const baseMonth = ref('')     // YYYY-MM (month mode)
const compareMonth = ref('')  // YYYY-MM (month mode)

function removeBaseId(id) {
  baseIds.value = (baseIds.value || []).filter(x => x !== id)
}

function removeCompareId(id) {
  compareIds.value = (compareIds.value || []).filter(x => x !== id)
}
    

// load on mount
onMounted(() => {
  eventsStore.fetchEvents?.()
  attendanceStore.fetchAllAttendance?.()
  membersStore.fetchMembers?.()
  // Auto-select recent events when the component mounts and nothing is selected
  if (mode.value === 'events' && (!baseIds.value.length && !compareIds.value.length)) {
    selectRecentForQuickStart()
  }
})

// build event options
const sortedEvents = computed(() => (eventsStore.allEvents || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date)))
const eventOptions = computed(() => sortedEvents.value.map(e => ({ id: e.id, label: `${e.name} — ${e.date}`, raw: e })))

// helper: pick events that match a month string YYYY-MM
function eventsInMonth(yyyymm) {
  if (!yyyymm) return []
  return (eventsStore.allEvents || []).filter(e => e.date && e.date.startsWith(yyyymm))
}

// helpers: attendance / member helpers (copied/adapted from your earlier logic)
function attendeesForEvent(event) {
  if (!event) return []
  const allAttendance = attendanceStore.allAttendance || []
  const allMembers = membersStore.members || []
  const records = allAttendance.filter(a => a.eventId === event.id)
  return records.map(r => ({ record: r, member: allMembers.find(m => m.id === r.memberId) || null }))
}

function countFirstTimers(attendees) {
  if (!Array.isArray(attendees)) return 0
  return attendees.filter(a => a.member && a.member.finalTags?.isFirstTimer).length
}
function countReturning(attendees) {
  if (!Array.isArray(attendees)) return 0
  return attendees.filter(a => a.member && !a.member.finalTags?.isFirstTimer).length
}

function attendanceRate(attendees) {
  const denom = Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 1)
  if (!denom || denom === 0) return 0
  return Math.round((Array.isArray(attendees) ? attendees.length : 0) / denom * 100)
}

function demographicsForEvent(event) {
  const attendees = attendeesForEvent(event)
  const males = attendees.filter(a => a.member && a.member.gender === 'Male').length
  const females = attendees.filter(a => a.member && a.member.gender === 'Female').length
  // age groups
  const ageElevate = attendees.filter(a => a.member && a.member.finalTags?.ageCategory === 'Elevate').length
  const ageB1G = attendees.filter(a => a.member && a.member.finalTags?.ageCategory === 'B1G').length
  return { males, females, ageElevate, ageB1G }
}

// compute aggregates for a list of event objects
function aggregateEvents(eventsArr) {
  const n = (eventsArr || []).length
  if (!n) return {
    totalAttendance: 0, avgAttendance: 0, avgParticipation: 0,
    avgFirstTimers: 0, avgReturning: 0,
    avgVolunteers: 0,
    demographics: { males: 0, females: 0, ageElevate: 0, ageB1G: 0 },
    ids: []
  }

  let totalAttendance = 0
  let totalParticipation = 0
  let totalFirstTimers = 0
  let totalReturning = 0
  let totalVolunteers = 0
  const demographicsSum = { males: 0, females: 0, ageElevate: 0, ageB1G: 0 }

  eventsArr.forEach(ev => {
    const attendees = attendeesForEvent(ev)
    const tn = attendees.length
    totalAttendance += tn
    totalParticipation += attendanceRate(attendees)
    const ft = countFirstTimers(attendees)
    const ret = countReturning(attendees)
    totalFirstTimers += ft
    totalReturning += ret
    totalVolunteers += attendees.filter(a => a.member && a.member.finalTags?.isVolunteer).length

    const d = demographicsForEvent(ev)
    demographicsSum.males += d.males
    demographicsSum.females += d.females
    demographicsSum.ageElevate += d.ageElevate
    demographicsSum.ageB1G += d.ageB1G
  })

  return {
    totalAttendance,
    avgAttendance: Math.round(totalAttendance / n),
    avgParticipation: Math.round(totalParticipation / n),
    avgFirstTimers: Math.round(totalFirstTimers / n),
    avgReturning: Math.round(totalReturning / n),
    avgVolunteers: Math.round(totalVolunteers / n),
    demographics: {
      males: Math.round(demographicsSum.males / n),
      females: Math.round(demographicsSum.females / n),
      ageElevate: Math.round(demographicsSum.ageElevate / n),
      ageB1G: Math.round(demographicsSum.ageB1G / n)
    },
    ids: eventsArr.map(e => e.id)
  }
}

// derive selected event lists depending on mode
const baseEventsSelected = computed(() => {
  if (mode.value === 'months') {
    return baseMonth.value ? eventsInMonth(baseMonth.value) : []
  } else {
    return (baseIds.value || []).map(id => eventsStore.allEvents.find(e => e.id === id)).filter(Boolean)
  }
})

const compareEventsSelected = computed(() => {
  if (mode.value === 'months') {
    return compareMonth.value ? eventsInMonth(compareMonth.value) : []
  } else {
    return (compareIds.value || []).map(id => eventsStore.allEvents.find(e => e.id === id)).filter(Boolean)
  }
})

// aggregated summaries
const baseSummary = computed(() => aggregateEvents(baseEventsSelected.value))
const compareSummary = computed(() => aggregateEvents(compareEventsSelected.value))

// chart datasets (we show both per-event bars and group averages)
const comparisonList = computed(() => {
  // combine unique events from both sides for per-event charts
  const arr = []
  const pushIf = (e) => { if (e && !arr.find(x => x.id === e.id)) arr.push(e) }
  baseEventsSelected.value.forEach(pushIf)
  compareEventsSelected.value.forEach(pushIf)
  return arr
})

// Attendance per-event bar (per-event counts) or averages when many events selected
const attendanceChartData = computed(() => {
  // normalize attendance to percentage of active members, but keep raw counts available
  const denom = Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 1)
  if (showAverages.value) {
    const labels = ['Group A (avg)', 'Group B (avg)']
    const raw = [baseSummary.value.avgAttendance || 0, compareSummary.value.avgAttendance || 0]
    const data = raw.map(r => denom ? Math.round((r / denom) * 100) : 0)
    const bg = ['#1976D2', '#C62828']
    return { labels, datasets: [{ label: 'Avg attendance %', backgroundColor: bg, data, raw }] }
  }
  const labels = comparisonList.value.map(e => `${e.name} (${e.date})`)
  const raw = comparisonList.value.map(e => attendeesForEvent(e).length)
  const data = raw.map(r => denom ? Math.round((r / denom) * 100) : 0)
  // highlight base events vs compare events
  const bg = comparisonList.value.map(e => baseEventsSelected.value.find(x => x.id === e.id) ? '#1976D2' : '#90A4AE')
  return { labels, datasets: [{ label: 'Attendance %', backgroundColor: bg, data, raw }] }
})

// Participation % chart (per-event) or averages when many events selected
const participationChartData = computed(() => {
  // participation is already a percent; attach raw attendance counts for datalabels
  if (showAverages.value) {
    const labels = ['Group A (avg)', 'Group B (avg)']
    const rawCounts = [baseSummary.value.avgAttendance || 0, compareSummary.value.avgAttendance || 0]
    const data = [baseSummary.value.avgParticipation || 0, compareSummary.value.avgParticipation || 0]
    const bg = ['#43A047', '#1E88E5']
    return { labels, datasets: [{ label: 'Avg participation %', backgroundColor: bg, data, raw: rawCounts }] }
  }
  const labels = comparisonList.value.map(e => `${e.name} (${e.date})`)
  const rawCounts = comparisonList.value.map(e => attendeesForEvent(e).length)
  const data = comparisonList.value.map(e => attendanceRate(attendeesForEvent(e)))
  const bg = comparisonList.value.map(e => baseEventsSelected.value.find(x => x.id === e.id) ? '#43A047' : '#1E88E5')
  return { labels, datasets: [{ label: 'Participation %', backgroundColor: bg, data, raw: rawCounts }] }
})

// trend data (attendance across events in selected sets)
const trendChartData = computed(() => {
  // simple line-like bar of averages: two bars (base avg vs compare avg) plus per-event points
  const labels = []
  const datasets = []

  // normalize each per-event attendance to % of active members and attach raw counts
  const denom = Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 1)
  if (comparisonList.value.length) {
    labels.push(...comparisonList.value.map(e => `${e.name} (${e.date})`))
    const raw = comparisonList.value.map(e => attendeesForEvent(e).length)
    const data = raw.map(r => denom ? Math.round((r / denom) * 100) : 0)
    datasets.push({
      label: 'Attendance % (per event)',
      data,
      raw,
      backgroundColor: comparisonList.value.map(e => baseEventsSelected.value.find(x => x.id === e.id) ? '#FFC107' : '#90A4AE')
    })
  }

  // group averages as separate datasets (percent)
  if (baseEventsSelected.value.length) {
    const rawA = baseSummary.value.avgAttendance
    const pctA = denom ? Math.round((rawA / denom) * 100) : 0
    datasets.push({ label: `Group A avg (${baseEventsSelected.value.length})`, data: comparisonList.value.map(() => pctA), raw: comparisonList.value.map(() => rawA), backgroundColor: '#C62828' })
  }
  if (compareEventsSelected.value.length) {
    const rawB = compareSummary.value.avgAttendance
    const pctB = denom ? Math.round((rawB / denom) * 100) : 0
    datasets.push({ label: `Group B avg (${compareEventsSelected.value.length})`, data: comparisonList.value.map(() => pctB), raw: comparisonList.value.map(() => rawB), backgroundColor: '#1976D2' })
  }

  return { labels, datasets }
})

// demographics doughnut comparing base avg vs compare avg (males vs females)
const demographicsDoughnutData = computed(() => {
  // show two pairs stacked: base males/females averaged vs compare males/females averaged
  const labels = []
  const datasets = []
  // if both present show side-by-side
  if (baseEventsSelected.value.length) {
    labels.push('Group A - Males', 'Group A - Females')
  }
  if (compareEventsSelected.value.length) {
    labels.push('Group B - Males', 'Group B - Females')
  }
  const data = []
  if (baseEventsSelected.value.length) {
    data.push(baseSummary.value.demographics.males, baseSummary.value.demographics.females)
  }
  if (compareEventsSelected.value.length) {
    data.push(compareSummary.value.demographics.males, compareSummary.value.demographics.females)
  }
  const colors = []
  if (baseEventsSelected.value.length) {
    colors.push('#0D47A1', '#42A5F5')
  }
  if (compareEventsSelected.value.length) {
    colors.push('#C62828', '#FF8A65')
  }
  return { labels, datasets: [{ data, backgroundColor: colors }] }
})

// demographics comparison as grouped bar (Males, Females, Elevate, B1G)
const demographicsBarData = computed(() => {
  const labels = ['Males', 'Females', 'Elevate', 'B1G']
  const a = baseSummary.value.demographics || { males:0, females:0, ageElevate:0, ageB1G:0 }
  const b = compareSummary.value.demographics || { males:0, females:0, ageElevate:0, ageB1G:0 }

  // compute percentages: gender percentages relative to gender total, age percentages relative to age total
  const aGenderTotal = (a.males||0) + (a.females||0)
  const bGenderTotal = (b.males||0) + (b.females||0)
  const aAgeTotal = (a.ageElevate||0) + (a.ageB1G||0)
  const bAgeTotal = (b.ageElevate||0) + (b.ageB1G||0)

  const aM = aGenderTotal ? Math.round((a.males||0) / aGenderTotal * 100) : 0
  const aF = aGenderTotal ? Math.round((a.females||0) / aGenderTotal * 100) : 0
  const aE = aAgeTotal ? Math.round((a.ageElevate||0) / aAgeTotal * 100) : 0
  const aB = aAgeTotal ? Math.round((a.ageB1G||0) / aAgeTotal * 100) : 0

  const bM = bGenderTotal ? Math.round((b.males||0) / bGenderTotal * 100) : 0
  const bF = bGenderTotal ? Math.round((b.females||0) / bGenderTotal * 100) : 0
  const bE = bAgeTotal ? Math.round((b.ageElevate||0) / bAgeTotal * 100) : 0
  const bB = bAgeTotal ? Math.round((b.ageB1G||0) / bAgeTotal * 100) : 0

  // category colors: male/female (blue shades), elevate/pipeline (purple/orange)
  const categoryColors = ['#1E88E5', '#42A5F5', '#8E24AA', '#FB8C00']
  // also include raw counts for tooltips/datalabels
  const aRaw = [a.males || 0, a.females || 0, a.ageElevate || 0, a.ageB1G || 0]
  const bRaw = [b.males || 0, b.females || 0, b.ageElevate || 0, b.ageB1G || 0]
  // prepare totals per index so tooltips can show "x out of total"
  const aTotals = [aGenderTotal, aGenderTotal, aAgeTotal, aAgeTotal]
  const bTotals = [bGenderTotal, bGenderTotal, bAgeTotal, bAgeTotal]

  return {
    labels,
    datasets: [
      { label: eventALabelShort.value, data: [aM, aF, aE, aB], raw: aRaw, rawTotals: aTotals, backgroundColor: ['#1E88E5', '#42A5F5', '#8E24AA', '#FB8C00'] },
      { label: eventBDisplayShort.value, data: [bM, bF, bE, bB], raw: bRaw, rawTotals: bTotals, backgroundColor: ['#C62828', '#FF8A65', '#6A1B9A', '#F57C00'] }
    ]
  }
})

// member category distribution for selected groups (Regulars, Dgroup Leaders, First Timers)
function categoryCountsForEvents(eventsArr) {
  const membersSeen = new Map()
  ;(eventsArr || []).forEach(ev => {
    attendeesForEvent(ev).forEach(a => {
      const m = a.member
      if (!m || !m.id) return
      if (!membersSeen.has(m.id)) membersSeen.set(m.id, m)
    })
  })
  const list = Array.from(membersSeen.values())
  const regulars = list.filter(m => m.finalTags?.isRegular).length
  const leaders = list.filter(m => m.finalTags?.isDgroupLeader).length
  const firstTimers = list.filter(m => m.finalTags?.isFirstTimer).length
  const volunteers = list.filter(m => m.finalTags?.isVolunteer).length
  return { regulars, leaders, firstTimers, volunteers, total: list.length }
}

const baseCategoryData = computed(() => {
  const counts = categoryCountsForEvents(baseEventsSelected.value)
  const labels = ['Regulars', 'Dgroup Leaders', 'First Timers']
  return { labels, datasets: [{ data: [counts.regulars, counts.leaders, counts.firstTimers], backgroundColor: ['#1976D2', '#42A5F5', '#FFCA28'], raw: [counts.regulars, counts.leaders, counts.firstTimers] }] }
})

const compareCategoryData = computed(() => {
  const counts = categoryCountsForEvents(compareEventsSelected.value)
  const labels = ['Regulars', 'Dgroup Leaders', 'First Timers']
  return { labels, datasets: [{ data: [counts.regulars, counts.leaders, counts.firstTimers], backgroundColor: ['#C62828', '#FF8A65', '#FFCA28'], raw: [counts.regulars, counts.leaders, counts.firstTimers] }] }
})

// computed rows for member category comparison table including volunteers
const memberCategoryComparison = computed(() => {
  const a = categoryCountsForEvents(baseEventsSelected.value)
  const b = categoryCountsForEvents(compareEventsSelected.value)
  const rows = ['Regulars', 'Dgroup Leaders', 'First Timers', 'Volunteers']
  return rows.map((label) => {
    const key = label === 'Regulars' ? 'regulars' : (label === 'Dgroup Leaders' ? 'leaders' : (label === 'First Timers' ? 'firstTimers' : 'volunteers'))
    const aCount = a[key] || 0
    const bCount = b[key] || 0
    const aPct = a.total ? Math.round((aCount / a.total) * 100) : 0
    const bPct = b.total ? Math.round((bCount / b.total) * 100) : 0
    const deltaPct = pctChange(aCount, bCount)
    const deltaAbs = aCount - bCount
    return { label, aCount, aPct, bCount, bPct, deltaPct, deltaAbs }
  })
})

// doughnut options factory (shows "x out of total (y%)")
function doughnutOptionsFactory() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: { color: '#fff', font: { weight: '700' } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw[ctx.dataIndex] : ctx.parsed || ctx.raw || 0
            const total = ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw.reduce((s, x) => s + (x || 0), 0) : 0
            const pct = total ? Math.round((raw / total) * 100) : 0
            return `${raw} out of ${total} (${pct}%)`
          }
        }
      }
    }
  }
}

// common chart options for percent-normalized bars
const percentDatalabels = {
  labels: {
    percent: {
      anchor: 'end',
      align: 'end',
      color: '#0F172A',
      font: { weight: '700' },
      formatter: (v) => `${v}%`
    },
    raw: {
      anchor: 'center',
      align: 'center',
      color: '#FFFFFF',
      font: { weight: '700' },
      formatter: (v, ctx) => { return ctx.dataset && ctx.dataset.raw ? (ctx.dataset.raw[ctx.dataIndex] ?? v) : v }
    }
  }
}

const attendanceOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    datalabels: percentDatalabels,
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const raw = ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw[ctx.dataIndex] : (ctx.parsed && ctx.parsed.y) || 0
          const denom = Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 1)
          return `${raw} out of ${denom} (${ctx.parsed.y}%)`
        }
      }
    }
  },
  scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } }
}))

const participationOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    datalabels: percentDatalabels,
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const raw = ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw[ctx.dataIndex] : (ctx.parsed && ctx.parsed.y) || 0
          const denom = Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 1)
          return `${raw} out of ${denom} (${ctx.parsed.y}%)`
        }
      }
    }
  },
  scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } }
}))

const demographicsOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    datalabels: percentDatalabels,
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const raw = ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw[ctx.dataIndex] : (ctx.parsed && ctx.parsed.y) || 0
          const total = ctx.dataset && ctx.dataset.rawTotals ? (ctx.dataset.rawTotals[ctx.dataIndex] || ctx.dataset.rawTotals.reduce((s,t)=>s+(t||0),0)) : (ctx.dataset && ctx.dataset.raw ? ctx.dataset.raw.reduce((s,x)=>s+(x||0),0) : 0)
          return `${raw} out of ${total} (${ctx.parsed.y}%)`
        }
      }
    }
  },
  scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } }
}))

// UI helpers
const needSelectionWarning = computed(() => {
  const hasBase = (mode.value === 'months' ? !!baseMonth.value : baseIds.value.length > 0)
  const hasCompare = (mode.value === 'months' ? !!compareMonth.value : compareIds.value.length > 0)
  return !(hasBase && hasCompare)
})

// UI: when many events selected, default to showing averages with an option to expand details
const showDetails = ref(false)
// show averages when three or more events are selected unless user expanded details
const showAverages = computed(() => comparisonList.value.length >= 3 && !showDetails.value)

// quick-select active state (used to mark the Default quick-action as active)
const defaultActive = ref(false)

function pctDiff(a, b) {
  if (!b) return 'n/a'
  const diff = a - b
  const pct = Math.round((diff / (b || 1)) * 100)
  return `${Math.abs(pct)}% ${diff >= 0 ? 'higher' : 'lower'}`
}

// percent change helper (returns integer percent or null if cannot compute)
function pctChange(a, b) {
  if (b === 0 || b === null || b === undefined) return null
  const diff = a - b
  return Math.round((diff / (b || 1)) * 100)
}

// human-friendly labels for display: mention name+date when exactly one event selected
const eventALabelShort = computed(() => {
  const evs = baseEventsSelected.value || []
  if (mode.value === 'months') return baseMonth.value ? `Group A (${baseMonth.value})` : 'Group A'
  if (evs.length === 1) return `${evs[0].name} (${evs[0].date})`
  return 'Group A'
})

const eventBLabelShort = computed(() => {
  const evs = compareEventsSelected.value || []
  if (mode.value === 'months') return compareMonth.value ? `Group B (${compareMonth.value})` : 'Group B'
  if (evs.length === 1) return `${evs[0].name} (${evs[0].date})`
  return 'Group B'
})

// When the default quick-select is active we want to explicitly show the
// names/dates of the chosen comparison events instead of the generic
// 'Previous 3 groups' text. `eventBDisplayShort` yields that explicit
// string (or falls back to the existing short label).
const eventBDisplayShort = computed(() => {
  const evs = compareEventsSelected.value || []
  // When the default quick-select is active and averages are shown,
  // prefer the concise label instead of enumerating every event.
  if (defaultActive.value && showAverages.value) {
    return 'Previous 3 events'
  }
  if (defaultActive.value) {
    if (!evs.length) return 'Previous 3 events'
    return evs.map(e => `${e.name} (${e.date})`).join(', ')
  }
  return eventBLabelShort.value
})

const eventAStatLabel = computed(() => {
  const evs = baseEventsSelected.value || []
  if (mode.value === 'months') return baseMonth.value ? `Group A (${baseMonth.value})` : 'Group A (avg)'
  if (evs.length === 1) return `${evs[0].name} (${evs[0].date})`
  return 'Group A (avg)'
})

const eventBStatLabel = computed(() => {
  const evs = compareEventsSelected.value || []
  if (mode.value === 'months') return compareMonth.value ? `Group B (${compareMonth.value})` : 'Group B (avg)'
  if (evs.length === 1) return `${evs[0].name} (${evs[0].date})`
  return 'Group B (avg)'
})

// interpretation labels: when default quick-select is active show 'Recent Event' / 'Previous 3 Events'
const eventALabelInterp = computed(() => {
  // When default quick-select is active, show the actual selected event name+date
  // instead of the generic 'most recent event' label so cards read the event explicitly.
  return eventALabelShort.value
})

const eventBLabelInterp = computed(() => {
  if (defaultActive.value && compareEventsSelected.value && compareEventsSelected.value.length) return eventBDisplayShort.value
  return eventBLabelShort.value
})

const attendanceInterpretation = computed(() => {
  if (showAverages.value) {
    const a = baseSummary.value.avgAttendance || 0
    const c = compareSummary.value.avgAttendance || 0
    if (a === c) return `${eventALabelInterp.value} and ${eventBLabelInterp.value} have the same average attendance (${a} attendees).`
    const rel = pctDiff(a, c)
    return `The ${eventALabelInterp.value} has an average attendance of ${a} attendees; the ${eventBLabelInterp.value} have an average attendance of ${c} attendees. ${eventALabelInterp.value} is ${rel} compared with ${eventBLabelInterp.value}.`
  }
  // detailed: find top and bottom event
  const arr = comparisonList.value.map(e => ({ e, n: attendeesForEvent(e).length }))
  if (!arr.length) return 'No events to interpret.'
  arr.sort((x,y) => y.n - x.n)
  const top = arr[0]
  const bottom = arr[arr.length-1]
  if (top.e.id === bottom.e.id) return `Only one event selected: ${top.e.name} (${top.e.date}) with ${top.n} attendees.`
  return `Top event: ${top.e.name} (${top.e.date}) with ${top.n} attendees. Lowest event: ${bottom.e.name} (${bottom.e.date}) with ${bottom.n} attendees.`
})

const participationInterpretation = computed(() => {
  if (showAverages.value) {
    const a = baseSummary.value.avgParticipation || 0
    const c = compareSummary.value.avgParticipation || 0
    const rel = pctDiff(a, c)
    return `The ${eventALabelInterp.value} participation is ${a}%, while the ${eventBLabelInterp.value} participation is ${c}%. The ${eventALabelInterp.value} is ${rel} compared to the ${eventBLabelInterp.value}.`
  }
  const arr = comparisonList.value.map(e => ({ e, p: attendanceRate(attendeesForEvent(e)) }))
  if (!arr.length) return 'No events to interpret.'
  arr.sort((x,y) => y.p - x.p)
  return `Highest participation: ${arr[0].e.name} (${arr[0].p}%). Lowest participation: ${arr[arr.length-1].e.name} (${arr[arr.length-1].p}%).`
})

const trendInterpretation = computed(() => {
  const counts = comparisonList.value.map(e => attendeesForEvent(e).length)
  if (!counts.length) return 'No trend available.'
  if (counts.length === 1) return `Single event: ${comparisonList.value[0].name} with ${counts[0]} attendees.`
  const first = counts[0]
  const last = counts[counts.length-1]
  const dir = last > first ? 'increasing' : (last < first ? 'decreasing' : 'flat')
  return `Attendance trend across selected events appears ${dir} (first ${first} → last ${last}).`
})

const demographicsInterpretation = computed(() => {
  const b = baseSummary.value.demographics
  const c = compareSummary.value.demographics
  if (!b || !c) return 'No demographics to interpret.'
  const bTotal = (b.males||0) + (b.females||0)
  const cTotal = (c.males||0) + (c.females||0)
  if (!bTotal && !cTotal) return 'No demographic attendees recorded.'
  const bM = bTotal ? Math.round((b.males||0)/bTotal*100) : 0
  const cM = cTotal ? Math.round((c.males||0)/cTotal*100) : 0
  return `${eventALabelInterp.value} is ${bM}% male, while ${eventBLabelInterp.value} is ${cM}% male. Use these figures to spot demographic shifts.`
})

// computed percent-change deltas for averages (Group A relative to Group B)
const baseAvgAttendanceDelta = computed(() => pctChange(baseSummary.value.avgAttendance || 0, compareSummary.value.avgAttendance || 0))
const baseAvgParticipationDelta = computed(() => pctChange(baseSummary.value.avgParticipation || 0, compareSummary.value.avgParticipation || 0))
const baseAvgFirstTimersDelta = computed(() => pctChange(baseSummary.value.avgFirstTimers || 0, compareSummary.value.avgFirstTimers || 0))
const baseAvgReturningDelta = computed(() => pctChange(baseSummary.value.avgReturning || 0, compareSummary.value.avgReturning || 0))
const baseAvgVolunteersDelta = computed(() => pctChange(baseSummary.value.avgVolunteers || 0, compareSummary.value.avgVolunteers || 0))

// absolute differences for averages (A - B)
const baseAvgAttendanceAbs = computed(() => (baseSummary.value.avgAttendance || 0) - (compareSummary.value.avgAttendance || 0))
const baseAvgFirstTimersAbs = computed(() => (baseSummary.value.avgFirstTimers || 0) - (compareSummary.value.avgFirstTimers || 0))
const baseAvgReturningAbs = computed(() => (baseSummary.value.avgReturning || 0) - (compareSummary.value.avgReturning || 0))
const baseAvgVolunteersAbs = computed(() => (baseSummary.value.avgVolunteers || 0) - (compareSummary.value.avgVolunteers || 0))

const firstTimerInterpretation = computed(() => {
  const a = baseSummary.value.avgFirstTimers || 0
  const c = compareSummary.value.avgFirstTimers || 0
  const rel = pctDiff(a, c)
  return `${eventALabelInterp.value} average first-timers: ${a}; ${eventBLabelInterp.value} average first-timers: ${c}. ${eventALabelInterp.value} is ${rel} compared with ${eventBLabelInterp.value}.`
})

const returningInterpretation = computed(() => {
  const a = baseSummary.value.avgReturning || 0
  const c = compareSummary.value.avgReturning || 0
  const rel = pctDiff(a, c)
  return `${eventALabelInterp.value} average returning attendees: ${a}; ${eventBLabelInterp.value} average returning attendees: ${c}. ${eventALabelInterp.value} is ${rel} compared with ${eventBLabelInterp.value}.`
})

// structured export payload for the ExportButton to use (includes chart raw numbers)
const exportPageData = computed(() => {
  const cards = []

  // Attendance totals card
  cards.push({
    title: 'Attendance totals (per event)',
    desc: 'Shows total attendance for the selected events (or averaged values when many events are selected).',
    tableHeaders: ['Label', 'Value'],
    tableRows: [
      [eventAStatLabel.value, String(baseSummary.value.avgAttendance || 0)],
      [defaultActive.value ? 'Previous 3 events' : eventBStatLabel.value, String(compareSummary.value.avgAttendance || 0)]
    ],
    charts: [{ title: attendanceChartData.value.datasets?.[0]?.label || 'Attendance', datasets: attendanceChartData.value.datasets || [], labels: attendanceChartData.value.labels || [], raw: attendanceChartData.value.datasets?.[0]?.raw || [] }],
    interpretation: attendanceInterpretation.value
  })

  // Add a summary card with the event dates for Group A and Group B
  // For the exported payload we prefer explicit event names/dates.
  // UI may still show the concise 'Previous 3 events', but exports should list actual events
  const formatEventsListForExport = (list, groupLabel = 'Group') => {
    if (!list || !list.length) return 'none'
    // If there are many events, give a short group label and show first few
    if (list.length > 6) {
      const first = list.slice(0, 5).map(e => `${e.name} (${e.date})`).join(' | ')
      return `${groupLabel} (${list.length} events) — first 5: ${first}`
    }
    return list.map(e => `${e.name} (${e.date})`).join(' | ')
  }
  cards.unshift({
    title: 'Comparison summary',
    desc: 'Events included in Group A and Group B',
    tableHeaders: ['Group', 'Events (name and date)'],
    tableRows: [[ 'Group A', formatEventsListForExport(baseEventsSelected.value, 'Group A') ], [ 'Group B', formatEventsListForExport(compareEventsSelected.value, 'Group B') ]]
  })

  // Participation card
  cards.push({
    title: 'Participation % (per event)',
    desc: 'Shows percentage of active members who attended each event (or group averages).',
    charts: [{ title: participationChartData.value.datasets?.[0]?.label || 'Participation', datasets: participationChartData.value.datasets || [], labels: participationChartData.value.labels || [], raw: participationChartData.value.datasets?.[0]?.raw || [] }],
    interpretation: participationInterpretation.value
  })

  // Member Distribution (doughnuts)
  cards.push({
    title: 'Member Distribution',
    desc: 'Distribution of attendee categories for Group A and Group B (Regulars, Dgroup Leaders, First Timers).',
    charts: [
      { title: eventALabelShort.value, datasets: baseCategoryData.value.datasets || [], labels: baseCategoryData.value.labels || [], raw: baseCategoryData.value.datasets?.[0]?.raw || [] },
      { title: defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value, datasets: compareCategoryData.value.datasets || [], labels: compareCategoryData.value.labels || [], raw: compareCategoryData.value.datasets?.[0]?.raw || [] }
    ],
    interpretation: memberDistributionInterpretation.value
  })

  // Member Category Distribution table
  cards.push({
    title: 'Member Category Distribution',
    desc: 'Counts and percentages of member categories for Group A and Group B.',
    tableHeaders: ['Category', eventALabelShort.value + ' (raw)', eventALabelShort.value + ' (%)', (defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value) + ' (raw)', (defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value) + ' (%)'],
    tableRows: memberCategoryComparison.value.map(r => [r.label, String(r.aCount), String(r.aPct), String(r.bCount), String(r.bPct)]),
    interpretation: memberCategoryInterpretation.value
  })

  // Demographics
  cards.push({
    title: 'Demographics comparison',
    desc: 'Comparison of male/female and age-group composition between Group A and Group B.',
    charts: [{ title: 'Demographics', datasets: demographicsBarData.value.datasets || [], labels: demographicsBarData.value.labels || [], raw: demographicsBarData.value.datasets?.map(ds => ds.raw) || [] }],
    interpretation: demographicsInterpretation.value
  })

  // Absence monitoring
  cards.push({
    title: 'Absence monitoring',
    desc: 'Shows how many active members did not attend the selected groups (unique absentees) and percent of total members.',
    tableHeaders: ['Metric', eventALabelShort.value + ' (raw)', eventALabelShort.value + ' (%)', (defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value) + ' (raw)', (defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value) + ' (%)'],
    tableRows: [
      ['Present (unique)', String(basePresent.value.count), String(basePresent.value.pct), String(comparePresent.value.count), String(comparePresent.value.pct)],
      ['Absent (unique)', String(baseAbsent.value.count), String(baseAbsent.value.pct), String(compareAbsent.value.count), String(compareAbsent.value.pct)]
    ],
    interpretation: absenceInterpretation.value
  })

  // Per-event table
  if (showAverages.value) {
    cards.push({ title: 'Per-event table (averages)', desc: '', tableHeaders: ['Group', 'Total', 'Rate'], tableRows: [[eventAStatLabel.value, String(baseSummary.value.avgAttendance), String(baseSummary.value.avgParticipation + '%')], [(defaultActive.value ? 'Previous 3 events' : eventBStatLabel.value), String(compareSummary.value.avgAttendance), String(compareSummary.value.avgParticipation + '%')]], interpretation: attendanceInterpretation.value })
  } else {
    const rows = comparisonList.value.map(ev => [ `${ev.name} (${ev.date})`, String(attendeesForEvent(ev).length), String(attendanceRate(attendeesForEvent(ev)) + '%') ])
    cards.push({ title: 'Per-event table (detailed)', desc: '', tableHeaders: ['Event', 'Total', 'Rate'], tableRows: rows, interpretation: attendanceInterpretation.value })
  }

  // First timers / Returning
  if (showAverages.value) {
    cards.push({ title: 'First timers and Returning (averages)', desc: '', tableHeaders: ['Group', 'First timers', 'Returning', 'Volunteers'], tableRows: [[eventALabelShort.value, String(baseSummary.value.avgFirstTimers), String(baseSummary.value.avgReturning), String(baseSummary.value.avgVolunteers)], [(defaultActive.value ? 'Previous 3 events' : eventBLabelShort.value), String(compareSummary.value.avgFirstTimers), String(compareSummary.value.avgReturning), String(compareSummary.value.avgVolunteers)]], interpretation: firstTimerInterpretation.value + ' ' + returningInterpretation.value })
  } else {
    const rows = []
    baseEventsSelected.value.forEach(ev => rows.push([`${ev.name} (${ev.date})`, String(countFirstTimers(attendeesForEvent(ev))), String(countReturning(attendeesForEvent(ev))), String(attendeesForEvent(ev).filter(a=>a.member && a.member.finalTags?.isVolunteer).length)]))
    compareEventsSelected.value.forEach(ev => rows.push([`${ev.name} (${ev.date})`, String(countFirstTimers(attendeesForEvent(ev))), String(countReturning(attendeesForEvent(ev))), String(attendeesForEvent(ev).filter(a=>a.member && a.member.finalTags?.isVolunteer).length)]))
    cards.push({ title: 'First timers and Returning (detailed)', desc: '', tableHeaders: ['Event', 'First timers', 'Returning', 'Volunteers'], tableRows: rows })
  }

  return { cards }
})

// Interpretations for member-category and absence cards
const memberCategoryInterpretation = computed(() => {
  const rows = memberCategoryComparison.value || []
  if (!rows.length) return 'No member category data available.'
  const aTop = rows.slice().sort((x,y) => y.aPct - x.aPct)[0]
  const bTop = rows.slice().sort((x,y) => y.bPct - x.bPct)[0]
  const biggest = rows.slice().sort((x,y) => Math.abs(y.deltaAbs) - Math.abs(x.deltaAbs))[0]
  const aTopText = `${aTop.label} (${aTop.aPct}% / ${aTop.aCount})`
  const bTopText = `${bTop.label} (${bTop.bPct}% / ${bTop.bCount})`
  const diffText = biggest ? `${biggest.deltaAbs > 0 ? '+'+biggest.deltaAbs : biggest.deltaAbs} people${biggest.deltaPct !== null ? ` (${biggest.deltaPct>0?'+':''}${biggest.deltaPct}%)` : ''}` : ''
  return `${eventALabelInterp.value} is mostly ${aTopText}, while ${eventBLabelInterp.value} is mostly ${bTopText}. Largest difference: ${biggest.label} — ${diffText}.`
})

const memberDistributionInterpretation = computed(() => {
  const rows = memberCategoryComparison.value || []
  const regulars = rows.find(r => r.label === 'Regulars')
  if (!regulars) return 'No distribution data available.'
  return `${eventALabelInterp.value} has ${regulars.aCount} Regulars (${regulars.aPct}%), while ${eventBLabelInterp.value} has ${regulars.bCount} (${regulars.bPct}%). Use this to compare core attendee composition.`
})

const absenceInterpretation = computed(() => {
  const total = totalMembersCount.value || 0
  if (!total) return 'No member totals available to compute absences.'
  const aP = basePresent.value
  const bP = comparePresent.value
  const aAbs = baseAbsent.value
  const bAbs = compareAbsent.value
  const rel = baseAbsentAbs.value
  const relPct = baseAbsentPctDelta.value
  const relText = rel === 0 ? 'About the same number of absentees between the groups.' : `${Math.abs(rel)} ${Math.abs(rel) === 1 ? 'person' : 'people'} ${rel > 0 ? 'more' : 'fewer'} absentees in ${eventALabelInterp.value} compared with ${eventBLabelInterp.value}.`
  return `${eventALabelInterp.value}: ${aP.count} present (${aP.pct}%). ${eventBLabelInterp.value}: ${bP.count} present (${bP.pct}%). ${relText}${relPct !== null ? ` (${relPct > 0 ? '+' : ''}${relPct}%)` : ''}`
})


// (removed sticky label; view toggle buttons are rendered under the selection summary)


// convenience: quick-select last event(s)
function selectRecentForQuickStart() {
  // pick most recent as base, previous 1-2 as compares
  const list = sortedEvents.value
  if (!list.length) return
  baseIds.value = [list[0].id]
  const comps = []
  if (list[1]) comps.push(list[1].id)
  if (list[2]) comps.push(list[2].id)
  if (list[3]) comps.push(list[3].id)
  compareIds.value = comps
  // mark default as active
  defaultActive.value = true
}

// compact selection modals
const showBaseModal = ref(false)
const showCompareModal = ref(false)

function formatSelectionList(events) {
  if (!events || !events.length) return 'none selected'
  // When averages are being shown for a default quick-select, prefer the
  // concise label 'Previous 3 events' instead of listing all events.
  if (showAverages.value && defaultActive.value) return 'Previous 3 events'
  if (events.length <= 3) return events.map(e => `${e.name} (${e.date})`).join(', ')
  const first = events.slice(0,3).map(e => `${e.name} (${e.date})`)
  return `${first.join(', ')} + ${events.length - 3} more`
}

const baseSummaryText = computed(() => {
  if (mode.value === 'months') {
    if (!baseMonth.value) return 'No Group A month chosen.'
    const evs = eventsInMonth(baseMonth.value)
    return `Group A month ${baseMonth.value} — ${evs.length} event(s) selected.`
  }
  const evs = baseEventsSelected.value
  return `Group A: ${formatSelectionList(evs)}`
})

const compareSummaryText = computed(() => {
  if (mode.value === 'months') {
    if (!compareMonth.value) return 'No Group(s) B month chosen.'
    const evs = eventsInMonth(compareMonth.value)
    return `Group(s) B month ${compareMonth.value} — ${evs.length} event(s) selected.`
  }
  const evs = compareEventsSelected.value
  return `Group(s) B: ${formatSelectionList(evs)}`
})

// total members (active if available)
const totalMembersCount = computed(() => Array.isArray(membersStore.activeMembers) ? membersStore.activeMembers.length : (membersStore.members ? membersStore.members.length : 0))

// unique attendee count for a set of events
function uniqueAttendeeCountForEvents(eventsArr) {
  const seen = new Set()
  ;(eventsArr || []).forEach(ev => {
    attendeesForEvent(ev).forEach(a => {
      if (a && a.member && a.member.id) seen.add(a.member.id)
    })
  })
  return seen.size
}

// Present / Absent calculations for base and compare
const basePresent = computed(() => {
  const count = uniqueAttendeeCountForEvents(baseEventsSelected.value)
  const total = totalMembersCount.value || 0
  const pct = total ? Math.round((count / total) * 100) : 0
  return { count, pct, total }
})

const comparePresent = computed(() => {
  const count = uniqueAttendeeCountForEvents(compareEventsSelected.value)
  const total = totalMembersCount.value || 0
  const pct = total ? Math.round((count / total) * 100) : 0
  return { count, pct, total }
})

const baseAbsent = computed(() => {
  const total = totalMembersCount.value || 0
  const present = basePresent.value.count || 0
  const absent = Math.max(0, total - present)
  const pct = total ? Math.round((absent / total) * 100) : 0
  return { count: absent, pct }
})

const compareAbsent = computed(() => {
  const total = totalMembersCount.value || 0
  const present = comparePresent.value.count || 0
  const absent = Math.max(0, total - present)
  const pct = total ? Math.round((absent / total) * 100) : 0
  return { count: absent, pct }
})

// deltas for presence/absence (base relative to compare)
const basePresentAbs = computed(() => (basePresent.value.count || 0) - (comparePresent.value.count || 0))
const basePresentPctDelta = computed(() => pctChange(basePresent.value.pct || 0, comparePresent.value.pct || 0))
const baseAbsentAbs = computed(() => (baseAbsent.value.count || 0) - (compareAbsent.value.count || 0))
const baseAbsentPctDelta = computed(() => pctChange(baseAbsent.value.pct || 0, compareAbsent.value.pct || 0))

</script>

<template>
  <div class="event-comparison-improved">
    <div class="quick-actions">
        <button :class="['btn ghost', defaultActive ? 'active' : '']" @click="selectRecentForQuickStart()">Default: Compare most recent event to the previous 3 events.</button>
        <ExportButton exportType="page" :pageExportData="exportPageData" />
      </div>
    
    <div class="selectors compact-selectors">
      <div class="selector-card card" style="width:100%">
        <h4>Select other events to compare.</h4>
        <div class="selector-head"><span class="selector-label">Group A:</span><button class="btn ghost small" @click="showBaseModal = true">+ Add Event</button></div>

        <div class="tags">
          <template v-if="mode === 'events'">
            <span v-if="!baseEventsSelected.length" class="muted small">No events selected</span>
            <template v-else-if="showAverages && defaultActive && baseEventsSelected.length > 1">
              <span class="tag base">
                <span class="tag-label">Previous 3 events</span>
              </span>
            </template>
            <template v-else>
              <span v-for="ev in baseEventsSelected" :key="ev.id" class="tag base">
                <span class="tag-label">{{ ev.name }} <span class="tag-date">({{ ev.date }})</span></span>
                <button class="tag-x" @click="removeBaseId(ev.id)">×</button>
              </span>
            </template>
          </template>
        </div>
        <div class="selector-separator" aria-hidden="true"></div>
        <div class="selector-head"><span class="selector-label">Group B:</span><button class="btn ghost small" @click="showCompareModal = true">+ Add Event</button></div>

        <div class="tags">
          <template v-if="mode === 'events'">
            <span v-if="!compareEventsSelected.length" class="muted small">No events selected</span>
            <template v-else-if="showAverages && defaultActive && compareEventsSelected.length > 1">
              <span class="tag compare">
                <span class="tag-label">Previous 3 events</span>
              </span>
            </template>
            <template v-else>
              <span v-for="ev in compareEventsSelected" :key="ev.id" class="tag compare">
                <span class="tag-label">{{ ev.name }} <span class="tag-date">({{ ev.date }})</span></span>
                <button class="tag-x" @click="removeCompareId(ev.id)">×</button>
              </span>
            </template>
          </template>
      </div>
      <button class="btn ghost" @click="baseIds = []; compareIds = []; baseMonth=''; compareMonth=''; defaultActive = false">Clear</button>
    </div>
        
      </div>

    <!-- view toggle (averages vs detailed) placed under selection summary and above charts -->
    <div class="view-toggle" v-if="!needSelectionWarning">
      <button :class="['btn ghost', showDetails ? 'active' : '']" @click="showDetails = true">Show detailed</button>
      <button :class="['btn ghost', !showDetails ? 'active' : '']" @click="showDetails = false">Show average</button>
    </div>

    <!-- Base selection modal -->
    <div v-if="showBaseModal" class="modal-overlay" @click.self="showBaseModal = false">
      <div class="modal">
        <h3>Edit Base Selection</h3>
          <div v-if="mode === 'events'">
          <label>Pick one or more base groups</label>
          <div class="multi-select">
            <div v-for="opt in eventOptions" :key="'mb-'+opt.id" class="multi-option">
              <input type="checkbox" :id="'mb-'+opt.id" :value="opt.id" v-model="baseIds" />
              <label :for="'mb-'+opt.id">{{ opt.label }}</label>
            </div>
          </div>
          <div class="interpretation">{{ memberCategoryInterpretation }}</div>
        </div>
        <div v-else>
          <label>Pick base month</label>
          <input type="month" v-model="baseMonth" />
          <div class="muted small" v-if="baseMonth">Events found: {{ eventsInMonth(baseMonth).length }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showBaseModal = false">Done</button>
          <button class="btn ghost" @click="baseIds = []; baseMonth=''; showBaseModal = false">Clear</button>
        </div>
      </div>
    </div>

    <!-- Compare selection modal -->
    <div v-if="showCompareModal" class="modal-overlay" @click.self="showCompareModal = false">
      <div class="modal">
        <h3>Edit Comparison Selection</h3>
        <div v-if="mode === 'events'">
          <label>Pick one or more comparison groups</label>
          <div class="multi-select">
            <div v-for="opt in eventOptions" :key="'mc-'+opt.id" class="multi-option">
              <input type="checkbox" :id="'mc-'+opt.id" :value="opt.id" v-model="compareIds" />
              <label :for="'mc-'+opt.id">{{ opt.label }}</label>
            </div>
          </div>
        </div>
        <div v-else>
          <label>Pick comparison month</label>
          <input type="month" v-model="compareMonth" />
          <div class="muted small" v-if="compareMonth">Events found: {{ eventsInMonth(compareMonth).length }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showCompareModal = false">Done</button>
          <button class="btn ghost" @click="compareIds = []; compareMonth=''; showCompareModal = false">Clear</button>
        </div>
      </div>
    </div>

    <section v-if="needSelectionWarning" class="empty-state">
      <p v-if="!(eventsStore.allEvents || []).length">No events yet — create events to compare.</p>
      <p v-else>Select at least one base and one comparison (or pick months) to view comparison charts and tables.</p>
    </section>

    <section v-else class="comparison-grid">
      <!-- Left column: charts -->
      <div class="left">
        <div class="card">
          <h3>Attendance totals (per event)</h3>
          <p class="card-desc">Shows total attendance for the selected events (or averaged values when many events are selected). Use this to compare overall turnout.</p>
          
          <div class="chart-wrapper">
            <BarChart :chartData="attendanceChartData" :chartOptions="attendanceOptions" />
          </div>
          <div class="stats-row">
            <div class="stat">
              <div class="label">{{ eventAStatLabel }}</div>
              <div class="value">{{ baseSummary.avgAttendance }}</div>
            </div>
            <div class="stat">
              <div class="label">{{ eventBStatLabel }}</div>
              <div class="value">{{ compareSummary.avgAttendance }}</div>
            </div>
          </div>
          <div class="interpretation" aria-live="polite">{{ attendanceInterpretation }}</div>
        </div>

        <div class="card">
          <h3>Participation % (per event)</h3>
          <p class="card-desc">Shows percentage of active members who attended each event (or group averages). Useful for understanding engagement levels.</p>
          
          <div class="chart-wrapper small">
            <BarChart :chartData="participationChartData" :chartOptions="participationOptions" />
          </div>
          <div class="interpretation" aria-live="polite">{{ participationInterpretation }}</div>
        </div>
        
          <div class="card">
            <h3>Member Distribution</h3>
            <p class="card-desc">Distribution of attendee categories for Group A and Group B (Regulars, Dgroup Leaders, First Timers).</p>

            <div class="chart-row small" style="display:flex;gap:12px;">
              <div style="flex:1; min-width:140px;">
                <div style="text-align:center; font-weight:700; margin-bottom:6px">{{ eventALabelShort }}</div>
                <div style="height:170px"><DoughnutChart :chartData="baseCategoryData" :chartOptions="doughnutOptionsFactory()"/></div>
              </div>
              <div style="flex:1; min-width:140px;">
                <div style="text-align:center; font-weight:700; margin-bottom:6px">{{ eventBDisplayShort }}</div>
                <div style="height:170px"><DoughnutChart :chartData="compareCategoryData" :chartOptions="doughnutOptionsFactory()"/></div>
              </div>
            </div>
            <div class="interpretation" aria-live="polite">{{ memberDistributionInterpretation }}</div>

          </div>

          <!-- Member category distribution table moved here (left column) -->
          <div class="card">
            <h3>Member Category Distribution</h3>
            <p class="card-desc">Counts and percentages of member categories for Group A and Group B. Shows percent delta next to percent and raw delta next to raw values.</p>
            <div class="table-wrapper small">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>{{ eventALabelShort }} (raw)</th>
                    <th>{{ eventALabelShort }} (%)</th>
                    <th>{{ eventBDisplayShort }} (raw)</th>
                    <th>{{ eventBDisplayShort }} (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in memberCategoryComparison" :key="row.label">
                    <td class="evt">{{ row.label }}</td>
                    <td>
                      {{ row.aCount }}
                      <template v-if="row.deltaAbs !== 0">
                        <span :class="['delta', row.deltaAbs > 0 ? 'up' : 'down']" :aria-label="`${row.label} absolute change: ${row.deltaAbs > 0 ? '+'+row.deltaAbs : row.deltaAbs} attendees`">{{ row.deltaAbs > 0 ? '+'+row.deltaAbs : row.deltaAbs }}</span>
                      </template>
                    </td>
                    <td>
                      {{ row.aPct }}%
                      <template v-if="row.deltaPct !== null && row.deltaPct !== 0">
                        <span :class="['delta', row.deltaPct > 0 ? 'up' : 'down']" :aria-label="`${row.label} percent change: ${row.deltaPct > 0 ? '+'+row.deltaPct+'%' : row.deltaPct+'%'}`">{{ row.deltaPct > 0 ? '+'+row.deltaPct+'%' : row.deltaPct+'%' }}</span>
                      </template>
                    </td>
                    <td>{{ row.bCount }}</td>
                    <td>{{ row.bPct }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3>Demographics comparison</h3>
            <p class="card-desc">Comparison of male/female and age-group composition between Group A and Group B.</p>
              <div class="chart-wrapper small">
              <BarChart :chartData="demographicsBarData" :chartOptions="demographicsOptions" />
            </div>
            <div class="interpretation" aria-live="polite">{{ demographicsInterpretation }}</div>
          </div>

          <!-- Absence monitoring card (moved to left column) -->
          <div class="card">
            <h3>Absence monitoring</h3>
            <p class="card-desc">Shows how many active members did not attend the selected groups (unique absentees) and percent of total members.</p>
            <div class="table-wrapper small">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{{ eventALabelShort }} (raw)</th>
                    <th>{{ eventALabelShort }} (%)</th>
                    <th>{{ eventBDisplayShort }} (raw)</th>
                    <th>{{ eventBDisplayShort }} (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="evt">Present (unique)</td>
                    <td>
                      {{ basePresent.count }}
                      <template v-if="basePresentAbs !== 0">
                        <span :class="['delta', basePresentAbs > 0 ? 'up' : 'down']" :aria-label="`Present absolute change: ${basePresentAbs > 0 ? '+'+basePresentAbs : basePresentAbs} attendees`">{{ basePresentAbs > 0 ? '+'+basePresentAbs : basePresentAbs }}</span>
                      </template>
                    </td>
                    <td>
                      {{ basePresent.pct }}%
                      <template v-if="basePresentPctDelta !== null">
                        <span :class="['delta', basePresentPctDelta > 0 ? 'up' : (basePresentPctDelta < 0 ? 'down' : 'neutral')]" :aria-label="`Present percent change: ${basePresentPctDelta > 0 ? '+'+basePresentPctDelta+'%' : basePresentPctDelta+'%'}`">{{ basePresentPctDelta > 0 ? '+'+basePresentPctDelta+'%' : basePresentPctDelta+'%' }}</span>
                      </template>
                    </td>
                    <td>{{ comparePresent.count }}</td>
                    <td>{{ comparePresent.pct }}%</td>
                  </tr>
                  <tr>
                    <td class="evt">Absent (unique)</td>
                    <td>
                      {{ baseAbsent.count }}
                      <template v-if="baseAbsentAbs !== 0">
                        <span :class="['delta', baseAbsentAbs > 0 ? 'up' : 'down']" :aria-label="`Absent absolute change: ${baseAbsentAbs > 0 ? '+'+baseAbsentAbs : baseAbsentAbs} attendees`">{{ baseAbsentAbs > 0 ? '+'+baseAbsentAbs : baseAbsentAbs }}</span>
                      </template>
                    </td>
                    <td>
                      {{ baseAbsent.pct }}%
                      <template v-if="baseAbsentPctDelta !== null">
                        <span :class="['delta', baseAbsentPctDelta > 0 ? 'up' : (baseAbsentPctDelta < 0 ? 'down' : 'neutral')]" :aria-label="`Absent percent change: ${baseAbsentPctDelta > 0 ? '+'+baseAbsentPctDelta+'%' : baseAbsentPctDelta+'%'}`">{{ baseAbsentPctDelta > 0 ? '+'+baseAbsentPctDelta+'%' : baseAbsentPctDelta+'%' }}</span>
                      </template>
                    </td>
                    <td>{{ compareAbsent.count }}</td>
                    <td>{{ compareAbsent.pct }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="interpretation" aria-live="polite">{{ absenceInterpretation }}</div>
          </div>

      </div>

      <!-- Right column: comparison tables + demographic donut -->
      <div class="right">
        <div class="card">
          <h3>Per-event table</h3>
          <p class="card-desc">Tabular summary of attendance, participation rate, first-timers and returning attendees. Shows averages when many events are selected.</p>
          
          <div class="table-wrapper">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Total</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="showAverages">
                  <tr>
                    <td class="evt">{{ eventAStatLabel }}</td>
                    <td>
                      {{ baseSummary.avgAttendance }}
                      <template v-if="baseAvgAttendanceAbs !== 0">
                        <span :class="['delta', baseAvgAttendanceAbs > 0 ? 'up' : (baseAvgAttendanceAbs < 0 ? 'down' : 'neutral')]" :aria-label="`Average attendance absolute change: ${baseAvgAttendanceAbs > 0 ? '+'+baseAvgAttendanceAbs : baseAvgAttendanceAbs} attendees`">{{ baseAvgAttendanceAbs > 0 ? '+'+baseAvgAttendanceAbs : baseAvgAttendanceAbs }}</span>
                      </template>
                    </td>
                    <td>
                      {{ baseSummary.avgParticipation }}%
                      <template v-if="baseAvgParticipationDelta !== null">
                        <span :class="['delta', baseAvgParticipationDelta > 0 ? 'up' : (baseAvgParticipationDelta < 0 ? 'down' : 'neutral')]" :aria-label="`Participation change: ${baseAvgParticipationDelta > 0 ? '+'+baseAvgParticipationDelta+'%' : baseAvgParticipationDelta+'%'}`">{{ baseAvgParticipationDelta > 0 ? '+' + baseAvgParticipationDelta + '%' : baseAvgParticipationDelta + '%' }}</span>
                      </template>
                    </td>
                  </tr>
                  <tr>
                    <td class="evt">{{ defaultActive ? 'Previous 3 events' : eventBStatLabel }}</td>
                    <td>{{ compareSummary.avgAttendance }}</td>
                    <td>{{ compareSummary.avgParticipation }}%</td>
                  </tr>
                </template>
                <template v-else>
                  <tr v-for="ev in comparisonList" :key="ev.id">
                    <td class="evt">{{ ev.name }} <span class="date">({{ ev.date }})</span></td>
                    <td>{{ attendeesForEvent(ev).length }}</td>
                    <td>{{ attendanceRate(attendeesForEvent(ev)) }}%</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div class="interpretation" aria-live="polite">{{ attendanceInterpretation }}</div>
        </div>

        <!-- First timers / Returning Members: show averages or detailed per-event breakdown -->
        <div class="card">
          <h3>First timers and Returning Members</h3>
          <p class="card-desc">Detailed and average counts of first-time attendees, returning attendees, and volunteers.</p>
          <div class="table-wrapper small">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Group / Event</th>
                  <th>First timers</th>
                  <th>Returning</th>
                  <th>Volunteers</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="showAverages">
                  <tr>
                      <td>{{ eventALabelShort }}</td>
                      <td>
                        {{ baseSummary.avgFirstTimers }}
                          <template v-if="baseAvgFirstTimersAbs !== 0">
                            <span :class="['delta', baseAvgFirstTimersAbs > 0 ? 'up' : 'down']" :aria-label="`First-timers absolute change: ${baseAvgFirstTimersAbs > 0 ? '+'+baseAvgFirstTimersAbs : baseAvgFirstTimersAbs} attendees`">{{ baseAvgFirstTimersAbs > 0 ? '+' + baseAvgFirstTimersAbs : baseAvgFirstTimersAbs }}</span>
                          </template>
                      </td>
                      <td>
                        {{ baseSummary.avgReturning }}
                          <template v-if="baseAvgReturningAbs !== 0">
                            <span :class="['delta', baseAvgReturningAbs > 0 ? 'up' : 'down']" :aria-label="`Returning absolute change: ${baseAvgReturningAbs > 0 ? '+'+baseAvgReturningAbs : baseAvgReturningAbs} attendees`">{{ baseAvgReturningAbs > 0 ? '+' + baseAvgReturningAbs : baseAvgReturningAbs }}</span>
                          </template>
                      </td>
                      <td>
                        {{ baseSummary.avgVolunteers }}
                          <template v-if="baseAvgVolunteersAbs !== 0">
                            <span :class="['delta', baseAvgVolunteersAbs > 0 ? 'up' : 'down']" :aria-label="`Volunteers absolute change: ${baseAvgVolunteersAbs > 0 ? '+'+baseAvgVolunteersAbs : baseAvgVolunteersAbs} attendees`">{{ baseAvgVolunteersAbs > 0 ? '+' + baseAvgVolunteersAbs : baseAvgVolunteersAbs }}</span>
                          </template>
                      </td>
                    </tr>
                    <tr>
                      <td>{{ defaultActive ? 'Previous 3 events' : eventBStatLabel }}</td>
                      <td>{{ compareSummary.avgFirstTimers }}</td>
                      <td>{{ compareSummary.avgReturning }}</td>
                      <td>{{ compareSummary.avgVolunteers }}</td>
                    </tr>
                </template>
                <template v-else>
                  <tr v-for="ev in baseEventsSelected" :key="'ft-base-'+ev.id">
                    <td class="evt">{{ ev.name }} <span class="date">({{ ev.date }})</span></td>
                    <td>{{ countFirstTimers(attendeesForEvent(ev)) }}</td>
                    <td>{{ countReturning(attendeesForEvent(ev)) }}</td>
                    <td>{{ attendeesForEvent(ev).filter(a => a.member && a.member.finalTags?.isVolunteer).length }}</td>
                  </tr>
                  <tr v-for="ev in compareEventsSelected" :key="'ft-compare-'+ev.id">
                    <td class="evt">{{ ev.name }} <span class="date">({{ ev.date }})</span></td>
                    <td>{{ countFirstTimers(attendeesForEvent(ev)) }}</td>
                    <td>{{ countReturning(attendeesForEvent(ev)) }}</td>
                    <td>{{ attendeesForEvent(ev).filter(a => a.member && a.member.finalTags?.isVolunteer).length }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div class="interpretation" aria-live="polite">{{ firstTimerInterpretation }} {{ returningInterpretation }}</div>
        </div>

      </div> <!-- end right -->
    </section>
    
  </div>
</template>

<style scoped>
.event-comparison-improved { padding: 18px; }
.muted { color:#6B7280; }
.selectors { display:flex; gap:18px; flex-wrap:wrap; margin-bottom:8px }
.selector-col { flex:1 1 360px; background:#fff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(15,23,42,0.04) }
.multi-select { max-height:220px; overflow:auto; padding:6px 0; display:flex; flex-direction:column; gap:6px }
.multi-option { display:flex; gap:8px; align-items:center; padding:4px 6px; border-radius:6px }
.multi-option input { width:16px; height:16px }
.mode-select { display:flex; flex-direction:column; gap:6px; min-width:160px; }

.quick-actions { margin:10px 0; display:flex; gap:10px }
.btn { background:#1976D2; color:white; padding:8px 12px; border-radius:8px; border:none; cursor:pointer; font-weight:700 }
.btn.ghost { background:transparent; border:1px solid #E0E0E0; color:#37474F }

.empty-state { background:#fff; padding:12px; border-radius:10px; color:#6B7280; margin-top:10px }

/* main grid */
.comparison-grid { display:grid; grid-template-columns: 1.2fr .8fr; gap: 24px; margin-top:18px; align-items: start }
@media (max-width: 1000px) { .comparison-grid { grid-template-columns: 1fr; } }

.card { background:#fff; padding:20px; border-radius:12px; margin-bottom:18px; box-shadow:0 6px 18px rgba(15,23,42,0.04); display:flex; flex-direction:column; gap:12px }

/* ensure left/right columns stack cards top-aligned */
.left, .right { display:flex; flex-direction:column }
.chart-wrapper { height: 260px; margin-bottom:14px }
.chart-wrapper.small { height: 180px }

.stats-row { display:flex; gap:16px; margin-top:10px }
.stat { background:#F8FAFC; padding:10px 14px; border-radius:10px; min-width:120px }
.stat .label { font-size:13px; color:#6B7280 }
.stat .value { font-weight:800; font-size:18px }

.table-wrapper { overflow:auto; margin-top:12px; margin-bottom:8px }
.stats-table { width:100%; border-collapse:collapse; font-size:14px }
.stats-table thead th { text-align:left; padding:12px 14px; background:#F5F7FA; color:#37474F; font-weight:700 }
.stats-table tbody td { padding:12px 14px; border-top:1px solid #ECEFF1 }
.evt { font-weight:700 }
.date { color:#6B7280; font-weight:500; margin-left:8px; font-size:12px }

/* selector labels */
.selector-label { font-weight:700; margin-right:8px; color:#0F172A }

/* separator between Group A and Group B selectors */
.selector-separator { height:1px; background:#E6EEF9; margin:12px 0; border-radius:2px }

/* make event/date text use an accent color (not black/gray) */
.tag .tag-date { color: #1565C0 }
.date { color: #1565C0 }

.muted.small { font-size:12px; color:#6B7280; margin-top:6px }

.compact-selectors .selector-col.compact { padding:10px; display:flex; flex-direction:column; justify-content:space-between }
.compact-line { display:flex; gap:8px; align-items:center }
.selection-summary { font-weight:700; font-size:14px; color:#263238 }
.selection-summary-block { background:#fff; padding:10px; border-radius:8px; margin:10px 0; box-shadow:0 4px 12px rgba(2,6,23,0.04) }
.summary-line { margin-bottom:6px }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:40 }
.modal { background:#fff; padding:18px; border-radius:10px; width:min(820px,95%); max-height:80vh; overflow:auto; box-shadow:0 12px 30px rgba(2,6,23,0.25) }
.modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px }

.card-desc { color:#475569; font-size:13px; margin-top:-6px; margin-bottom:8px }

/* tighter spacing for card headers */
.card h3, .card h4 {
  margin-top: 0;
  margin-bottom: 6px;
  padding: 0;
  line-height: 1.15;
}
.card h3 { font-size: 1.05rem }
.card h4 { font-size: 0.98rem }

.interpretation { background:#F1F5F9; padding:10px; border-radius:8px; color:#0F172A; font-size:13px; margin-top:8px }

.card-actions { display:flex; gap:8px; align-items:center }

.view-toggle { margin:12px 0; display:flex; gap:8px }
.view-toggle .btn { border-radius:999px }

/* active button states (ensure ghost buttons also show blue when active) */
.btn.active { background:#1976D2; color:white; border:none }
.btn.ghost.active { background:#1976D2; color:white; border:none }

/* tag chips */
.tags { margin-top:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center }
.tag { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; color:#042A2B; font-weight:700 }
.tag .tag-label { max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.tag .tag-date { font-weight:600; margin-left:6px; color:rgba(2,6,23,0.6); font-size:12px }
.tag-x { background:transparent; border:0; cursor:pointer; padding:0 6px; font-weight:800; color:rgba(2,6,23,0.6) }
.tag-x:hover { color:#000 }

/* colored variants for base vs compare tags */
.tag.base { background: linear-gradient(90deg,#E3F2FD,#BBDEFB); color:#0D47A1 }
.tag.compare { background: linear-gradient(90deg,#FFEBEE,#FFCDD2); color:#7F1D1D }

.selectors-main-header { width:100%; margin-bottom:8px; font-size:16px }

@media (max-width:700px) { .top-actions { flex-direction:column; gap:8px } .view-toggle { justify-content:flex-start } }

/* small delta badges next to Group A averages */
.delta { display:inline-block; font-size:12px; font-weight:700; padding:2px 6px; margin-left:8px; border-radius:6px; vertical-align:middle }
.delta.up { color:#064E3B; background:#D1FAE5 }
.delta.down { color:#7F1D1D; background:#FFECEA }
.delta.neutral { color:#374151; background:#F1F5F9 }

</style>

/* Button hover/press animations - applied globally within this component */
<style scoped>
.btn {
  transition: transform .12s cubic-bezier(.2,.9,.2,1), box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease;
}
.btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(2,6,23,0.10);
}
.btn:active {
  transform: translateY(-1px) scale(.996);
}
.btn:focus {
  outline: none;
  box-shadow: 0 6px 18px rgba(25,118,210,0.14);
}
.btn.ghost:hover {
  background: rgba(25,118,210,0.06);
  border-color: #1976D2;
  color: #1976D2;
}
.btn.small { padding:6px 8px; font-size:0.88rem }

/* make small ghost buttons slightly raise on hover but with subtler shadow */
.btn.ghost.small:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(2,6,23,0.06) }

</style>
