<script setup>
import { ref, onMounted, computed } from 'vue'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { Download, Users, Calendar, ClipboardList, MessageCircle, Heart, UserPlus, TrendingUp } from 'lucide-vue-next'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const logs = ref([])
const loading = ref(true)

onMounted(() => {
  const logsRef = collection(db, 'branches', 'baguio', 'dgroupAttendance')
  const q = query(logsRef, orderBy('meetingDate', 'desc'))

  onSnapshot(q, (snapshot) => {
    logs.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    loading.value = false
  })
})

// --- Computed Stats for Summary Bar & PDF ---
const totals = computed(() => {
  return logs.value.reduce((acc, log) => {
    // Basic C-E-G Totals
    acc.c += (log.conversations || 0)
    acc.e += (log.evangelized || 0)
    acc.g += (log.guests || 0)
    
    // Attendance Calculations
    const attendees = Object.values(log.attendees || {})
    const present = attendees.filter(a => a.isPresent)
    acc.attendance += present.length

    // Tag Counts (Stored for PDF Grand Total)
    acc.dl += present.filter(a => a.tag === 'DL').length
    acc.dm += present.filter(a => a.tag === 'DM').length
    acc.nw += present.filter(a => a.tag === 'NW').length
    acc.new += present.filter(a => a.tag === 'NEW').length

    return acc
  }, { c: 0, e: 0, g: 0, attendance: 0, dl: 0, dm: 0, nw: 0, new: 0 })
})

const exportLogs = () => {
  const doc = new jsPDF('l', 'mm', 'a4'); 
  
  const reportDate = logs.value.length > 0 ? logs.value[0].meetingDate : new Date().toLocaleDateString();
  doc.setFontSize(14);
  doc.text(`DGROUP MINISTRY WEEKLY REPORT`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Report Date: ${reportDate} | Generated: ${new Date().toLocaleString()}`, 14, 22);

  const headers = [["Dgroup Leaders", "DL", "DM", "New", "G", "NW", "E", "C", "Total"]];

  const rows = logs.value.map(log => {
    const present = Object.values(log.attendees || {}).filter(a => a.isPresent);
    const countTag = (tag) => present.filter(a => a.tag === tag).length;

    return [
      log.submittedBy,
      countTag('DL') || '',
      countTag('DM') || '',
      countTag('NEW') || '',
      log.guests || '',
      countTag('NW') || '',
      log.evangelized || '',
      log.conversations || '',
      present.length
    ];
  });

  const grandTotalRow = [
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
      0: { fontStyle: 'bold', halign: 'left' },
      8: { halign: 'center', fontStyle: 'bold' },
      1: {halign: 'center'}, 2: {halign: 'center'}, 3: {halign: 'center'}, 4: {halign: 'center'}, 5: {halign: 'center'}, 6: {halign: 'center'}, 7: {halign: 'center'}
    }
  });

  doc.save(`DGM_Weekly_Report_${reportDate}.pdf`);
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
        </div>
        <button @click="exportLogs" class="mini-export-btn" v-if="logs.length > 0">
          <Download :size="14" /> Export PDF
        </button>
      </div>

      <div v-if="loading" class="placeholder">Loading logs...</div>
      
      <div v-else-if="logs.length === 0" class="placeholder">
        No DGroup meetings logged yet.
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
            <tr v-for="log in logs" :key="log.id">
              <td class="date-cell">{{ log.meetingDate }}</td>
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
</style>