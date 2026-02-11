<script setup>
// Admin Absence Monitoring: listen for reports sent to admin and allow messaging
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useMembersStore } from '../../stores/members'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'


const reports = ref([])
const authStore = useAuthStore()
const membersStore = useMembersStore()

function buildAbsenceNotifications() {
  // kept for compatibility
}

let unsub = null
onMounted(() => {
  if (!authStore.branchId) return
  const colRef = collection(db, 'branches', authStore.branchId, 'notifications')
  const q = query(colRef, orderBy('createdAt', 'desc'))

  unsub = onSnapshot(q, (snap) => {
    const items = []
    snap.docs.forEach(d => {
      const data = d.data()
      if (data.recipientId === 'admin' && typeof data.title === 'string' && data.title.startsWith('Absence Report')) {
        // extract memberId from message if present
        const memberIdMatch = data.message ? data.message.match(/Member ID:\s*(\S+)/m) : null
        const memberId = memberIdMatch ? memberIdMatch[1] : null
        const name = data.title.replace('Absence Report: ', '')
        items.push({ id: d.id, name, memberId, message: data.message || '', createdAt: data.createdAt })
      }
    })
    reports.value = items
  })
})

onUnmounted(() => { if (unsub) unsub() })

function messageReportedMember(memberId) {
  const mem = (membersStore.activeMembers || []).find(m => m.id === memberId)
  if (!mem || !mem.email) {
    alert('Member email not found.')
    return
  }
  const subject = encodeURIComponent(`Checking in — ${mem.firstName} ${mem.lastName}`)
  const body = encodeURIComponent(`Hi ${mem.firstName},\n\nWe noticed you've missed recent services. We hope all is well.\n\nRegards,\nAdmin`)
  window.location.href = `mailto:${mem.email}?subject=${subject}&body=${body}`
}

async function deleteReport(reportId) {
  if (!authStore.branchId) {
    alert('Branch not set; cannot delete report.')
    return
  }
  if (!confirm('Delete this report? This cannot be undone.')) return

  try {
    const reportRef = doc(db, 'branches', authStore.branchId, 'notifications', reportId)
    await deleteDoc(reportRef)
    // Optimistically remove from local list; onSnapshot will update too
    reports.value = reports.value.filter(r => r.id !== reportId)
  } catch (err) {
    console.error('Failed to delete report', err)
    alert('Failed to delete report.')
  }
}

defineExpose({ buildAbsenceNotifications })
</script>

<template>
  <div class="absence-monitoring-wrapper">
    <h4>Reported Absences</h4>
    <div v-if="!reports.length" class="empty-list-msg">No recent reports.</div>

    <div v-else class="monitoring-cards">
      <div v-for="r in reports" :key="r.id" class="report-card list-card">
        <div class="card-list">
          <div class="report-name">{{ r.name }}</div>
          <div class="report-meta">ID: {{ r.memberId || '—' }}</div>
          <pre class="report-message">{{ r.message }}</pre>
          <div class="report-actions">
            <button v-if="r.memberId" class="message-btn" @click="messageReportedMember(r.memberId)">Message</button>
            <button class="delete-btn" @click="deleteReport(r.id)">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.absence-monitoring-placeholder {
  padding: 18px;
  color: #374151;
  background: #ffffff;
}

/* Reports list */
.absence-monitoring-wrapper { padding: 12px; }
.monitoring-cards { display:flex; gap:12px; overflow-x:auto; }
.list-card { background:white; border:1px solid #E2E8F0; border-radius:12px; padding:12px; min-width:320px; }
.report-name { font-weight:700; color:#1E293B }
.report-meta { font-size:12px; color:#64748B }
.report-message { background:#FAFAFA; padding:8px; border-radius:8px; white-space:pre-wrap; font-size:13px; color:#374151 }
.report-actions { display:flex; justify-content:flex-end; margin-top:8px }
.message-btn { background:#1976D2; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer }
.delete-btn { background:#E11D48; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; margin-left:8px }
.delete-btn:hover { background:#BE123C }
.message-btn:focus, .delete-btn:focus { outline:2px solid rgba(25,118,210,0.18); outline-offset:2px }
</style>
