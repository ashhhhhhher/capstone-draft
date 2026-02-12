<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { db } from '../../firebase'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { useMembersStore } from '../../stores/members'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()

const isLoading = ref(true)
const messagedMembers = ref(new Set())
const reportedMembers = ref(new Set())

onMounted(async () => {
  membersStore.fetchMembers && membersStore.fetchMembers()
  eventsStore.fetchEvents && eventsStore.fetchEvents()

  if (attendanceStore.fetchAllAttendance) {
    await attendanceStore.fetchAllAttendance()
  }

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

/* ------------------------------------------
   PAST EVENTS (NEWEST FIRST)
-------------------------------------------*/

function pastEventsOfType(type) {
  return (allEvents.value || [])
    .filter(e => e.eventType === type)
    .filter(e => e.ended === true)
    .sort((a, b) => getEventDateTime(b) - getEventDateTime(a))
}

/* ------------------------------------------
   MEMBER ATTENDANCE CHECK
   (attendance doc exists under event)
-------------------------------------------*/

function memberAttendedEvent(memberId, eventId) {
  return (allAttendance.value || []).some(a => {
    // When using collectionGroup,
    // you MUST store parent eventId inside attendance doc
    return a.memberId === memberId && a.eventId === eventId
  })
}

/* ------------------------------------------
   CONSECUTIVE ABSENCE
-------------------------------------------*/

function computeConsecutiveAbsencesForMember(member) {
  const type =
    member.finalTags?.ageCategory === 'B1G'
      ? 'b1g_event'
      : 'service'

  const past = pastEventsOfType(type)

  let count = 0

  for (const ev of past) {
    const attended = memberAttendedEvent(member.id, ev.id)

    if (attended) {
      break
    } else {
      count++
    }
  }

  return count
}

/* ------------------------------------------
   LAST SEEN EVENT
-------------------------------------------*/

function findLastSeenEvent(member) {
  const type =
    member.finalTags?.ageCategory === 'B1G'
      ? 'b1g_event'
      : 'service'

  const past = pastEventsOfType(type)

  for (const ev of past) {
    const attended = memberAttendedEvent(member.id, ev.id)

    if (attended) return ev
  }

  return null
}

/* ------------------------------------------
   MONITORED LIST
-------------------------------------------*/

const monitored = computed(() => {
  const rows = (downlineMembers.value || []).map(m => {
    const consecutive = computeConsecutiveAbsencesForMember(m)
    const lastSeenEvent = findLastSeenEvent(m)

    return {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      dgroupLeader: m.dgroupLeader || '',
      email: m.email || '',
      consecutive,
      lastSeenName: lastSeenEvent?.name || '',
      lastSeenDate: lastSeenEvent
        ? getEventDateTime(lastSeenEvent).toLocaleString()
        : null
    }
  })

  return rows
    .filter(r => r.consecutive > 1)
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
import { useNotificationsStore } from '../../stores/notifications'

function messageMember(member) {
  if (!member.email) {
    alert('Member email not found.')
    return
  }
  const subject = encodeURIComponent(`Checking in — ${member.firstName} ${member.lastName}`)
  const body = encodeURIComponent(`Hi ${member.firstName},\n\nWe noticed you've missed recent services. We hope all is well and would love to see you at our next gathering.\n\nRegards,\n${myName.value}`)
  messagedMembers.value.add(member.id)
  window.location.href = `mailto:${member.email}?subject=${subject}&body=${body}`
}

async function reportToAdmin(member) {
  const notificationsStore = useNotificationsStore()
  const title = `Absence Report: ${member.firstName} ${member.lastName}`
  const message = `Member: ${member.firstName} ${member.lastName}\nDGroup Leader: ${member.dgroupLeader || '—'}\nConsecutive absences: ${member.consecutive}\nLast seen: ${member.lastSeenName || 'Never'} ${member.lastSeenDate ? `— ${member.lastSeenDate}` : ''}\nMember ID: ${member.id}`

  try {
    // Prevent duplicate reports: look for an existing admin notification with same title
    if (authStore?.branchId) {
      const colRef = collection(db, 'branches', authStore.branchId, 'notifications')
      // Query for any existing admin notification with same title (no orderBy to avoid composite-index requirements)
      const q = query(colRef, where('recipientId', '==', 'admin'), where('title', '==', title), limit(1))
      const snaps = await getDocs(q)
      if (!snaps.empty) {
        alert('A report for this member has already been submitted.')
        return
      }
    }

    await notificationsStore.sendNotification('admin', title, message, 'alert')
    reportedMembers.value.add(member.id)
    alert(`Report for ${member.firstName} ${member.lastName} sent to admin.`)
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
        Monitoring consecutive absences (WKND / B1G)
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
            </span>
          </div>

          <div class="actions">
            <button
              v-if="m.consecutive >= 3"
              class="message-btn"
              :class="{ 'done': messagedMembers.has(m.id) }"
              :disabled="messagedMembers.has(m.id)"
              @click="messageMember(m)"
            >
              {{ messagedMembers.has(m.id) ? '✓ Messaged' : 'Message' }}
            </button>
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
