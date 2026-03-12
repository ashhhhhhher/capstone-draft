<script setup>
import { ref, onMounted, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { db } from '../../firebase'
import { collectionGroup, onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth'
import { Download, Users, ClipboardList, MessageCircle, Heart, UserPlus, TrendingUp, FileSpreadsheet } from 'lucide-vue-next'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { generateWeekId, formatWeekIdDisplay, parseWeekId } from '../../utils/weeklyMeetingUtils'

const logs = ref([])
const loading = ref(true)
const selectedWeekId = ref('') // Week ID like 260308-14
const membersStore = useMembersStore()

// BUG FIX: Parse dates manually to avoid timezone shifting (the JS off-by-one date bug)
function parseYMD(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d)
}

function localYMD(input) {
  const dt = input ? parseYMD(input) : new Date()
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
    snapshot.forEach(docSnap => {
      const path = docSnap.ref.path
      if (!authStore.branchId || !path.includes(`branches/${authStore.branchId}/dgroupEvents/`)) return
      const data = docSnap.data()
      if (data && (data.submittedBy || data.submittedById)) {
        // Include all submitted reports (do not gate by date; loggingDate can be future within week)
        const logDate = data.loggingDate || data.meetingDate
        if (logDate || data.meetingWeekId) items.push({ id: docSnap.id, ...data })
      }
    })
    // Sort by meetingWeekId if available, otherwise by meetingDate
    items.sort((a, b) => {
      const aId = a.meetingWeekId || a.id || a.meetingDate || ''
      const bId = b.meetingWeekId || b.id || b.meetingDate || ''
      return bId.localeCompare(aId)
    })
    logs.value = items
    loading.value = false
    if (!selectedWeekId.value) {
      if (items.length > 0) {
        const firstLog = items[0]
        const weekId = firstLog.meetingWeekId || generateWeekId(firstLog.meetingDate || firstLog.loggingDate || localYMD())
        selectedWeekId.value = weekId
      } else {
        selectedWeekId.value = generateWeekId(localYMD())
      }
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

function addDaysISO(dateStr, days) {
  const d = parseYMD(dateStr)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function formatDateISO(dateISO) {
  if (!dateISO) return ''
  const d = parseYMD(dateISO)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function prevWeek() {
  if (!selectedWeekId.value) return
  const { startDate } = parseWeekId(selectedWeekId.value)
  if (!startDate) return
  const prevDate = addDaysISO(startDate, -7)
  selectedWeekId.value = generateWeekId(prevDate)
}

function nextWeek() {
  if (!selectedWeekId.value) return
  const { startDate } = parseWeekId(selectedWeekId.value)
  if (!startDate) return
  const nextDate = addDaysISO(startDate, 7)
  selectedWeekId.value = generateWeekId(nextDate)
}

const filteredLogs = computed(() => {
  if (!selectedWeekId.value) return []
  return logs.value.filter(l => {
    // Try to match by meetingWeekId first
    if (l.meetingWeekId === selectedWeekId.value) return true
    
    // Fallback: match by date range (for old data without meetingWeekId)
    const logDate = l.meetingDate || l.loggingDate
    if (logDate) {
      const logWeekId = generateWeekId(logDate)
      return logWeekId === selectedWeekId.value
    }
    return false
  })
})

const weekTotals = computed(() => {
  const totals = { c: 0, e: 0, g: 0, attendance: 0, bdl: 0, edl: 0, bdm: 0, edm: 0, bn: 0, en: 0 };
  for (const log of filteredLogs.value) {
    totals.c += log.campusDmember || 0;
    totals.e += log.evangelized || 0;
    totals.g += log.guests || 0;

    const presentAttendees = Object.values(log.attendees || {}).filter(a => a?.isPresent);
    totals.attendance += presentAttendees.length;

    for (const attendee of presentAttendees) {
      const tagKey = attendee.tag?.toLowerCase();
      if (totals.hasOwnProperty(tagKey)) {
        totals[tagKey]++;
      }
    }
  }
  return totals;
})

const maxWeekStart = computed(() => {
  if (!logs.value.length) return generateWeekId(localYMD())
  const latest = logs.value[0]
  const weekId = latest.meetingWeekId || generateWeekId(latest.meetingDate || latest.loggingDate || localYMD())
  return weekId
})

function canGoNext() {
  if (!selectedWeekId.value) return false
  return selectedWeekId.value < maxWeekStart.value
}

const totals = weekTotals

// EXCEL (CSV) EXPORT FUNCTION
const exportExcel = () => {
  const weekId = selectedWeekId.value || generateWeekId(localYMD())
  
  const headers = ["Date", "Leader", "BDL", "EDL", "BDM", "EDM", "BN", "EN", "Campus Dmembers", "Evangelized", "Guests", "Total Attendance"]
  
  const rows = filteredLogs.value.map(log => {
    const attendees = Object.values(log.attendees || {}).filter(a => a.isPresent)
    const count = (t) => attendees.filter(a => a.tag === t).length
    const logDate = log.meetingDate || log.loggingDate
    
    return [
      formatDateISO(logDate),
      `"${log.submittedBy || ''}"`, // Quotes to prevent breakage if a name contains a comma
      count('BDL') || '0',
      count('EDL') || '0',
      count('BDM') || '0',
      count('EDM') || '0',
      count('BN') || '0',
      count('EN') || '0',
      log.campusDmember || '0',
      log.evangelized || '0',
      log.guests || '0',
      attendees.length
    ]
  })

  const grandTotalRow = [
    "",
    "GRAND TOTAL",
    totals.value.bdl,
    totals.value.edl,
    totals.value.bdm,
    totals.value.edm,
    totals.value.bn,
    totals.value.en,
    totals.value.c,
    totals.value.e,
    totals.value.g,
    totals.value.attendance
  ]

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
    grandTotalRow.join(",")
  ].join("\n")

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `DGM_Weekly_Report_${weekId}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const exportLogs = () => {
  const doc = new jsPDF('l', 'mm', 'a4'); 
  const weekId = selectedWeekId.value || generateWeekId(localYMD())
  const weekLabel = formatWeekIdDisplay(weekId)
  
  doc.setFontSize(14);
  doc.text(`DGROUP MINISTRY WEEKLY REPORT`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Report Date: ${weekLabel} | Generated: ${new Date().toLocaleString()}`, 14, 22);

  const headers = [["Date", "Leader", "BDL", "EDL", "BDM", "EDM", "BN", "EN", "CD", "E", "G", "Total"]];

  const rows = filteredLogs.value.map(log => {
    const attendees = Object.values(log.attendees || {}).filter(a => a.isPresent)
    const count = (t) => attendees.filter(a => a.tag === t).length
    const logDate = log.meetingDate || log.loggingDate
    
    return [
      formatDateISO(logDate),
      log.submittedBy,
      count('BDL') || '0',
      count('EDL') || '0',
      count('BDM') || '0',
      count('EDM') || '0',
      count('BN') || '0',
      count('EN') || '0',
      log.campusDmember || '0',
      log.evangelized || '0',
      log.guests || '0',
      attendees.length
    ];
  });

  const grandTotalRow = [
    "",
    "GRAND TOTAL",
    totals.value.bdl,
    totals.value.edl,
    totals.value.bdm,
    totals.value.edm,
    totals.value.bn,
    totals.value.en,
    totals.value.c,
    totals.value.e,
    totals.value.g,
    totals.value.attendance
  ];

  autoTable(doc, {
    startY: 30,
    head: headers,
    body: [...rows, grandTotalRow],
    theme: 'grid',
    headStyles: { fillColor: [245, 247, 249], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
    styles: { lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 8, cellPadding: 2 },
    didParseCell: function(data) {
      if (data.row.index === rows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 245, 233]; 
      }
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { fontStyle: 'bold', cellWidth: 40 },
      11: { halign: 'center', fontStyle: 'bold' }
    }
  });

  doc.save(`DGM_Weekly_Report_${weekId}.pdf`);
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
            <span class="label">Total Attendance</span>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><MessageCircle :size="20" /></div>
          <div class="stat-content">
            <span class="value">{{ totals.c }}</span>
            <span class="label">Campus Dmembers</span>
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
              <span>{{ selectedWeekId ? formatWeekIdDisplay(selectedWeekId) : '—' }}</span>
            </div>
            <button class="week-btn" :disabled="!canGoNext()" @click="nextWeek">▶</button>
          </div>
          </div>
          
          <div class="export-actions" v-if="filteredLogs.length > 0">
            <button @click="exportExcel" class="mini-export-btn excel-btn">
              <FileSpreadsheet :size="14" /> Export Excel
            </button>
            <button @click="exportLogs" class="mini-export-btn pdf-btn">
              <Download :size="14" /> Export PDF
            </button>
          </div>
        </div>

      <div v-if="loading" class="placeholder">Loading logs...</div>
      <div v-else-if="filteredLogs.length === 0" class="placeholder">No Dgroup met this week.</div>

      <div v-else class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Leader</th>
              <th class="text-center">CD-E-G</th>
              <th class="text-center">Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id">
              <td class="date-cell">{{ formatDateISO(log.meetingDate || log.loggingDate) }}</td>
              <td class="leader-cell">{{ log.submittedBy }}</td>
              <td class="text-center">
                <div class="ceg-badges">
                  <span class="ceg-b c" title="Campus Dmembers">{{ log.campusDmember || 0 }}</span>
                  <span class="ceg-b e" title="Evangelized">{{ log.evangelized || 0 }}</span>
                  <span class="ceg-b g" title="Guests">{{ log.guests || 0 }}</span>
                </div>
              </td>
              <td class="text-center">
                <span class="attendance-pill">
                  {{ Object.values(log.attendees || {}).filter(a => a.isPresent).length }} / {{ Object.keys(log.attendees || {}).length }}
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
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
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

.export-actions { display: flex; gap: 8px; }
.mini-export-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; transition: background 0.2s; }
.pdf-btn { background: #E8F5E9; color: #2E7D32; }
.pdf-btn:hover { background: #C8E6C9; }
.excel-btn { background: #E3F2FD; color: #1976D2; }
.excel-btn:hover { background: #BBDEFB; }

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
.week-picker { display: flex; align-items: center; gap: 8px; margin-left: 16px; }
.week-btn { background: #F5F7F9; border: 1px solid #E0E0E0; border-radius: 6px; padding: 4px 6px; font-size: 12px; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.week-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.week-label { font-size: 12px; color: #546E7A; padding: 4px 8px; background: transparent; border-radius: 6px; min-width: 140px; text-align: center; }
</style>