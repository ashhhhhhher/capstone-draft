<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { db } from '../../firebase'
import { collection, getDocs, addDoc, serverTimestamp, collectionGroup } from 'firebase/firestore'
import { useMembersStore } from '../../stores/members'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'
import { useNotificationsStore } from '../../stores/notifications'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()
const chatStore = useChatStore()
const notificationsStore = useNotificationsStore()

const isLoading = ref(true)
const messagedMembers = ref(new Set())
const reportedMembers = ref(new Set())
const dgroupMeetingReports = ref([])
const branchAttendanceLogs = ref([])

onMounted(async () => {
  await Promise.all([
    membersStore.fetchMembers ? membersStore.fetchMembers() : Promise.resolve(),
    eventsStore.fetchEvents ? eventsStore.fetchEvents() : Promise.resolve(),
    attendanceStore.fetchAllAttendance ? attendanceStore.fetchAllAttendance() : Promise.resolve(),
    fetchDgroupMeetingReports(),
    fetchBranchAttendanceLogs()
  ])

  setTimeout(() => {
    isLoading.value = false
  }, 350)
})

/* ------------------------------------------
   PROFILE
-------------------------------------------*/

const myProfile = computed(() => authStore.userProfile)

const myName = computed(() =>
  myProfile.value
    ? `${myProfile.value.firstName} ${myProfile.value.lastName}`
    : ''
)

const downlineMembers = computed(() => {
  if (!myProfile.value) return []
  return (membersStore.activeMembers || []).filter(
    m =>
      m.dgroupLeader === myName.value &&
      m.id !== myProfile.value.id
  )
})

/* ------------------------------------------
   EVENTS
-------------------------------------------*/

const allEvents = computed(() => eventsStore.allEvents || [])
const allAttendance = computed(() => attendanceStore.allAttendance || [])

/* ------------------------------------------
   DATE HELPERS
-------------------------------------------*/

