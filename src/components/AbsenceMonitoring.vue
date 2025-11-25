<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useNotificationsStore } from '../stores/notifications'

// --- Stores ---
const membersStore = useMembersStore()
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()
const notificationsStore = useNotificationsStore()

const { activeMembers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(eventsStore)
const { allAttendance } = storeToRefs(attendanceStore)


// -------------------------------------------
//  Absence Monitoring Computations
// -------------------------------------------

const todayISO = () => new Date().toISOString().split('T')[0]

function getPastServices() {
  const today = todayISO()
  return allEvents.value
    .filter(e => e.eventType === 'service' && e.date <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

function computeConsecutiveAbsences(member, past) {
  let count = 0
  for (const ev of past) {
    const attended = allAttendance.value.some(
      a => a.eventId === ev.id && a.memberId === member.id
    )
    if (!attended) count++
    else break
  }
  return count
}

function makeRow(member, c, config = {}) {
  return {
    ...member,
    consecutiveAbsences: c,
    typeString: member.finalTags.isDgroupLeader
      ? "Leader"
      : member.finalTags.isRegular
      ? "Regular"
      : "Member",
    statusLabel: config.statusLabel || "",
    statusClass: config.statusClass || "",
    showNotifyLeader: !!config.showNotifyLeader,
    showArchive: !!config.showArchive,
    msgSent: !!member.monitoringState?.msgSentDate,
    leaderNotified: !!member.monitoringState?.leaderNotifiedDate
  }
}

// ---- Computed Groups ----
const monitoring3 = computed(() => {
  const past = getPastServices()
  return activeMembers.value
    .map(m => ({ m, c: computeConsecutiveAbsences(m, past) }))
    .filter(x => x.c === 3)
    .map(x =>
      makeRow(x.m, x.c, {
        statusLabel: "At Risk",
        statusClass: "status-yellow"
      })
    )
})

const monitoring4 = computed(() => {
  const past = getPastServices()
  return activeMembers.value
    .map(m => ({ m, c: computeConsecutiveAbsences(m, past) }))
    .filter(x => x.c === 4)
    .map(x =>
      makeRow(x.m, x.c, {
        statusLabel: "Needs Follow-Up",
        statusClass: "status-orange",
        showNotifyLeader: true
      })
    )
})

const monitoring5Plus = computed(() => {
  const past = getPastServices()
  return activeMembers.value
    .map(m => ({ m, c: computeConsecutiveAbsences(m, past) }))
    .filter(x => x.c >= 5)
    .map(x =>
      makeRow(x.m, x.c, {
        statusLabel: "Inactive",
        statusClass: "status-red",
        showArchive: true
      })
    )
})


// -------------------------------------------
//  Actions
// -------------------------------------------

async function handleMessage(member) {
  if (member.email) {
    window.location.href = `mailto:${member.email}?subject=Checking in - Elevate&body=Hi ${member.firstName}, we noticed you missed a few services. Hope you're okay!`
  }
  await notificationsStore.sendNotification(
    member.id,
    "We missed you!",
    `Hey ${member.firstName}, we noticed you haven't been around lately. Hope to see you soon!`
  )
  await membersStore.logMonitoringAction(member.id, "message")
}

async function handleNotifyLeader(member) {
  if (!member.dgroupLeader) {
    alert("No leader assigned.")
    return
  }
  alert(`Notified leader: ${member.dgroupLeader}`)
  await membersStore.logMonitoringAction(member.id, "notifyLeader")
}

function handleArchive(member) {
  if (confirm(`Archive ${member.firstName}?`)) {
    membersStore.archiveMember(member.id)
  }
}
</script>

<template>
  <div class="absence-monitoring-wrapper">

    <!-- Overview / microcopy (adds urgency) -->
    <div class="monitoring-overview">
      <h2>Attendance Follow-Up Required</h2>
      <p class="monitoring-subtext">Some members have missed three or more gatherings. Please follow up to support their involvement. Immediate action is recommended for the highlighted members.</p>
    </div>

    <div class="monitoring-cards">
      <!-- 3 missed -->
      <div class="list-card list-3">
        <div class="card-title-row">
          <div class="title-left">
            <h4>3 Consecutive Absences — Needs Attention</h4>
            <div class="title-sub">Please Review Soon</div>
          </div>
          <div class="card-count">{{ monitoring3.length }}</div>
        </div>

        <div v-if="!monitoring3.length" class="empty-small">No members in this category.</div>
        <div v-else class="card-list">
          <div v-for="m in monitoring3" :key="m.id" class="monitor-card">
            <div class="mc-header">
              <div class="mc-name">{{ m.firstName }} {{ m.lastName }}</div>
              <div class="mc-email">{{ m.email || 'No email' }}</div>
            </div>

            <div class="mc-info">
              <div class="mc-item">
                <label>Type</label>
                <div class="mc-value">{{ m.typeString }}</div>
                <span class="status-pill status-3">{{ m.statusLabel }}</span>
              </div>

              <div class="mc-item">
                <label>Misses</label>
                <div class="mc-value miss-count">{{ m.consecutiveAbsences }}</div>
              </div>

              <div class="mc-item">
                <label>Leader</label>
                <div class="mc-value">{{ m.dgroupLeader || '—' }}</div>
                <div v-if="m.leaderNotified" class="leader-notified">Leader notified</div>
              </div>
            </div>

            <div class="mc-actions">
              <button v-if="!m.msgSent" class="action-btn message" @click="handleMessage(m)">Message</button>
              <div v-else class="action-done-badge status-yellow">Messaged</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4 missed -->
      <div class="list-card list-4">
        <div class="card-title-row">
          <div class="title-left">
            <h4>4 Absences — Follow Up Soon</h4>
            <div class="title-sub">Needs Immediate Follow-Up</div>
          </div>
          <div class="card-count">{{ monitoring4.length }}</div>
        </div>

        <div v-if="!monitoring4.length" class="empty-small">No members in this category.</div>
        <div v-else class="card-list">
          <div v-for="m in monitoring4" :key="m.id" class="monitor-card">
            <div class="mc-header">
              <div class="mc-name">{{ m.firstName }} {{ m.lastName }}</div>
              <div class="mc-email">{{ m.email || 'No email' }}</div>
            </div>

            <div class="mc-info">
              <div class="mc-item">
                <label>Type</label>
                <div class="mc-value">{{ m.typeString }}</div>
                <span class="status-pill status-4">{{ m.statusLabel }}</span>
              </div>

              <div class="mc-item">
                <label>Misses</label>
                <div class="mc-value miss-count">{{ m.consecutiveAbsences }}</div>
              </div>

              <div class="mc-item">
                <label>Leader</label>
                <div class="mc-value">{{ m.dgroupLeader || '—' }}</div>
                <div v-if="m.leaderNotified" class="leader-notified">Leader notified</div>
              </div>
            </div>

            <div class="mc-actions">
              <button v-if="!m.msgSent" class="action-btn message" @click="handleMessage(m)">Message</button>
              <button v-if="m.showNotifyLeader && !m.leaderNotified" class="action-btn notify" @click="handleNotifyLeader(m)">Notify Leader</button>
              <div v-if="m.msgSent" class="action-done-badge status-yellow">Messaged</div>
              <div v-if="m.leaderNotified" class="action-done-badge status-orange">Leader Notified</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5+ missed -->
      <div class="list-card list-5">
        <div class="card-title-row">
          <div class="title-left">
            <h4>5+ Absences — High Priority</h4>
            <div class="title-sub">⚠️ High Priority</div>
          </div>
          <div class="card-count">{{ monitoring5Plus.length }}</div>
        </div>

        <div v-if="!monitoring5Plus.length" class="empty-small">No members in this category.</div>
        <div v-else class="card-list">
          <div v-for="m in monitoring5Plus" :key="m.id" class="monitor-card">
            <div class="mc-header">
              <div class="mc-name">{{ m.firstName }} {{ m.lastName }}</div>
              <div class="mc-email">{{ m.email || 'No email' }}</div>
            </div>

            <div class="mc-info">
              <div class="mc-item">
                <label>Type</label>
                <div class="mc-value">{{ m.typeString }}</div>
                <span class="status-pill status-5">{{ m.statusLabel }}</span>
              </div>

              <div class="mc-item">
                <label>Misses</label>
                <div class="mc-value miss-count">{{ m.consecutiveAbsences }}</div>
              </div>

              <div class="mc-item">
                <label>Leader</label>
                <div class="mc-value">{{ m.dgroupLeader || '—' }}</div>
              </div>
            </div>

            <div class="mc-actions">
              <button v-if="!m.msgSent" class="action-btn message" @click="handleMessage(m)">Message</button>
              <button v-if="m.showArchive" class="action-btn archive" @click="handleArchive(m)">Archive</button>
              <div v-if="m.msgSent" class="action-done-badge status-yellow">Messaged</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* -------------------------------------------
   OVERVIEW
------------------------------------------- */
.monitoring-overview {
  margin-bottom: 14px;
  padding: 14px;
  background: #FFF8E1;
  border-radius: 12px;
  border: 1px solid rgba(255, 204, 128, 0.35);
}

.monitoring-overview h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #E65100;
}

.monitoring-subtext {
  margin-top: 6px;
  color: #6D6D6D;
  font-size: 13px;
  line-height: 1.35;
}

/* -------------------------------------------
   GROUP WRAPPER (Neutralized)
------------------------------------------- */
.monitoring-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

.list-card {
  background: #ffffff;
  padding: 16px;
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;

  /* remove severity color — now neutral */
  border-left: none;
}

/* -------------------------------------------
   GROUP TITLES
------------------------------------------- */
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-left h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #263238;
}

.title-sub {
  font-size: 12px;
  color: #607D8B;
  margin-top: 2px;
}

.card-count {
  font-size: 14px;
  font-weight: bold;
  color: #455A64;
}

/* -------------------------------------------
   MEMBER TILE GRID
------------------------------------------- */
.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

/* MEMBER CARD BASE */
.monitor-card {
  border-radius: 12px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #ECEFF1;
  transition: all 0.18s ease;
}

.monitor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}

