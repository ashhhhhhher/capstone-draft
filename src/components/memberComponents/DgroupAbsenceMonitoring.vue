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

function getTodayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
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
   CONSECUTIVE ABSENCE (MAIN EVENTS + DGROUP)
-------------------------------------------*/

const combinedAttendance = computed(() => {
  return [
    ...(allAttendance.value || []),
    ...(branchAttendanceLogs.value || [])
  ]
    .map(att => ({
      ...att,
      memberId: att?.memberId || att?.id || null
    }))
    .filter(att => !!att.memberId)
})

function eventIsCountable(ev, memberId = null) {
  if (!ev) return false
  if (ev.ended) return true

  const evDate = parseYMD(ev.date)
  if (!evDate) return false

  const today = getTodayStart()

  // Past events are always countable checkpoints.
  if (evDate < today) return true

  // For today's ongoing event, only count it when this member is already marked present.
  // This lets a newly checked-in member drop off the absence list immediately,
  // while avoiding false "absent" counts for members before event end.
  if (memberId && evDate.getTime() === today.getTime()) {
    return memberAttendedMainEvent(memberId, ev)
  }

  return false
}

function meetingIsCountable(meeting) {
  if (!meeting) return false
  if (meeting.ended) return true

  // Count a dgroup checkpoint as soon as a report is submitted,
  // even if the meeting has not been auto-ended yet.
  if (meeting.submittedBy || meeting.submittedById || meeting.isResubmitted) {
    return true
  }

  const loggingDate = parseYMD(meeting.loggingDate)
  if (loggingDate && loggingDate <= getTodayStart()) {
    return true
  }

  const baseDate = meeting.meetingDate || meeting.loggingDate
  const parsed = parseYMD(baseDate)
  if (!parsed) return false

  return parsed < getTodayStart()
}

function memberAttendedMainEvent(memberId, event) {
  return combinedAttendance.value.some(att => {
    if (att.memberId !== memberId) return false

    if (att.eventId && event?.id) {
      return att.eventId === event.id
    }

    return !!att.dateOnly && !!event?.date && att.dateOnly === event.date
  })
}

function mainEventsForMember(member) {
  const memberType = member.finalTags?.ageCategory === 'B1G' ? 'b1g_event' : 'service'

  // Only count events that happened on or after the member's join/creation date.
  // This prevents newly added members (e.g. bypass sign-ups) from inheriting
  // all historical events as consecutive absences.
  const joinDateStr = member.createdAt
    ? new Date(member.createdAt).toISOString().split('T')[0]
    : null
  const memberJoinDate = parseYMD(joinDateStr)

  return (allEvents.value || [])
    .filter(e => e.eventType === memberType)
    .filter(e => {
      if (memberJoinDate) {
        const evDate = parseYMD(e.date)
        if (evDate && evDate < memberJoinDate) return false
      }
      return eventIsCountable(e, member.id)
    })
    .sort((a, b) => getEventDateTime(b) - getEventDateTime(a))
}

function dgroupMeetingsForCurrentLeader() {
  const leaderId = myProfile.value?.id || null
  const leaderName = myName.value || ''

  return (dgroupMeetingReports.value || [])
    .filter(meeting => {
      if (!meeting) return false
      if (!meetingIsCountable(meeting)) return false

      if (leaderId && meeting.dgroupLeaderId) return meeting.dgroupLeaderId === leaderId
      if (leaderName && meeting.dgroupLeader) return meeting.dgroupLeader === leaderName
      return true
    })
    .sort((a, b) => getMeetingDateTime(b) - getMeetingDateTime(a))
}

function computeConsecutiveSummary(member) {
  const checkpoints = []

  for (const ev of mainEventsForMember(member)) {
    checkpoints.push({
      at: getEventDateTime(ev),
      name: ev.name || (ev.eventType === 'b1g_event' ? 'B1G Event' : 'WKND Event'),
      attended: memberAttendedMainEvent(member.id, ev)
    })
  }

  for (const meeting of dgroupMeetingsForCurrentLeader()) {
    checkpoints.push({
      at: getMeetingDateTime(meeting),
      name: meeting.meetingTitle || 'Dgroup Meeting',
      attended: !!meeting.attendees?.[member.id]?.isPresent
    })
  }
  // Determine member join date for filtering
  const joinDateStr = member.createdAt
    ? new Date(member.createdAt).toISOString().split('T')[0]
    : null
  const memberJoinDate = parseYMD(joinDateStr)

  // Remove checkpoints that pre-date when the member joined the system
  const filteredCheckpoints = memberJoinDate
    ? checkpoints.filter(cp => cp.at >= memberJoinDate)
    : checkpoints

  filteredCheckpoints.sort((a, b) => b.at - a.at)

  let consecutive = 0
  let lastSeen = null

  for (const cp of filteredCheckpoints) {
    if (cp.attended) {
      lastSeen = cp
      break
    }
    consecutive++
  }

  if (!lastSeen) {
    const latestAttendance = combinedAttendance.value
      .filter(att => att.memberId === member.id)
      .sort((a, b) => getAttendanceDateTime(b) - getAttendanceDateTime(a))[0]

    if (latestAttendance) {
      lastSeen = {
        at: getAttendanceDateTime(latestAttendance),
        name: 'WKND / B1G Event'
      }
    }
  }

  return {
    consecutive,
    lastSeen
  }
}

/* ------------------------------------------
   MONITORED LIST
-------------------------------------------*/

const monitored = computed(() => {
  const rows = (downlineMembers.value || []).map(m => {
    const summary = computeConsecutiveSummary(m)
    const lastSeen = summary.lastSeen

    return {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      dgroupLeader: m.dgroupLeader || '',
      email: m.email || '',
      consecutive: summary.consecutive,
      lastSeenName: lastSeen?.name || '',
      lastSeenDate: lastSeen?.at
        ? lastSeen.at.toLocaleString()
        : null
    }
  })

  return rows
    .filter(r => r.consecutive >= 3)
    .sort((a, b) => b.consecutive - a.consecutive)
})

/* ------------------------------------------
   SEVERITY
-------------------------------------------*/

function severityClass(count) {
  if (count >= 5) return 'sev-red'
  if (count === 4) return 'sev-orange'
  if (count === 3) return 'sev-yellow'
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
  const reportDetails = `Member: ${memberName}\nDGroup Leader: ${member.dgroupLeader || '—'}\nConsecutive absences: ${member.consecutive}\nLast seen: ${member.lastSeenName || 'Never'} ${member.lastSeenDate ? `— ${member.lastSeenDate}` : ''}\nMember ID: ${member.id}`

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
      consecutiveAbsences: member.consecutive,
      weeksSinceLastSeen: null,
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
        Monitoring consecutive absences (WKND/B1G + Dgroup Meetings)
        <span class="legend-pill yellow">3</span>
        <span class="legend-pill orange">4</span>
        <span class="legend-pill red">5+</span>
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
          :class="severityClass(m.consecutive)"
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
              <span> ({{ m.consecutive }} consecutive absences)</span>
            </span>
          </div>

          <div class="actions">
            <!--TEMPORARY <button
              v-if="m.consecutive >= 3"
              class="message-btn"
              :class="{ 'done': messagedMembers.has(m.id) }"
              :disabled="messagedMembers.has(m.id)"
              @click="messageMember(m)"
            >
              {{ messagedMembers.has(m.id) ? '✓ Messaged' : 'Message' }}
            </button> -->
            <button
              v-if="m.consecutive >= 5"
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