function parseYMD(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function weeksSinceDate(dateObj) {
  if (!dateObj) return Number.POSITIVE_INFINITY
  const diffMs = Date.now() - dateObj.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
}

/* ------------------------------------------
   DGROUP MEETING REPORTS
-------------------------------------------*/

async function fetchDgroupMeetingReports() {
  if (!authStore.branchId) return

  try {
    const snapshot = await getDocs(collectionGroup(db, 'meetings'))
    const rows = []

    snapshot.forEach(docSnap => {
      const path = docSnap.ref.path
      if (!path.includes(`branches/${authStore.branchId}/dgroupEvents/`)) return

      const data = docSnap.data() || {}
      const hasAttendance = data.attendees && typeof data.attendees === 'object'
      if (!hasAttendance) return

      rows.push({ id: docSnap.id, ...data })
    })

    dgroupMeetingReports.value = rows
  } catch (err) {
    console.error('Failed to fetch dgroup meeting reports', err)
    dgroupMeetingReports.value = []
  }
}

async function fetchBranchAttendanceLogs() {
  if (!authStore.branchId) return

  try {
    const snapshot = await getDocs(
      collection(db, 'branches', authStore.branchId, 'attendance')
    )

    const rows = []
    snapshot.forEach(docSnap => {
      const data = docSnap.data() || {}
      rows.push({
        id: docSnap.id,
        memberId: data.memberId || docSnap.id,
        ...data
      })
    })

    branchAttendanceLogs.value = rows
  } catch (err) {
    console.error('Failed to fetch branch attendance logs', err)
    branchAttendanceLogs.value = []
  }
}

/* ------------------------------------------
   SAFE DATETIME
-------------------------------------------*/

function getEventDateTime(ev) {
  if (ev.endedAt?.toDate) return ev.endedAt.toDate()

  if (ev.date && ev.time) {
    return new Date(`${ev.date}T${ev.time}`)
  }

  if (ev.date) return new Date(ev.date)

  return new Date(0)
}

function getMeetingDateTime(meeting) {
  if (meeting.submittedAt?.toDate) {
    return meeting.submittedAt.toDate()
  }

  const ymd = meeting.meetingDate || meeting.loggingDate
  const parsed = parseYMD(ymd)
  if (parsed) return parsed

  return new Date(0)
}

function getAttendanceDateTime(att) {
  if (att?.timestamp?.toDate) {
    return att.timestamp.toDate()
  }

  const byDateOnly = parseYMD(att?.dateOnly)
  if (byDateOnly) return byDateOnly

  return new Date(0)
}

/* ------------------------------------------
   PAST EVENTS (NEWEST FIRST)
-------------------------------------------*/

const eventById = computed(() => {
  const map = new Map()
  for (const ev of allEvents.value || []) {
    if (ev?.id) map.set(ev.id, ev)
  }
  return map
})

function findLatestMainEventAttendance(member) {
  const memberId = member?.id
  if (!memberId) return null

  const combined = [
    ...(allAttendance.value || []),
    ...(branchAttendanceLogs.value || [])
  ]

  let latest = null

  for (const att of combined) {
    const attMemberId = att?.memberId || att?.id
    if (attMemberId !== memberId) continue

    const linkedEvent = att?.eventId ? eventById.value.get(att.eventId) : null

    // Prefer explicit WKND/B1G event links when available.
    // If no event link exists (branch attendance docs), still count as attended.
    const isTrackedEvent =
      !linkedEvent ||
      linkedEvent.eventType === 'service' ||
      linkedEvent.eventType === 'b1g_event'

    if (!isTrackedEvent) continue

    const seenAt = linkedEvent ? getEventDateTime(linkedEvent) : getAttendanceDateTime(att)
    if (!latest || seenAt > latest.seenAt) {
      latest = {
        seenAt,
        name: linkedEvent?.name || 'WKND / B1G Event'
      }
    }
  }

  return latest
}

/* ------------------------------------------
   LAST SEEN (ANY ATTENDED: DGROUP / WKND / B1G)
-------------------------------------------*/

function findLastSeenRecord(member) {
  let latest = findLatestMainEventAttendance(member)

  for (const meeting of dgroupMeetingReports.value || []) {
    const att = meeting.attendees?.[member.id]
    if (!att?.isPresent) continue

    const seenAt = getMeetingDateTime(meeting)
    if (!latest || seenAt > latest.seenAt) {
      latest = {
        seenAt,
        name: meeting.meetingTitle || 'Dgroup Meeting'
      }
    }
  }

  return latest
}

/* ------------------------------------------
   MONITORED LIST
-------------------------------------------*/

const monitored = computed(() => {
  const rows = (downlineMembers.value || []).map(m => {
    const lastSeen = findLastSeenRecord(m)
    const weeksSinceLastSeen = weeksSinceDate(lastSeen?.seenAt || null)

    return {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      dgroupLeader: m.dgroupLeader || '',
      email: m.email || '',
      weeksSinceLastSeen,
      lastSeenName: lastSeen?.name || '',
      lastSeenDate: lastSeen?.seenAt
        ? lastSeen.seenAt.toLocaleString()
        : null
    }
  })

  return rows
    .filter(r => r.weeksSinceLastSeen >= 4)
    .sort((a, b) => b.weeksSinceLastSeen - a.weeksSinceLastSeen)
})

/* ------------------------------------------
   SEVERITY
-------------------------------------------*/

function severityClass(count) {
  if (count >= 6) return 'sev-red'
  if (count === 5) return 'sev-orange'
  if (count === 4) return 'sev-yellow'
  return ''
}

/* ------------------------------------------
   ACTIONS: message and report
-------------------------------------------*/
function messageMember(member) {
  if (!member.id) {
    alert('Member ID not found.')
    return
  }
  
  // Create a minimal member object with the memberId for chat
  const memberForChat = { 
    id: member.id, 
    firstName: member.firstName || 'Unknown',
    lastName: member.lastName || '',
    profilePicture: ''
  }
  
  // Open a private chat with the member
  chatStore.openPrivateChatWith(memberForChat)
  messagedMembers.value.add(member.id)
}

async function reportToAdmin(member) {
  const memberName = `${member.firstName} ${member.lastName}`
  const reportDetails = `Member: ${memberName}\nDGroup Leader: ${member.dgroupLeader || '—'}\nWeeks since last seen: ${Number.isFinite(member.weeksSinceLastSeen) ? member.weeksSinceLastSeen : '6+'}\nLast seen: ${member.lastSeenName || 'Never'} ${member.lastSeenDate ? `— ${member.lastSeenDate}` : ''}\nMember ID: ${member.id}`

  try {
    // Prevent duplicate reports
    if (!authStore?.branchId) {
      alert('Branch ID not found.')
      return
    }

    const reportsRef = collection(db, 'branches', authStore.branchId, 'absenceReports')

    await addDoc(reportsRef, {
      type: 'ABSENCE_REPORT',
      memberId: member.id,
      memberName,
      dgroupLeader: member.dgroupLeader || '',
      consecutiveAbsences: Number.isFinite(member.weeksSinceLastSeen) ? member.weeksSinceLastSeen : 999,
      weeksSinceLastSeen: Number.isFinite(member.weeksSinceLastSeen) ? member.weeksSinceLastSeen : null,
      lastSeenName: member.lastSeenName || '',
      lastSeenDate: member.lastSeenDate || null,
      reportDetails,
      status: 'open',
      reportedBy: authStore.userProfile?.id || null,
      createdAt: serverTimestamp()
    })

    // Keep admin notifications for compatibility while storing the canonical report doc.
    await notificationsStore.notifyAdminsAbsenceReport(
      authStore.branchId,
      memberName,
      reportDetails
    )

    reportedMembers.value.add(member.id)
    alert(`Report for ${memberName} sent to admin.`)
  } catch (err) {
    console.error('Failed to send report', err)
    alert(`Failed to send report for ${member.firstName} ${member.lastName}.`)
  }
}

</script>

<template>
  <div class="common-list-card">
    <!-- Header Block -->
    <div class="list-header absence-header-block">
      <div class="header-title">
        Absence Monitoring
      </div>

      <div class="absence-sub-inline">
        Monitoring weeks since last attendance (Dgroup / WKND / B1G)
        <span class="legend-pill yellow">4w</span>
        <span class="legend-pill orange">5w</span>
        <span class="legend-pill red">6w+</span>
      </div>
    </div>

    <div v-if="isLoading" class="empty-list-msg">
      Loading monitoring data...
    </div>

    <div v-else>
      <div v-if="!monitored.length" class="empty-list-msg">
        All members are attending regularly 🎉
      </div>

      <div v-else>
        <div
          v-for="m in monitored"
          :key="m.id"
          class="list-item absence-item"
          :class="severityClass(m.weeksSinceLastSeen)"
        >
          <div class="info-col">
            <span class="name">
              {{ m.firstName }} {{ m.lastName }}
            </span>

            <span class="status">
              Last seen:
              <strong v-if="m.lastSeenName">
                {{ m.lastSeenName }}
              </strong>
              <span v-if="m.lastSeenName"> — </span>
              {{ m.lastSeenDate || 'Never' }}
              <span>
                ({{ Number.isFinite(m.weeksSinceLastSeen) ? `${m.weeksSinceLastSeen} week(s) ago` : 'Never attended yet' }})
              </span>
            </span>
          </div>

          <div class="actions">
            <button
              v-if="m.weeksSinceLastSeen >= 4"
              class="message-btn"
              :class="{ 'done': messagedMembers.has(m.id) }"
              :disabled="messagedMembers.has(m.id)"
              @click="messageMember(m)"
            >
              {{ messagedMembers.has(m.id) ? '✓ Messaged' : 'Message' }}
            </button>
            <button
              v-if="m.weeksSinceLastSeen >= 6"
              class="report-btn"
              :class="{ 'done': reportedMembers.has(m.id) }"
              :disabled="reportedMembers.has(m.id)"
              @click="reportToAdmin(m)"
            >
              {{ reportedMembers.has(m.id) ? '✓ Reported to Admin' : 'Report to Admin' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<style scoped>
/* -----------------------------------
   CARD BASE
------------------------------------ */

.common-list-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
}

/* -----------------------------------
   HEADER BLOCK
------------------------------------ */

.absence-header-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 20px;
  background: #FAFAFA;
  border-bottom: 1px solid #F1F5F9;
}

.header-title {
  font-size: 12px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
}

.absence-sub-inline {
  font-size: 12px;
  color: #64748B;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* -----------------------------------
   LEGEND PILLS
------------------------------------ */

.legend-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 20px;
}

.legend-pill.yellow {
  background: #FFF8E1;
  color: #F9A825;
}

.legend-pill.orange {
  background: #FFF3E0;
  color: #EF6C00;
}

.legend-pill.red {
  background: #FFEBEE;
  color: #C62828;
}

/* -----------------------------------
   LIST ITEMS (FIXED LAYOUT)
------------------------------------ */

.list-item {
  display: flex;                 /* FIX */
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #F1F5F9;
  transition: background 0.2s ease;
  gap: 16px;
}

.info-col {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.info-col .name {
  font-size: 14px;
  font-weight: 600;
  color: #1E293B;
}

.info-col .status {
  font-size: 12px;
  color: #546E7A;
  margin-top: 4px;
}

/* -----------------------------------
   SEVERITY FULL ROW COLORS
------------------------------------ */

.list-item.sev-yellow {
  background: #FFF8E1;
}

.list-item.sev-orange {
  background: #FFF3E0;
}

.list-item.sev-red {
  background: #FFEBEE;
}

.list-item.sev-yellow:hover {
  background: #FFECB3;
}

.list-item.sev-orange:hover {
  background: #FFE0B2;
}

.list-item.sev-red:hover {
  background: #FFCDD2;
}

/* -----------------------------------
   ACTION BUTTON
------------------------------------ */

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-btn {
  background: #1976D2;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.message-btn:hover:not(:disabled) {
  background: #1565C0;
}

.message-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message-btn.done {
  background: #60b663;
}

.report-btn {
  background: #1E293B;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.report-btn:hover:not(:disabled) {
  background: #0F172A;
}

.report-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.report-btn.done {
  background: #60b663;
}

/* Optional: better contrast on red rows */
.list-item.sev-red .report-btn:hover:not(:disabled) {
  background: #991B1B;
}

.list-item.sev-red .report-btn:not(.done) {
  background: #B91C1C;
}

/* -----------------------------------
   EMPTY STATE
------------------------------------ */

.empty-list-msg {
  padding: 48px 20px;
  text-align: center;
  color: #94A3B8;
  font-size: 14px;
  font-style: italic;
}

/* -----------------------------------
   MOBILE FIX
------------------------------------ */

@media (max-width: 520px) {
  .list-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .actions {
    width: 100%;
    margin-top: 8px;
  }

  .report-btn {
    width: 100%;
  }
}

</style>
