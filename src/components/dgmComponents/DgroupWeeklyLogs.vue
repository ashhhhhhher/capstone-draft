<script setup>
import { ref, onMounted, computed } from 'vue'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { Download, Users, Calendar, ClipboardList } from 'lucide-vue-next'

const logs = ref([])
const loading = ref(true)

onMounted(() => {
  // Directly fetching from the path we set up in the Store
  const logsRef = collection(db, 'branches', 'baguio', 'dgroupAttendance')
  const q = query(logsRef, orderBy('meetingDate', 'desc'))

  onSnapshot(q, (snapshot) => {
    logs.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    loading.value = false
  })
})

const exportLogs = () => {
  const headers = ["Date", "Leader", "Topic", "Venue", "Present", "Total"]
  const rows = logs.value.map(log => [
    log.meetingDate,
    log.submittedBy,
    log.meetingName,
    log.venue,
    Object.values(log.attendees).filter(a => a.isPresent).length,
    Object.keys(log.attendees).length
  ])

  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", `DGroup_Weekly_Report_${new Date().toISOString().split('T')[0]}.csv`)
  link.click()
}
</script>

<template>
  <div class="logs-card">
    <div class="logs-header">
      <div class="title-area">
        <ClipboardList :size="20" color="#1976D2" />
        <h3>Weekly DGroup Attendance</h3>
      </div>
      <button @click="exportLogs" class="mini-export-btn" v-if="logs.length > 0">
        <Download :size="14" /> Export
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
            <th>Topic</th>
            <th>Attendance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="date-cell">{{ log.meetingDate }}</td>
            <td class="leader-cell">{{ log.submittedBy }}</td>
            <td>{{ log.meetingName }}</td>
            <td>
              <span class="attendance-pill">
                {{ Object.values(log.attendees).filter(a => a.isPresent).length }} / {{ Object.keys(log.attendees).length }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.logs-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; }
.logs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.title-area { display: flex; align-items: center; gap: 8px; }
.title-area h3 { margin: 0; font-size: 18px; font-weight: 600; }
.mini-export-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #E8F5E9; color: #2E7D32; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
.table-container { overflow-x: auto; }
.custom-table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 12px; color: #546E7A; border-bottom: 2px solid #F5F7F9; font-weight: 600; }
td { padding: 12px; border-bottom: 1px solid #F5F7F9; }
.date-cell { font-weight: 600; color: #1976D2; }
.leader-cell { color: #37474F; font-weight: 500; }
.attendance-pill { background: #E3F2FD; color: #1976D2; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px; }
.placeholder { padding: 40px; text-align: center; color: #90A4AE; }
</style>