/* -------------------------------------------
   PER-MEMBER SEVERITY HIGHLIGHTS
------------------------------------------- */

/* 3 ABSENCES → soft yellow */
.list-3 .monitor-card {
  border-left: 5px solid #FBC02D; /* soft warning yellow */
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(251, 192, 45, 0.18);
}

/* 4 ABSENCES → stronger amber */

.list-4 .monitor-card {
  border-left: 5px solid #FB8C00; /* strong amber */
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(251, 140, 0, 0.20);
}

/* 5+ ABSENCES → soft red */
/* high priority */
.list-5 .monitor-card {
  border-left: 5px solid #E53935; /* urgent red */
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(229, 57, 53, 0.22);
}

/* -------------------------------------------
   CARD CONTENT
------------------------------------------- */
.mc-name {
  font-weight: 800;
  font-size: 14px;
  color: #263238;
}

.mc-email {
  font-size: 12px;
  color: #546E7A;
}

.mc-info {
  margin-top: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mc-item label {
  font-size: 10px;
  color: #78909C;
  text-transform: uppercase;
}

.mc-value {
  font-size: 13px;
  font-weight: 700;
  color: #37474F;
}

.miss-count {
  color: #C62828;
}

/* -------------------------------------------
   TAGS & STATUS
------------------------------------------- */
.status-pill {
  margin-top: 4px;
  display: inline-block;
  font-size: 11px;
  padding: 4px 10px;
  font-weight: 700;
  border-radius: 12px;
}

/* PILL COLORS (clean, modern) */
.status-3 { background: #FFF9C4; color: #FBC02D; }
.status-4 { background: #FFE0B2; color: #FB8C00; }
.status-5 { background: #FFCDD2; color: #E53935; }

/* -------------------------------------------
   ACTION BUTTONS
------------------------------------------- */
.mc-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.action-btn.message { background: #E3F2FD; color: #1976D2; }
.action-btn.notify  { background: #FFF3E0; color: #F57C00; }
.action-btn.archive { background: #FFEBEE; color: #D32F2F; }

/* DONE BADGES */
.action-done-badge {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.status-yellow { background: #FFFDE7; color: #FBC02D; }

/* -------------------------------------------
   MOBILE
------------------------------------------- */
@media (max-width: 520px) {
  .card-list { grid-template-columns: 1fr; }
  .mc-info { grid-template-columns: 1fr; }
}

</style>
