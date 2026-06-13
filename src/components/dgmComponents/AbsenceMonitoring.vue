<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { useMembersStore } from '../../stores/members'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'
import { useChatStore } from '../../stores/chat'
import { useNotificationsStore } from '../../stores/notifications'
import { db } from '../../firebase'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()
const chatStore = useChatStore()
const notificationsStore = useNotificationsStore()

const { currentEventAttendees } = storeToRefs(attendanceStore)

const reports = ref([])
const isLoading = ref(true)
const selectedReportDetail = ref(null)
const recentlyArchivedCount = ref(0)
const recentlyArchivedIds = ref(new Set())
const showRecentlyArchived = ref(false)
const lastProcessedEventId = ref(null)
let unsub = null

const presentMemberIds = computed(() => {
  return new Set((currentEventAttendees.value || []).map(att => att.memberId).filter(Boolean))
})

const pastEvents = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  return eventsStore.allEvents
    .filter(e => e.date <= todayStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// O(1) Lookup for attendance across all events
const attendanceLookup = computed(() => {
  const lookup = new Set()
  if (attendanceStore.allAttendance) {
    for (const a of attendanceStore.allAttendance) {
      lookup.add(`${a.eventId}_${a.memberId}`)
    }
  }
  return lookup
})

const visibleReports = computed(() => {
  const archivedIds = new Set((membersStore.archivedMembers || []).map(m => m.id))
  return reports.value.filter(report => {
    if (!report.memberId) return true
    return !archivedIds.has(report.memberId) && !recentlyArchivedIds.value.has(report.memberId)
  })
})

const recentlyArchivedMembers = computed(() => {
  const archivedIds = recentlyArchivedIds.value
  return (membersStore.archivedMembers || [])
    .filter(member => archivedIds.has(member.id))
    .map(member => ({
      id: member.id,
      name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.displayName || 'Unknown Member',
      leader: member.dgroupLeader || 'None',
      archivedAt: member.archivedAt || null
    }))
})

const enrichedReports = computed(() => {
  return visibleReports.value
    .map(report => {
    const member = membersStore.activeMembers.find(m => m.id === report.memberId) || {
      firstName: report.name.split(' ')[0],
      lastName: report.name.split(' ').slice(1).join(' '),
      dgroupLeader: 'Unknown',
      createdAt: null
    }

    // 6-event streak for the main table (oldest to newest for visual flow)
    const last6Events = pastEvents.value.slice(0, 6)
    const streak = last6Events.map(ev => {
      const isPresent = attendanceLookup.value.has(`${ev.id}_${report.memberId}`)
      return { status: isPresent ? 'present' : 'absent', eventName: ev.name }
    }).reverse()

    let lastPresentEvent = null
    for (const ev of pastEvents.value) {
      if (attendanceLookup.value.has(`${ev.id}_${report.memberId}`)) {
        lastPresentEvent = ev
        break
      }
    }

    const last7Events = pastEvents.value.slice(0, 7).map(ev => {
      return {
        id: ev.id,
        date: ev.date,
        name: ev.name,
        status: attendanceLookup.value.has(`${ev.id}_${report.memberId}`) ? 'present' : 'absent'
      }
    })

      return {
        ...report,
        member,
        dleader: member.dgroupLeader || 'None',
        streak,
        lastPresentEvent,
        last7Events,
        joinedDate: member.createdAt
      }
    })
})

async function deleteReportsForMember(memberId) {
  if (!authStore.branchId || !memberId) return

  try {
    const reportsCol = collection(db, 'branches', authStore.branchId, 'absenceReports')
    const q = query(reportsCol, where('memberId', '==', memberId))
    const snap = await getDocs(q)

    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    reports.value = reports.value.filter(report => report.memberId !== memberId)

    if (selectedReportDetail.value?.memberId === memberId) {
      selectedReportDetail.value = null
    }
  } catch (err) {
    console.error('Failed to delete archived member reports', err)
  }
}

async function buildAbsenceNotifications(triggerEventId = null) {
  await sendAbsenceThresholdNotifications(triggerEventId)
  await runAutoArchival()
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function getMemberConsecutiveAbsences(member, excludeEventId = null) {
  const memberJoinDate = member?.createdAt ? parseDateOnly(member.createdAt) : null
  let consecutive = 0

  for (const ev of pastEvents.value) {
    if (excludeEventId && ev.id === excludeEventId) continue

    const evDate = parseDateOnly(ev.date)
    if (memberJoinDate && evDate && evDate < memberJoinDate) {
      continue
    }

    if (attendanceLookup.value.has(`${ev.id}_${member.id}`)) {
      break
    }
    consecutive++
  }

  return consecutive
}

async function sendAbsenceThresholdNotifications(triggerEventId = null) {
  const sweepKey = triggerEventId || eventsStore.currentEvent?.id || null
  if (sweepKey && lastProcessedEventId.value === sweepKey) return
  if (sweepKey) lastProcessedEventId.value = sweepKey

  if (!authStore.branchId) return

  const tasks = []
  const thresholds = [3, 4, 5, 6, 7]

  for (const member of membersStore.activeMembers || []) {
    const consecutiveBefore = getMemberConsecutiveAbsences(member, sweepKey)
    const consecutiveAfter = getMemberConsecutiveAbsences(member)
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.displayName || 'Member'

    for (const threshold of thresholds) {
      if (consecutiveBefore < threshold && consecutiveAfter >= threshold) {
        tasks.push(
          notificationsStore.notifyMemberAbsenceThreshold(authStore.branchId, member.id, memberName, threshold)
        )
        break
      }
    }
  }

  if (tasks.length) {
    await Promise.all(tasks)
  }
}

async function runAutoArchival() {
  if (pastEvents.value.length < 7) return
  
  const top7Events = pastEvents.value.slice(0, 7)
  const toArchiveIds = []

  // Check all active members
  for (const member of membersStore.activeMembers) {
    // Only check if they have been a member longer than the oldest event in this 7-event window
    const joinedDate = member.createdAt ? new Date(member.createdAt) : new Date('2000-01-01')
    const oldestEventDate = new Date(top7Events[6].date)
    
    if (joinedDate > oldestEventDate) continue

    let missedAll = true
    for (const ev of top7Events) {
      if (attendanceLookup.value.has(`${ev.id}_${member.id}`)) {
        missedAll = false
        break
      }
    }

    if (missedAll) {
      toArchiveIds.push(member.id)
    }
  }

  // Execute archival
  const archivedThisRun = []
  for (const memberId of toArchiveIds) {
    console.log(`Auto-archiving member ${memberId} due to 7 consecutive absences.`)
    const member = membersStore.activeMembers.find(m => m.id === memberId)
    await membersStore.archiveMember(memberId)
    archivedThisRun.push(memberId)

    if (member) {
      const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.displayName || 'Member'
      await notificationsStore.notifyMemberArchived(authStore.branchId, memberId, memberName)
    }

    recentlyArchivedIds.value = new Set([...recentlyArchivedIds.value, memberId])
    await deleteReportsForMember(memberId)
  }

  recentlyArchivedCount.value = archivedThisRun.length
  showRecentlyArchived.value = archivedThisRun.length > 0
}

onMounted(async () => {
  if (!authStore.branchId || !authStore.user?.uid) return
  
  // Wait for necessary stores to load their full data for accurate evaluation
  await Promise.all([
    eventsStore.fetchEvents(),
    attendanceStore.fetchAllAttendance()
  ])

  // Process Auto-Archival in the background
  await runAutoArchival()

  isLoading.value = false

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

watch(visibleReports, (nextReports) => {
  if (!selectedReportDetail.value) return
  const stillVisible = nextReports.some(report => report.id === selectedReportDetail.value?.id)
  if (!stillVisible) {
    selectedReportDetail.value = null
  }
}, { immediate: true })

// Auto-resolve flags if the member attends the current event
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
    if (selectedReportDetail.value && memberIds.has(selectedReportDetail.value.memberId)) {
      selectedReportDetail.value = null
    }
  } catch (err) {
    console.error('Failed to auto-remove resolved absence reports', err)
  }
}, { immediate: true })

onUnmounted(() => { if (unsub) unsub() })

async function archiveMember(memberId, reportId) {
  const mem = (membersStore.activeMembers || []).find(m => m.id === memberId)
  if (!mem) {
    alert('Member not found. They may have already been archived.')
    if (reportId) await deleteReport(reportId, true)
    selectedReportDetail.value = null
    return
  }

  const confirmed = confirm(`Are you sure you want to archive ${mem.firstName} ${mem.lastName}? This member will no longer appear in active attendance records.`)
  if (!confirmed) return

  try {
    const memberName = `${mem.firstName || ''} ${mem.lastName || ''}`.trim() || mem.displayName || 'Member'
    await membersStore.archiveMember(memberId)
    await notificationsStore.notifyMemberArchived(authStore.branchId, memberId, memberName)

    // Delete the report after successful archiving
    if (reportId) {
      await deleteReport(reportId, true)
    }

    alert(`${mem.firstName} ${mem.lastName} has been archived.`)
    selectedReportDetail.value = null
  } catch (err) {
    console.error('Failed to archive member', err)
    alert(`Failed to archive ${mem.firstName} ${mem.lastName}.`)
  }
}

async function deleteReport(reportId, silent = false) {
  if (!authStore.branchId || !authStore.user?.uid) {
    if (!silent) alert('Branch or user not set; cannot delete report.')
    return
  }
  if (!silent && !confirm('Delete this report? This will clear the flag without archiving the member.')) return

  try {
    const reportRef = doc(db, 'branches', authStore.branchId, 'absenceReports', reportId)
    await deleteDoc(reportRef)
    reports.value = reports.value.filter(r => r.id !== reportId)
    if (selectedReportDetail.value?.id === reportId) {
      selectedReportDetail.value = null
    }
  } catch (err) {
    console.error('Failed to delete report', err)
    if (!silent) alert('Failed to delete report.')
  }
}

function messageMember(memberId, memberName) {
  if (!memberId) {
    alert('Member ID not available.')
    return
  }
  
  const memberForChat = { 
    id: memberId, 
    firstName: memberName || 'Unknown',
    lastName: '',
    profilePicture: ''
  }
  
  chatStore.openPrivateChatWith(memberForChat)
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

defineExpose({ buildAbsenceNotifications })
</script>

<template>
  <div class="absence-monitoring-wrapper">
    <div class="header-titles">
      <div class="header-main">
        <h2>Flagged Absences</h2>
        <button
          v-if="recentlyArchivedCount > 0"
          class="recently-archived-btn"
          type="button"
          @click="showRecentlyArchived = !showRecentlyArchived"
          :aria-expanded="showRecentlyArchived"
          :aria-controls="'recently-archived-panel'"
        >
          Recently archived: {{ recentlyArchivedCount }}
        </button>
      </div>
      <div v-if="showRecentlyArchived && recentlyArchivedMembers.length" id="recently-archived-panel" class="recently-archived-panel">
        <div class="recently-archived-title">Archived this run</div>
        <div class="recently-archived-list">
          <div v-for="member in recentlyArchivedMembers" :key="member.id" class="recently-archived-item">
            <span class="recently-archived-name">{{ member.name }}</span>
            <span class="recently-archived-meta">{{ member.leader }}</span>
          </div>
        </div>
      </div>
      <p>Members reported by DGroup Leaders for prolonged absences. Auto-archival occurs after 7 consecutive missed events.</p>
    </div>

    <div v-if="isLoading" class="loading-state">
      Fetching attendance and cross-checking records...
    </div>

    <template v-else>
      <div v-if="!reports.length" class="empty-list-msg">
        No active absence reports. Members missed by 7 events are automatically cleared.
      </div>

      <!-- MAIN TABLE VIEW -->
      <div v-else-if="!selectedReportDetail" class="table-container">
        <table>
          <thead>
            <tr>
              <th>MEMBER NAME</th>
              <th>DGROUP LEADER</th>
              <th>ATTENDANCE (LAST 6)</th>
              <th>LAST PRESENT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in enrichedReports" :key="report.id" class="clickable-row" @click="selectedReportDetail = report">
              <td class="font-bold text-dark">{{ report.name }}</td>
              <td class="text-gray-600">{{ report.dleader }}</td>
              <td>
                <div class="history-dots">
                  <div 
                    v-for="(eventDetail, i) in report.streak" 
                    :key="i" 
                    class="dot" 
                    :class="eventDetail.status" 
                    :title="`${eventDetail.eventName}: ${eventDetail.status}`"
                  ></div>
                </div>
              </td>
              <td>
                <div class="last-present-info" v-if="report.lastPresentEvent">
                  <span class="lp-date">{{ formatDate(report.lastPresentEvent.date) }}</span>
                  <span class="lp-event">{{ report.lastPresentEvent.name }}</span>
                </div>
                <div class="last-present-info text-gray-600 italic" v-else>
                  No recent records
                </div>
              </td>
              <td @click.stop>
                <button class="message-btn" @click="messageMember(report.memberId, report.name)">
                  Message
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MEMBER DETAIL VIEW -->
      <div v-else class="member-detail-view">
        <button class="back-btn" @click="selectedReportDetail = null">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to List
        </button>

        <div class="member-detail-header">
          <h3>{{ selectedReportDetail.name }}</h3>
          <p>
            Member ID: <strong>{{ selectedReportDetail.memberId }}</strong> | 
            Member Since: <strong>{{ formatDate(selectedReportDetail.joinedDate) }}</strong> | 
            DGroup Leader: <strong>{{ selectedReportDetail.dleader }}</strong>
          </p>
          <div class="last-present-box" v-if="selectedReportDetail.lastPresentEvent">
            <strong>Last present:</strong> {{ formatDate(selectedReportDetail.lastPresentEvent.date) }} - {{ selectedReportDetail.lastPresentEvent.name }}
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>EVENT NAME</th>
                <th>ATTENDANCE STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in selectedReportDetail.last7Events" :key="event.id">
                <td class="text-gray-600">{{ formatDate(event.date) }}</td>
                <td class="font-bold text-dark">{{ event.name }}</td>
                <td>
                  <div class="status-badge" :class="event.status">
                    <span class="icon" v-if="event.status === 'present'">✓</span>
                    <span class="icon" v-else-if="event.status === 'absent'">×</span>
                    {{ event.status === 'present' ? 'Present' : 'Absent' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="detail-actions mt-4">
          <button class="archive-btn" @click="archiveMember(selectedReportDetail.memberId, selectedReportDetail.id)">
            Archive Member
          </button>
          <button class="delete-btn" @click="deleteReport(selectedReportDetail.id)">
            Dismiss Flag
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.absence-monitoring-wrapper { padding: 12px; }
.header-titles { margin-bottom: 24px; }
.header-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.header-titles h2 { font-size: 20px; font-weight: 700; color: #263238; margin: 0 0 4px 0; }
.header-titles p { font-size: 14px; color: #546E7A; margin: 0; }
.recently-archived-btn { border: 1px solid #BBDEFB; background: #E3F2FD; color: #1565C0; font-size: 12px; font-weight: 700; padding: 8px 12px; border-radius: 999px; cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; }
.recently-archived-btn:hover { background: #DCEFFF; transform: translateY(-1px); }
.recently-archived-panel { margin: 10px 0 14px; border: 1px solid #E3F2FD; background: #F8FBFF; border-radius: 12px; padding: 12px; }
.recently-archived-title { font-size: 12px; font-weight: 800; color: #1565C0; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
.recently-archived-list { display: grid; gap: 8px; }
.recently-archived-item { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; background: #fff; border: 1px solid #EAF2FF; border-radius: 10px; }
.recently-archived-name { font-size: 13px; font-weight: 700; color: #263238; }
.recently-archived-meta { font-size: 12px; color: #607D8B; white-space: nowrap; }

.loading-state, .empty-list-msg { 
  text-align: center; 
  padding: 32px; 
  color: #546E7A; 
  background: #F8FAFC; 
  border-radius: 8px; 
  font-size: 14px; 
}

/* Table General */
.table-container { border: 1px solid #ECEFF1; border-radius: 8px; overflow: hidden; background: white;}
table { width: 100%; border-collapse: collapse; min-width: 600px; }
th { background: #F8FAFC; color: #546E7A; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 14px 16px; text-align: left; border-bottom: 2px solid #ECEFF1; }
td { padding: 12px 16px; border-bottom: 1px solid #ECEFF1; font-size: 14px; vertical-align: middle; }
.font-bold { font-weight: 700; }
.text-dark { color: #263238; }
.text-gray-600 { color: #475569; }
.italic { font-style: italic; }

.clickable-row { cursor: pointer; transition: background-color 0.2s ease; }
.clickable-row:hover { background-color: #F8FAFC; }

/* Status & Dots */
.history-dots { display: flex; gap: 4px; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.present { background-color: #2E7D32; }
.dot.absent { background-color: #E53935; }

.status-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
.status-badge.present { background: #E8F5E9; color: #2E7D32; }
.status-badge.absent { background: #FFEBEE; color: #C62828; }
.status-badge .icon { font-size: 14px; font-weight: bold; }

.last-present-info { display: flex; flex-direction: column; gap: 2px; }
.lp-date { font-weight: 600; font-size: 13px; color: #374151; }
.lp-event { font-size: 12px; color: #64748B; }

/* Buttons */
.message-btn { background:#1976D2; color:white; border:none; padding:8px 16px; font-size:13px; font-weight: 600; border-radius:8px; cursor:pointer; transition: 0.2s; }
.message-btn:hover { background:#1565C0; opacity:0.9; }

/* Detail View Custom Styling */
.member-detail-view { animation: slideIn 0.3s ease; }
.back-btn { 
  display: inline-flex; align-items: center; gap: 4px; 
  background: none; border: none; color: #546E7A; 
  font-size: 14px; font-weight: 600; cursor: pointer; 
  padding: 0; margin-bottom: 16px; transition: color 0.2s;
}
.back-btn:hover { color: #2962FF; }

.member-detail-header {
  background: #F8FAFC; border: 1px solid #ECEFF1; 
  border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;
}
.member-detail-header h3 { margin: 0 0 6px 0; font-size: 18px; color: #0F172A; }
.member-detail-header p { margin: 0; font-size: 14px; color: #475569; }

.last-present-box { 
  margin-top: 12px; 
  padding: 10px 14px; 
  background: #E3F2FD; 
  border-left: 3px solid #2196F3; 
  border-radius: 4px; 
  font-size: 13px; 
  color: #0D47A1; 
}

.detail-actions { display: flex; gap: 12px; justify-content: flex-end; }
.archive-btn { background:#D32F2F; color:white; border:none; padding:10px 16px; font-weight: 600; border-radius:8px; cursor:pointer; transition: 0.2s; }
.delete-btn { background:transparent; color:#64748B; border:1px solid #CBD5E1; padding:10px 16px; font-weight: 600; border-radius:8px; cursor:pointer; transition: 0.2s; }
.archive-btn:hover { background:#B71C1C; }
.delete-btn:hover { background:#F1F5F9; color:#475569; }
.mt-4 { margin-top: 16px; }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>