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
const selectedWeekStart = ref('')
const membersStore = useMembersStore()

function localYMD(input) {
  const dt = input ? new Date(input) : new Date()
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

onMounted(() => {
  const authStore = useAuthStore()
  // Use collectionGroup to find all 'meetings' sub-collections across the database
  const cg = collectionGroup(db, 'meetings')
  
  onSnapshot(cg, (snapshot) => {
    const items = []
    snapshot.forEach(docSnap => {
      const data = docSnap.data()
      const path = docSnap.ref.path
      
      /**
       * FIRESTORE PATH FILTERING
       * The path should look like: branches/{branchId}/dgroupEvents/{eventId}/meetings/{meetingId}
       * This ensures we only pull logs belonging to the Dgroup Events of the current branch.
       */
      if (!authStore.branchId || !path.includes(`branches/${authStore.branchId}/dgroupEvents/`)) return
      
      // Only include logs that have been submitted (have a leader name or ID)
      if (data.submittedBy || data.submittedById) {
        items.push({ id: docSnap.id, ...data })
      }
    }, (error) => {
      console.error("Firestore collectionGroup error:", error)
    })
    
    items.sort((a,b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''))
    logs.value = items
    loading.value = false
    
    if (!selectedWeekStart.value && items.length > 0) {
      selectedWeekStart.value = getWeekStartISO(items[0].meetingDate)
    } else if (!selectedWeekStart.value) {
      selectedWeekStart.value = getWeekStartISO(localYMD())
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
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return toISODate(d)
}

function formatWeekLabel(startISO) {
  if (!startISO) return ''
  const s = new Date(startISO + 'T00:00:00')
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
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

const filteredLogs = computed(() => {
  if (!selectedWeekStart.value) return []
  const start = selectedWeekStart.value
  const end = addDaysISO(start, 6)
  return logs.value.filter(l => l.meetingDate >= start && l.meetingDate <= end)
})

const weekTotals = computed(() => {
  return (filteredLogs.value || []).reduce((acc, log) => {
    acc.g_total += Number(log.g_count || 0)
    acc.cd_total += Number(log.cd_count || 0)
    acc.e_total += Number(log.e_count || 0)
    
    const attendees = log.attendees || log.attendance || {}
    const entries = Object.values(attendees)
    const presentOnes = entries.filter(a => a.isPresent)
    
    acc.attendance += presentOnes.length
    presentOnes.forEach(p => {
      if (p.tag && acc.tags[p.tag] !== undefined) acc.tags[p.tag] += 1
    })
    
    return acc
  }, { 
    g_total: 0, cd_total: 0, e_total: 0, attendance: 0, 
    tags: { EDL:0, BDL:0, EDM:0, BDM:0, E:0, EN:0, BN:0, G:0, CD:0 } 
  })
})

const maxWeekStart = computed(() => {
  if (!logs.value.length) return getWeekStartISO(localYMD())
  return getWeekStartISO(logs.value[0].meetingDate)
})

const exportLogs = () => {
  const doc = new jsPDF('l', 'mm', 'a4')
  const weekStart = selectedWeekStart.value
  const weekLabel = formatWeekLabel(weekStart)
  
  doc.setFontSize(14).text(`DGROUP MINISTRY WEEKLY REPORT`, 14, 15)
  doc.setFontSize(10).text(`Range: ${weekLabel}`, 14, 22)

  const headers = [["Date", "Dgroup Leader", "EDL", "BDL", "EDM", "BDM", "G", "CD", "E", "Total"]]
  const rows = filteredLogs.value.map(log => {
    const att = log.attendees || log.attendance || {}
    const present = Object.values(att).filter(a => a.isPresent)
    const countT = (t) => present.filter(a => a.tag === t).length
    
    return [
      formatDateISO(log.meetingDate),
      log.submittedBy || 'Unknown',
      countT('EDL'), countT('BDL'), countT('EDM'), countT('BDM'),
      log.g_count || 0, log.cd_count || 0, log.e_count || 0,
      present.length
    ]
  })

  autoTable(doc, {
    startY: 30,
    head: headers,
    body: [...rows, [
      "", "GRAND TOTAL", 
      weekTotals.value.tags.EDL, weekTotals.value.tags.BDL, 
      weekTotals.value.tags.EDM, weekTotals.value.tags.BDM,
      weekTotals.value.g_total, weekTotals.value.cd_total, weekTotals.value.e_total,
      weekTotals.value.attendance
    ]],
    theme: 'grid',
    headStyles: { fillColor: [245, 247, 249], textColor: [0, 0, 0] },
    styles: { fontSize: 8 }
  })
  doc.save(`DGM_Report_${weekStart}.pdf`)
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
        <div class="stat-card purple"><div class="stat-icon"><Users :size="20" /></div><div class="stat-content"><span class="value">{{ weekTotals.attendance }}</span><span class="label">Total Attendance</span></div></div>
        <div class="stat-card blue"><div class="stat-icon"><UserPlus :size="20" /></div><div class="stat-content"><span class="value">{{ weekTotals.g_total }}</span><span class="label">G (Guests)</span></div></div>
        <div class="stat-card green"><div class="stat-icon"><MessageCircle :size="20" /></div><div class="stat-content"><span class="value">{{ weekTotals.cd_total }}</span><span class="label">CD (Campus Members)</span></div></div>
        <div class="stat-card orange"><div class="stat-icon"><Heart :size="20" /></div><div class="stat-content"><span class="value">{{ weekTotals.e_total }}</span><span class="label">E (Evangelized)</span></div></div>
      </div>
    </div>

    <div class="logs-card">
      <div class="logs-header">
        <div class="title-area">
          <ClipboardList :size="20" color="#1976D2" />
          <h3>Weekly Reports</h3>
          <div class="week-picker">
            <button class="week-btn" @click="selectedWeekStart = addDaysISO(selectedWeekStart, -7)">◀</button>
            <div class="week-label">{{ formatWeekLabel(selectedWeekStart) }}</div>
            <button class="week-btn" :disabled="selectedWeekStart >= maxWeekStart" @click="selectedWeekStart = addDaysISO(selectedWeekStart, 7)">▶</button>
          </div>
        </div>
        <button @click="exportLogs" class="mini-export-btn" v-if="filteredLogs.length > 0"><Download :size="14" /> Export PDF</button>
      </div>

      <div v-if="loading" class="placeholder">Loading logs...</div>
      <div v-else-if="filteredLogs.length === 0" class="placeholder">No Dgroup reports for this period.</div>
      <div v-else class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Leader</th>
              <th class="text-center">G - CD - E</th>
              <th class="text-center">Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id">
              <td class="date-cell">{{ formatDateISO(log.meetingDate) }}</td>
              <td class="leader-cell">{{ log.submittedBy }}</td>
              <td class="text-center">
                <div class="ceg-badges">
                  <span class="ceg-b g" title="Guests">{{ log.g_count || 0 }}</span>
                  <span class="ceg-b cd" title="Campus">{{ log.cd_count || 0 }}</span>
                  <span class="ceg-b e" title="Evangelized">{{ log.e_count || 0 }}</span>
                </div>
              </td>
              <td class="text-center">
                <span class="attendance-pill">
                  {{ Object.values(log.attendees || log.attendance || {}).filter(a => a.isPresent).length }} / {{ Object.keys(log.attendees || log.attendance || {}).length }}
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
.insights-container{display:flex;flex-direction:column;gap:20px}
.section-title{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-left:4px}
.section-title h4{margin:0;font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#455A64;font-weight:700}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
@media (max-width:900px){.summary-grid{grid-template-columns:repeat(2,1fr)}}
.stat-card{background:#fff;padding:16px;border-radius:12px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,.05)}
.stat-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.purple .stat-icon{background:#F3E5F5;color:#7B1FA2}
.blue .stat-icon{background:#E3F2FD;color:#1976D2}
.green .stat-icon{background:#E8F5E9;color:#2E7D32}
.orange .stat-icon{background:#FFF3E0;color:#F57C00}
.stat-content{display:flex;flex-direction:column}
.stat-content .value{font-size:20px;font-weight:800;color:#263238;line-height:1.2}
.stat-content .label{font-size:11px;color:#78909C;font-weight:600;text-transform:uppercase}
.logs-card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,.05)}
.logs-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.title-area{display:flex;align-items:center;gap:8px}
.title-area h3{margin:0;font-size:18px;font-weight:600}
.mini-export-btn{display:flex;align-items:center;gap:4px;padding:6px 12px;background:#E8F5E9;color:#2E7D32;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
.table-container{overflow-x:auto}
.custom-table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;padding:12px;color:#546E7A;border-bottom:2px solid #F5F7F9;font-weight:700;text-transform:uppercase;font-size:11px}
td{padding:12px;border-bottom:1px solid #F5F7F9}
.text-center{text-align:center}
.date-cell{font-weight:600;color:#1976D2;white-space:nowrap}
.leader-cell{color:#37474F;font-weight:500}
.ceg-badges{display:flex;justify-content:center;gap:4px}
.ceg-b{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:800}
.ceg-b.g{background:#E3F2FD;color:#1976D2}
.ceg-b.cd{background:#E8F5E9;color:#2E7D32}
.ceg-b.e{background:#FFF3E0;color:#F57C00}
.attendance-pill{background:#F5F7F9;color:#546E7A;padding:4px 10px;border-radius:20px;font-weight:700;font-size:12px;border:1px solid #ECEFF1}
.placeholder{padding:40px;text-align:center;color:#90A4AE}
.week-picker{display:flex;align-items:center;gap:8px;margin-left:16px}
.week-btn{background:#F5F7F9;border:1px solid #E0E0E0;border-radius:6px;padding:4px 6px;font-size:12px;height:28px;width:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.week-btn:disabled{opacity:.5;cursor:not-allowed}
.week-label{font-size:12px;color:#546E7A;padding:4px 8px;background:transparent;border-radius:6px;min-width:140px;text-align:center}
@media (max-width:900px){.week-picker{margin-left:0;margin-top:8px}.week-label{min-width:120px;font-size:11px}.week-btn{height:26px;width:26px;padding:3px 5px;font-size:11px}}
</style>