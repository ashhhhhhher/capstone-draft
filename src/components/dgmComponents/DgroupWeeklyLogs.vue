<script setup>
import { ref, onMounted, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { db } from '../../firebase'
import { collectionGroup, onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth'
import { Download, Users, ClipboardList, MessageCircle, Heart, UserPlus, TrendingUp } from 'lucide-vue-next'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const logs = ref([])
const loading = ref(true)
const selectedWeekStart = ref('') // YYYY-MM-DD (Sunday)
const membersStore = useMembersStore()

// local YYYY-MM-DD helper to avoid UTC shift issues
function localYMD(input) {
  const dt = input ? new Date(input) : new Date()
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

onMounted(() => {
  const authStore = useAuthStore()
  const cg = collectionGroup(db, 'meetings')
  onSnapshot(cg, (snapshot) => {
    const items = []
    const today = localYMD()
    snapshot.forEach(docSnap => {
      const path = docSnap.ref.path
      // include only meetings under this branch
      if (!authStore.branchId || !path.includes(`branches/${authStore.branchId}/dgroupEvents/`)) return
      const data = docSnap.data()
      if (data && data.meetingDate && data.meetingDate <= today) {
        if (data.submittedBy || data.submittedById) items.push({ id: docSnap.id, ...data })
      }
    })
    // sort by meetingDate desc
    items.sort((a,b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''))
    logs.value = items
    loading.value = false
    // initialize selected week to latest meeting week or current week
    if (!selectedWeekStart.value) {
      const initDate = items.length > 0 ? items[0].meetingDate : localYMD()
      selectedWeekStart.value = getWeekStartISO(initDate)
    }
  })
  membersStore.fetchMembers()
})

  function toISODate(d) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${yyyy}-${mm}-${dd}`
  }

  function getWeekStartISO(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.getDay() // 0 Sun
    d.setDate(d.getDate() - day)
    return toISODate(d)
  }

  function formatWeekLabel(startISO) {
    if (!startISO) return ''
    const s = new Date(startISO + 'T00:00:00')
    const e = new Date(s)
    e.setDate(e.getDate() + 6)
    const startStr = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const endStr = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${startStr} — ${endStr}`
  }

  function addDaysISO(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + days)
    return toISODate(d)
  }

  function formatDateISO(dateISO) {
    if (!dateISO) return ''
    const d = new Date(dateISO + 'T00:00:00')
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function prevWeek() {
    if (!selectedWeekStart.value) return
    selectedWeekStart.value = addDaysISO(selectedWeekStart.value, -7)
  }

  function nextWeek() {
    if (!selectedWeekStart.value) return
    selectedWeekStart.value = addDaysISO(selectedWeekStart.value, 7)
  }

  const filteredLogs = computed(() => {
    if (!selectedWeekStart.value) return []
    const start = selectedWeekStart.value
    const end = addDaysISO(start, 6)
    return logs.value.filter(l => l.meetingDate && l.meetingDate >= start && l.meetingDate <= end)
  })

  const weekTotals = computed(() => {
    return (filteredLogs.value || []).reduce((acc, log) => {
      acc.c += (log.conversations || 0)
      acc.e += (log.evangelized || 0)
      acc.g += (log.guests || 0)
      const entries = Object.entries(log.attendance || {})
      const presentEntries = entries.filter(([id, a]) => a && a.isPresent)
      acc.attendance += presentEntries.length
      presentEntries.forEach(([id]) => {
        const m = membersStore.activeMembers.find(x => x.id === id)
        if (m && m.finalTags?.isDgroupLeader) acc.dl += 1
        else acc.dm += 1
      })
      return acc
    }, { c:0, e:0, g:0, attendance:0, dl:0, dm:0, nw:0, new:0 })
  })

  // helper: latest week that has data (week start)
  const maxWeekStart = computed(() => {
    if (!logs.value.length) return getWeekStartISO(localYMD())
    const latest = logs.value[0].meetingDate
    return getWeekStartISO(latest)
  })

  function canGoNext() {
    if (!selectedWeekStart.value) return false
    return selectedWeekStart.value < maxWeekStart.value
  }

// --- Computed Stats for Summary Bar & PDF ---
const totals = weekTotals

const exportLogs = () => {
  const doc = new jsPDF('l', 'mm', 'a4'); 
  
  const weekStart = selectedWeekStart.value || (filteredLogs.value.length > 0 ? filteredLogs.value[0].meetingDate : new Date().toISOString().split('T')[0])
  const weekEnd = addDaysISO(weekStart, 6)
  const weekLabel = formatWeekLabel(weekStart)
  doc.setFontSize(14);
  doc.text(`DGROUP MINISTRY WEEKLY REPORT`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Report Date: ${weekLabel} | Generated: ${new Date().toLocaleString()}`, 14, 22);

  const headers = [["Date", "Dgroup Leaders", "DL", "DM", "New", "G", "NW", "E", "C", "Total"]];

  const rows = filteredLogs.value.map(log => {
    const presentEntries = Object.entries(log.attendance || {}).filter(([id, a]) => a && a.isPresent)
    const countTag = (tag) => {
      if (tag === 'DL') return presentEntries.filter(([id]) => (membersStore.activeMembers.find(m => m.id === id)?.finalTags?.isDgroupLeader)).length
      if (tag === 'DM') return presentEntries.filter(([id]) => !(membersStore.activeMembers.find(m => m.id === id)?.finalTags?.isDgroupLeader)).length
      return 0
    }

    return [
      formatDateISO(log.meetingDate),
      log.submittedBy,
      countTag('DL') || '',
      countTag('DM') || '',
      '',
      log.guests || '',
      '',
      log.evangelized || '',
      log.conversations || '',
      presentEntries.length
    ];
  });

  const grandTotalRow = [
    "",
    "GRAND TOTAL",
    totals.value.dl || '0',
    totals.value.dm || '0',
    totals.value.new || '0',
    totals.value.g || '0',
    totals.value.nw || '0',
    totals.value.e || '0',
    totals.value.c || '0',
    totals.value.attendance || '0'
  ];

  autoTable(doc, {
    startY: 30,
    head: headers,
    body: [...rows, grandTotalRow],
    theme: 'grid',
    headStyles: { fillColor: [245, 247, 249], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
    styles: { lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 9, cellPadding: 3 },
    didParseCell: function(data) {
      if (data.row.index === rows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 245, 233]; 
      }
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { fontStyle: 'bold', halign: 'left' },
      9: { halign: 'center', fontStyle: 'bold' },
      2: {halign: 'center'}, 3: {halign: 'center'}, 4: {halign: 'center'}, 5: {halign: 'center'}, 6: {halign: 'center'}, 7: {halign: 'center'}, 8: {halign: 'center'}
    }
  });

  // filename: use ISO range for safe filename characters
  doc.save(`DGM_Weekly_Report_${weekStart}_to_${weekEnd}.pdf`);
}
</script>

<template>
  <div class="insights-container">
    
    <div class="stats-section" v-if="logs.length > 0">
      <div class="section-title">
        <TrendingUp :size="18" color="#455A64" />
        <h4>Weekly Dgroup Meet Attendance</h4>
      </div>
      
      <div class="summary-grid">
        <div class="stat-card purple">
          <div class="stat-icon"><Users :size="20" /></div>
          <div class="stat-content">
            <span class="value">{{ totals.attendance }}</span>
            <span class="label">Total Dgroup Meet Attendance</span>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><MessageCircle :size="20" /></div>
          <div class="stat-content">
            <span class="value">{{ totals.c }}</span>
            <span class="label">Conversations</span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><Heart :size="20" /></div>
          <div class="stat-content">
            <span class="value">{{ totals.e }}</span>
            <span class="label">Evangelized</span>
          </div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon"><UserPlus :size="20" /></div>
          <div class="stat-content">
            <span class="value">{{ totals.g }}</span>
            <span class="label">Guests</span>
          </div>
        </div>
      </div>
    </div>

    <div class="logs-card">
      <div class="logs-header">
          <div class="title-area">
            <ClipboardList :size="20" color="#1976D2" />
            <h3>Weekly DGroup Reports</h3>
            <div class="week-picker">
            <button class="week-btn" @click="prevWeek">◀</button>
            <div class="week-label">
              <template v-if="selectedWeekStart">
                <span>{{ formatWeekLabel(selectedWeekStart) }}</span>
              </template>
              <template v-else>
                <span>—</span>
              </template>
            </div>
            <button class="week-btn" :disabled="!canGoNext()" @click="nextWeek">▶</button>
          </div>
          </div>

          <button @click="exportLogs" class="mini-export-btn" v-if="filteredLogs.length > 0">
            <Download :size="14" /> Export PDF
          </button>
        </div>

      <div v-if="loading" class="placeholder">Loading logs...</div>
      
          <div v-else-if="filteredLogs.length === 0" class="placeholder">
            No Dgroup met this week.
          </div>

          <div v-else class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Leader</th>
              <th class="text-center">C-E-G</th>
              <th class="text-center">Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id">
              <td class="date-cell">{{ formatDateISO(log.meetingDate) }}</td>
              <td class="leader-cell">{{ log.submittedBy }}</td>
              <td class="text-center">
                <div class="ceg-badges">
                  <span class="ceg-b c" title="Conversations">{{ log.conversations || 0 }}</span>
                  <span class="ceg-b e" title="Evangelized">{{ log.evangelized || 0 }}</span>
                  <span class="ceg-b g" title="Guests">{{ log.guests || 0 }}</span>
                </div>
              </td>
              <td class="text-center">
                <span class="attendance-pill">
                  {{ Object.values(log.attendance || {}).filter(a => a.isPresent).length }} / {{ Object.keys(log.attendance || {}).length }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.insights-container { display: flex; flex-direction: column; gap: 20px; }

.section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-left: 4px; }
.section-title h4 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #455A64; font-weight: 700; }

.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }

@media (max-width: 900px) {
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
}

.stat-card { background: white; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.stat-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }

.purple .stat-icon { background: #F3E5F5; color: #7B1FA2; }
.blue .stat-icon { background: #E3F2FD; color: #1976D2; }
.green .stat-icon { background: #E8F5E9; color: #2E7D32; }
.orange .stat-icon { background: #FFF3E0; color: #F57C00; }

.stat-content { display: flex; flex-direction: column; }
.stat-content .value { font-size: 20px; font-weight: 800; color: #263238; line-height: 1.2; }
.stat-content .label { font-size: 11px; color: #78909C; font-weight: 600; text-transform: uppercase; }

.logs-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.logs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-area { display: flex; align-items: center; gap: 8px; }
.title-area h3 { margin: 0; font-size: 18px; font-weight: 600; }
.mini-export-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #E8F5E9; color: #2E7D32; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }

.table-container { overflow-x: auto; }
.custom-table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 12px; color: #546E7A; border-bottom: 2px solid #F5F7F9; font-weight: 700; text-transform: uppercase; font-size: 11px; }
td { padding: 12px; border-bottom: 1px solid #F5F7F9; }
.text-center { text-align: center; }

.date-cell { font-weight: 600; color: #1976D2; white-space: nowrap; }
.leader-cell { color: #37474F; font-weight: 500; }

.ceg-badges { display: flex; justify-content: center; gap: 4px; }
.ceg-b { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; font-weight: 800; }
.ceg-b.c { background: #E3F2FD; color: #1976D2; }
.ceg-b.e { background: #E8F5E9; color: #2E7D32; }
.ceg-b.g { background: #FFF3E0; color: #F57C00; }

.attendance-pill { background: #F5F7F9; color: #546E7A; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 12px; border: 1px solid #ECEFF1; }
.placeholder { padding: 40px; text-align: center; color: #90A4AE; }

/* Week picker styles */
.week-picker { display: flex; align-items: center; gap: 8px; margin-left: 16px; }
.week-btn { background: #F5F7F9; border: 1px solid #E0E0E0; border-radius: 6px; padding: 4px 6px; font-size: 12px; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.week-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.week-label { font-size: 12px; color: #546E7A; padding: 4px 8px; background: transparent; border-radius: 6px; min-width: 140px; text-align: center; }

@media (max-width: 900px) {
  .week-picker { margin-left: 0; margin-top: 8px; }
  .week-label { min-width: 120px; font-size: 11px; }
  .week-btn { height: 26px; width: 26px; padding: 3px 5px; font-size: 11px; }
}
</style>