<script setup>
// Admin Absence Monitoring: listen for reports sent to admin and allow messaging
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { useMembersStore } from '../../stores/members'
import { useAttendanceStore } from '../../stores/attendance'
import { useChatStore } from '../../stores/chat'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore'


const reports = ref([])
const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()
const { currentEventAttendees } = storeToRefs(attendanceStore)
const chatStore = useChatStore()

const presentMemberIds = computed(() => {
  return new Set((currentEventAttendees.value || []).map(att => att.memberId).filter(Boolean))
})

function buildAbsenceNotifications() {
  // kept for compatibility
}

let unsub = null
onMounted(() => {
  if (!authStore.branchId || !authStore.user?.uid) return
  // Listen to branch-level absence reports collection
  const colRef = collection(db, 'branches', authStore.branchId, 'absenceReports')
  const q = query(colRef, orderBy('createdAt', 'desc'))

  unsub = onSnapshot(q, (snap) => {
    reports.value = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        name: data.memberName || 'Unknown Member',
        memberId: data.memberId || null,
        message: data.reportDetails || '',
        createdAt: data.createdAt
      }
    })
  })
})

watch([presentMemberIds, reports], async ([memberIds]) => {
  if (!memberIds.size || !reports.value.length || !authStore.branchId) return

  const resolvedReports = reports.value.filter(report => report.memberId && memberIds.has(report.memberId))
  if (!resolvedReports.length) return

  try {
    await Promise.all(resolvedReports.map(report => {
      const reportRef = doc(db, 'branches', authStore.branchId, 'absenceReports', report.id)
      return deleteDoc(reportRef)
    }))

    reports.value = reports.value.filter(report => !report.memberId || !memberIds.has(report.memberId))
  } catch (err) {
    console.error('Failed to auto-remove resolved absence reports', err)
  }
}, { immediate: true })

onUnmounted(() => { if (unsub) unsub() })

async function archiveMember(memberId, reportId) {
  const mem = (membersStore.activeMembers || []).find(m => m.id === memberId)
  if (!mem) {
    alert('Member not found.')
    return
  }
  const confirmed = confirm(`Are you sure you want to archive ${mem.firstName} ${mem.lastName}? This member will no longer appear in attendance records.`)
  if (!confirmed) return

  try {
    if (!authStore.branchId || !authStore.user?.uid) {
      alert('Branch or user not set; cannot archive member.')
      return
    }
    const memberRef = doc(db, 'branches', authStore.branchId, 'members', memberId)
    await updateDoc(memberRef, {
      status: 'archived',
      archivedAt: new Date(),
      archivedBy: authStore.userProfile?.id || 'unknown'
    })

    // Delete the report after successful archiving
    if (reportId) {
      const reportRef = doc(db, 'branches', authStore.branchId, 'absenceReports', reportId)
      await deleteDoc(reportRef)
      reports.value = reports.value.filter(r => r.id !== reportId)
    }

    alert(`${mem.firstName} ${mem.lastName} has been archived.`)
    membersStore.fetchMembers && membersStore.fetchMembers()
  } catch (err) {
    console.error('Failed to archive member', err)
    alert(`Failed to archive ${mem.firstName} ${mem.lastName}.`)
  }
}

async function deleteReport(reportId) {
  if (!authStore.branchId || !authStore.user?.uid) {
    alert('Branch or user not set; cannot delete report.')
    return
  }
  if (!confirm('Delete this report? This cannot be undone.')) return

  try {
    const reportRef = doc(db, 'branches', authStore.branchId, 'absenceReports', reportId)
    await deleteDoc(reportRef)
    // Optimistically remove from local list; onSnapshot will update too
    reports.value = reports.value.filter(r => r.id !== reportId)
  } catch (err) {
    console.error('Failed to delete report', err)
    alert('Failed to delete report.')
  }
}

function messageMemeber(memberId, memberName) {
  if (!memberId) {
    alert('Member ID not available.')
    return
  }
  
  // Create a minimal member object with the memberId
  const memberForChat = { 
    id: memberId, 
    firstName: memberName || 'Unknown',
    lastName: '',
    profilePicture: ''
  }
  
  chatStore.openPrivateChatWith(memberForChat)
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
           <button v-if="r.memberId" class="message-btn" @click="messageMemeber(r.memberId, r.name)">Message</button>
            <button v-if="r.memberId" class="archive-btn" @click="archiveMember(r.memberId, r.id)">Archive Member</button>
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
.report-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px }
.message-btn { background:#1976D2; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer }
.message-btn:hover { background:#1565C0; opacity:0.8 }
.message-btn:focus { outline:2px solid rgba(25,118,210,0.18); outline-offset:2px }
.archive-btn { background:#d21919; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer }
.delete-btn { background:transparent; color:#64748B; border:1px solid #CBD5E1; padding:8px 12px; border-radius:8px; cursor:pointer }
.archive-btn:hover { background:#d21919; opacity:0.8 }
.delete-btn:hover { background:#F1F5F9; color:#475569 }
.archive-btn:focus, .delete-btn:focus { outline:2px solid rgba(25,118,210,0.18); outline-offset:2px }
</style>
