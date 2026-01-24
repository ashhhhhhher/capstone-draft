<script setup>
import { ref, computed, watch } from 'vue'
import * as XLSX from 'xlsx-js-style'
import { storeToRefs } from 'pinia'
import buildComparisonPayload from '../utils/eventComparisonExport'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useNotificationsStore } from '../stores/notifications'
import { useRouter } from 'vue-router'
import AppHeader from '../components/dgmComponents/AppHeader.vue'
import CurrentEvent from '../components/dgmComponents/CurrentEvent.vue'
import AttendanceStats from '../components/dgmComponents/AttendanceStats.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import CreateEventForm from '../components/dgmComponents/CreateEventForm.vue'
import AttendanceListModal from '../components/dgmComponents/AttendanceListModal.vue'
import CalendarModal from '../components/dgmComponents/CalendarModal.vue' 
import AbsenceMonitoring from '../components/dgmComponents/AbsenceMonitoring.vue'

// --- Router & Stores ---
const router = useRouter()
const notificationsStore = useNotificationsStore()
const { members, activeMembers } = storeToRefs(useMembersStore())
const eventsStore = useEventsStore() // used to call endEvent
const { currentEvent, allEvents } = storeToRefs(useEventsStore())
const { currentEventAttendees, allAttendance } = storeToRefs(useAttendanceStore())

// --- Modal State ---
const showCreateEventModal = ref(false)
const showAttendanceModal = ref(false)
const showCalendarModal = ref(false) 
const showEventDetailsModal = ref(false)
const showAbsenceModal = ref(false) 
const eventToEdit = ref(null) 
const selectedStatFilter = ref('All')

// --- Dynamic Data (MERGING PROFILE + ATTENDANCE RECORD) ---
const presentMembers = computed(() => {
  if (!members.value || members.value.length === 0) return [];
  
  // Merge attendance details (ministry role) into the member object
  return currentEventAttendees.value.map(att => {
      const profile = members.value.find(m => m.id === att.memberId);
      if (!profile) return null;
      return {
          ...profile,
          attendanceMinistry: att.ministry || 'N/A', // The actual role played
          checkedInAt: att.timestamp
      }
  }).filter(Boolean);
})

const totalAttendance = computed(() => presentMembers.value.length)

// --- UPDATED STATS LOGIC ---
// Stats now reflect ACTUAL attendance role for THIS EVENT
const dynamicStats = computed(() => {
  if (!members.value) return []; 
  
  const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader);
  const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);
  
  // Active Volunteers: Members who are NOT DLs, NOT First Timers, and have a valid attendanceMinistry
  const activeVolunteers = presentMembers.value.filter(m => 
      !m.finalTags.isDgroupLeader && 
      !m.finalTags.isFirstTimer && 
      m.attendanceMinistry && m.attendanceMinistry !== 'N/A'
  );
  
  // Regulars: Everyone else (Not DL, Not FT, Not Active Volunteer)
  const regulars = presentMembers.value.filter(m => 
      !m.finalTags.isDgroupLeader && 
      !m.finalTags.isFirstTimer && 
      (!m.attendanceMinistry || m.attendanceMinistry === 'N/A')
  );

  return [
    { id: 1, title: "Regulars", count: regulars.length },
    { id: 2, title: "Volunteers", count: activeVolunteers.length },
    { id: 3, title: "Dgroup Leaders", count: dleaders.length },
    { id: 4, title: "First Timers", count: firstTimers.length }
  ]
})

const filteredAttendees = computed(() => {
  const filter = selectedStatFilter.value
  
  // Reuse logic from dynamicStats for consistency
  const dleaders = presentMembers.value.filter(m => m.finalTags.isDgroupLeader);
  const firstTimers = presentMembers.value.filter(m => m.finalTags.isFirstTimer);
  const activeVolunteers = presentMembers.value.filter(m => 
      !m.finalTags.isDgroupLeader && 
      !m.finalTags.isFirstTimer && 
      m.attendanceMinistry && m.attendanceMinistry !== 'N/A'
  );
  const regulars = presentMembers.value.filter(m => 
      !m.finalTags.isDgroupLeader && 
      !m.finalTags.isFirstTimer && 
      (!m.attendanceMinistry || m.attendanceMinistry === 'N/A')
  );

  if (filter === 'All') return presentMembers.value
  if (filter === 'Regulars') return regulars
  if (filter === 'Volunteers') return activeVolunteers
  if (filter === 'Dgroup Leaders') return dleaders
  if (filter === 'First Timers') return firstTimers
  return []
})

const formattedEventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) return "No Date Set"
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
  const date = new Date(currentEvent.value.date + 'T00:00:00')
  return date.toLocaleDateString('en-US', options)
})

// --- Upcoming Events Logic ---
const upcomingEvents = computed(() => {
  const today = new Date();
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  return allEvents.value
    .filter(e => e.date > todayStr) 
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- Notification Logic ---
// new: local notifications generated after an event ends
const absenceNotifications = ref([])     // contains up to 3 notification objects
let _notifsForEventId = null             // internal guard to avoid duplicates

// --- Helper: compute past service events and consecutive absences ---
function todayISO() {
  return new Date().toISOString().split('T')[0]
}
function getPastServiceEvents() {
  const today = todayISO()
  return allEvents.value
    .filter(e => e.eventType === 'service' && e.date <= today)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
}
function computeConsecutiveAbsencesForMember(member) {
  const past = getPastServiceEvents()
  let count = 0
  for (const ev of past) {
    const attended = allAttendance.value?.some(att => att.eventId === ev.id && att.memberId === member.id)
    if (!attended) count++
    else break
  }
  return count
}

// --- Build local notification cards for 3/4/5+ ---
function buildAbsenceNotifications() {
  // avoid rebuilding for the same event repeatedly
  const evId = currentEvent.value?.id || null
  if (_notifsForEventId && _notifsForEventId === evId) return
  _notifsForEventId = evId

  const roster = (activeMembers?.value && activeMembers.value.length) ? activeMembers.value : (members?.value || [])
  const counts = { c3: 0, c4: 0, c5p: 0 }
  roster.forEach(m => {
    const c = computeConsecutiveAbsencesForMember(m)
    if (c === 3) counts.c3++
    else if (c === 4) counts.c4++
    else if (c >= 5) counts.c5p++
  })

  const cards = []

  if (counts.c3 > 0) {
    cards.push({
      id: 'abs3',
      header: '⚠️ 3 Consecutive Absences Detected',
      body: `You have ${counts.c3} members who have missed the last 3 gatherings. They may need early follow-up to prevent further inactivity.`,
      count: counts.c3,
      focus: 'abs3'
    })
  }

  if (counts.c4 > 0) {
    cards.push({
      id: 'abs4',
      header: '⚠️ 4 Consecutive Absences – Attention Needed',
      body: `${counts.c4} members have been absent for 4 consecutive gatherings. These individuals may require pastoral check-ins or leader follow-up.`,
      count: counts.c4,
      focus: 'abs4'
    })
  }

  if (counts.c5p > 0) {
    cards.push({
      id: 'abs5p',
      header: '⛔ Critical: 5+ Consecutive Absences',
      body: `${counts.c5p} members have been inactive for 5 or more gatherings. Immediate follow-up is recommended to prevent disengagement.`,
      count: counts.c5p,
      focus: 'abs5p'
    })
  }

  // push into notifications store for header UI
  notificationsStore.setLocalNotifications(cards)
}

// --- Modal Functions ---

function openAttendanceList(filter) {
  selectedStatFilter.value = filter
  showAttendanceModal.value = true
}

function openCalendar() {
  showCalendarModal.value = true
}

function handleCreateEvent() {
  eventToEdit.value = null;
  showCalendarModal.value = false;
  showCreateEventModal.value = true;
}

function handleEditEvent(event) {
  eventToEdit.value = event
  showCalendarModal.value = false
  showCreateEventModal.value = true
}

// Export attendance for a single event (used in CalendarModal per-event details)
function exportEventAttendance(event) {
  try {
    if (!event || !event.id) { alert('No event selected to export.'); return }
    
    const records = (allAttendance.value || []).filter(a => a.eventId === event.id)
    if (!records.length) { alert('No attendance records found for this event.'); return }

    const rows = []
    // Header / metadata
    rows.push(["CHRIST COMMISSION FOUNDATION INC."])
    rows.push([`Event Attendance: ${event.name}`])
    rows.push([`Date: ${event.date || 'N/A'}`])
    rows.push([""])
    // Extended Header for Ministry
    const headers = ['Name', 'Age', 'Age Group', 'Gender', 'Contact #', 'Event Role / Ministry']
    rows.push(headers)

    const memberList = (members && members.value) ? members.value : []
    
    // Process records to find attendees
    const attendees = records.map(r => {
        const m = memberList.find(x => x.id === r.memberId)
        if (!m) return null
        return {
            ...m,
            attendanceMinistry: r.ministry || 'N/A' // Capture ministry from attendance record
        }
    }).filter(Boolean)

    attendees.forEach(m => {
      rows.push([
          `${m.lastName || ''}, ${m.firstName || ''}`.trim(), 
          m.age || '', 
          m.finalTags?.ageCategory || '', 
          m.gender || '', 
          m.contactNumber || '',
          m.attendanceMinistry // This might be 'N/A' or 'Welcome', etc.
      ])
    })

    // Add interpretation for the event attendance
    const total = attendees.length
    const elevate = attendees.filter(m => m.finalTags?.ageCategory === 'Elevate').length
    const b1g = attendees.filter(m => m.finalTags?.ageCategory === 'B1G').length
    const male = attendees.filter(m => m.gender === 'Male').length
    const female = attendees.filter(m => m.gender === 'Female').length
    const pct = (n) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'
    
    rows.push([])
    rows.push(['Interpretation:'])
    rows.push([`Total: ${total} — Elevate ${elevate} (${pct(elevate)}), B1G ${b1g} (${pct(b1g)}). Gender: M ${male}, F ${female}.`])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // basic styling similar to other exports
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2196F3' } }, alignment: { horizontal: 'center' } }
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let R = 0; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cell]) continue
          // style header row (the one containing headers array) — headers are at row index 4 (0-based)
          if (R === 4) ws[cell].s = headerStyle
          else if (R > 4) ws[cell].s = { alignment: { vertical: 'center' } }
        }
      }
      ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 25 }]
    }

    XLSX.utils.book_append_sheet(wb, ws, `Attendance_${(event.date||'event')}`)
    // Append Event Comparison sheet...
    try {
      const payload = buildComparisonPayload({ allEvents: allEvents.value || [], allAttendance: allAttendance.value || [], members: members.value || [], activeMembers: activeMembers?.value || [] })
      if (payload && payload.cards && payload.cards.length) {
        // ... (existing comparison sheet logic) ...
         const rowsComp = []
        rowsComp.push(["CHRIST COMMISSION FOUNDATION INC."])
        rowsComp.push(["Event Comparison (Current vs Previous 3)"])
        rowsComp.push([""])
        payload.cards.forEach(card => {
          rowsComp.push([card.title || ''])
          if (card.desc) rowsComp.push([card.desc])
          // charts
          if (card.charts && card.charts.length) {
            card.charts.forEach(ch => {
              rowsComp.push([`Chart: ${ch.title || ''}`])
              if (ch.labels && ch.labels.length) rowsComp.push(['Labels'].concat(ch.labels))
              (ch.datasets || []).forEach(ds => {
                const raw = ds.raw || ds.data || []
                rowsComp.push([ds.label || 'Dataset'].concat(raw.map(v => String(v))))
              })
              rowsComp.push([])
            })
          }
          // tables
          if (card.tableHeaders && card.tableRows) {
            rowsComp.push(card.tableHeaders)
            (card.tableRows || []).forEach(r => rowsComp.push(r))
            rowsComp.push([])
          }
          if (card.interpretation) {
            rowsComp.push(['Interpretation:'])
            rowsComp.push([card.interpretation])
            rowsComp.push([])
          }
        })
        const wsComp = XLSX.utils.aoa_to_sheet(rowsComp)
        XLSX.utils.book_append_sheet(wb, wsComp, 'Event Comparison')
      }
    } catch (e) { console.warn('Failed to append Event Comparison sheet', e) }

    const fnameSafe = (`Event_Attendance_${event.date || ''}_${event.name || ''}`).replace(/[^a-z0-9_\-\.]/gi, '_')
    XLSX.writeFile(wb, `${fnameSafe}.xlsx`)
  } catch (err) {
    console.error('exportEventAttendance failed', err)
    alert('Export failed. See console for details.')
  }
}

// Open details modal (called when CurrentEvent emits open-details)
function openEventDetails() {
  showEventDetailsModal.value = true
}

// track previous currentEvent id so we can detect natural expiry
const prevCurrentEventId = ref(currentEvent.value ? currentEvent.value.id : null)

watch(currentEvent, (newVal, oldVal) => {
  // if we had an event previously and now it's null -> it ended naturally
  if (prevCurrentEventId.value && !newVal) {
    // open absence monitoring modal
    showAbsenceModal.value = true
    buildAbsenceNotifications()
  }
  prevCurrentEventId.value = newVal ? newVal.id : null
})

// End current event (calls store action)
async function handleEndCurrentEvent() {
  const ev = currentEvent.value
  if (!ev || !ev.id) {
    alert('No active event to end.')
    return
  }
  if (!confirm(`End event "${ev.name}" now? This will mark it as ended.`)) return

  try {
    await eventsStore.endEvent(ev.id)
    // close details modal and provide feedback
    showEventDetailsModal.value = false
    // open absence monitoring modal after ending
    showAbsenceModal.value = true
    buildAbsenceNotifications()   // build notifications after event ended
    alert('Event ended successfully. Volunteer inactivity check initiated.')
  } catch (err) {
    console.error('Failed to end event:', err)
    alert('Failed to end event. See console for details.')
  }
}

/* --- Navigate to Insights with focus query --- */
function goToMembers(focusKey) {
  // close absence modal and route to Insights with a focus query param
  showAbsenceModal.value = false
  router.push({ path: '/members', query: { focus: focusKey } })
}
</script>

<template>
  <div class="dashboard-container">
    <!-- use AppHeader only (notification moved into AppHeader) -->
    <AppHeader />

    <!-- Total Attendance Card -->
    <div 
      class="total-attendance-card" 
      @click="openAttendanceList('All')"
    >
      <div class="total-attendance">
        Current Event's Total Attendance: <strong>{{ totalAttendance }}</strong>
      </div>
      <span class="click-hint">Click to view list</span>
    </div>
    
    <CurrentEvent 
      @open-calendar="openCalendar"
      @open-details="openEventDetails"
    />

    <div class="stats-grid">
      <AttendanceStats 
        v-for="stat in dynamicStats" 
        :key="stat.id"
        :title="stat.title"
        :count="stat.count"
        @click="openAttendanceList(stat.title)"
      />
    </div>

    <!-- Upcoming Events Section -->
    <div class="upcoming-section">
      <h3>Upcoming Events</h3>
      
      <div v-if="upcomingEvents.length > 0" class="events-scroll-container">
        <div 
          v-for="event in upcomingEvents" 
          :key="event.id" 
          class="upcoming-card-wrapper"
        >
          <div 
            class="upcoming-card"
            :style="event.photoURL ? { backgroundImage: `url(${event.photoURL})` } : {}"
            @click="handleEditEvent(event)"
          >
            <div class="card-overlay">
              <div class="card-content">
                <span class="card-date">{{ formatShortDate(event.date) }} at {{ event.time }}</span>
                <h4 class="card-title">{{ event.name }}</h4>
                <span :class="['card-type', event.eventType === 'b1g_event' ? 'b1g-type' : (event.eventType === 'service' ? 'service-type' : 'ccf-type') ]">
                  {{ event.eventType === 'service' ? 'Service' : (event.eventType === 'b1g_event' ? 'B1G Service' : 'CCF Event') }}
                  <span v-if="event.eventType === 'ccf_event' || event.eventType === 'service'"> &middot; {{ event.eventLocation || 'Online' }}</span>
                  <span v-else-if="event.eventType === 'b1g_event' && event.eventLocation"> &middot; {{ event.eventLocation }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="no-upcoming-box">
        <p>No upcoming events scheduled.</p>
        <button class="link-btn" @click="handleCreateEvent">Schedule one now</button>
      </div>
    </div>

  </div>
  
  <!-- Modals -->
  <Modal v-if="showCreateEventModal" @close="showCreateEventModal = false">
    <CreateEventForm :eventToEdit="eventToEdit" @close="showCreateEventModal = false" />
  </Modal>

  <Modal v-if="showAttendanceModal" @close="showAttendanceModal = false" size="xl">
    <AttendanceListModal
      :eventName="currentEvent ? currentEvent.name : 'Event'"
      :eventDate="formattedEventDate"
      :eventLocation="currentEvent ? currentEvent.eventLocation : 'N/A'"
      :eventSpeaker="currentEvent ? currentEvent.eventSpeaker : ''" 
      :eventSeries="currentEvent ? currentEvent.eventSeries : ''"
      :attendees="filteredAttendees"
      :filterTitle="selectedStatFilter"
      @close="showAttendanceModal = false"
    />
  </Modal>
  
  <Modal v-if="showCalendarModal" @close="showCalendarModal = false" size="xl">
    <CalendarModal 
      @close="showCalendarModal = false"
      @createEvent="handleCreateEvent"
      @editEvent="handleEditEvent"
      @exportEvent="exportEventAttendance"
    />
  </Modal>

  <!-- Event Details Modal -->
  <Modal v-if="showEventDetailsModal" @close="showEventDetailsModal = false" size="xl">
    <div class="event-details-modal">
      <div class="modal-section">
        <h3>{{ currentEvent ? currentEvent.name : 'No Active Event' }}</h3>
        <div class="meta">
          <div><strong>Date:</strong> {{ currentEvent && currentEvent.date ? currentEvent.date : 'N/A' }}</div>
          <div v-if="currentEvent && currentEvent.time"><strong>Time:</strong> {{ currentEvent.time }}</div>
          <div v-if="currentEvent && currentEvent.eventLocation"><strong>Location:</strong> {{ currentEvent.eventLocation }}</div>
          <div v-if="currentEvent && currentEvent.eventSpeaker"><strong>Speaker:</strong> {{ currentEvent.eventSpeaker }}</div>
          <div v-if="currentEvent && currentEvent.eventSeries"><strong>Series:</strong> {{ currentEvent.eventSeries }}</div>
        </div>

        <div v-if="currentEvent && currentEvent.description" class="description">
          <h4>Description</h4>
          <p>{{ currentEvent.description }}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button class="end-btn" @click="handleEndCurrentEvent">End Event</button>
        <button class="close-secondary" @click="showEventDetailsModal = false">Close</button>
      </div>
    </div>
  </Modal>

  <!-- Absence Monitoring Modal (opens after event ends) -->
  <Modal v-if="showAbsenceModal" @close="showAbsenceModal = false" size="xl">
    <div class="absence-modal-inner">
      <header class="absence-modal-header">
        <h3>Consecutive Absences Alert</h3>
        <p class="absence-modal-subtext">Immediate action is recommended for the following members</p>
      </header>

      <div class="absence-modal-body">
        <AbsenceMonitoring />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.dashboard-container {
  padding: 0 20px 20px 20px;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* --- Header --- */
.dashboard-header {
  margin-bottom: 20px;
  display: flex;
  gap: 16px;
}

.total-attendance-card {
  flex-grow: 1;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  text-align: center;
}

.total-attendance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #1976D2;
}

.total-attendance {
  font-size: 20px;
  color: #37474F;
}

.total-attendance strong {
  color: #0D47A1;
  font-weight: 700;
  font-size: 24px;
}

.click-hint {
  font-size: 12px;
  color: #1976D2;
  font-weight: 500;
  margin-top: 4px;
  display: block;
}

/* --- Stats Grid --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

/* --- Upcoming Events Section --- */
.upcoming-section {
  margin-top: 10px;
  flex-grow: 1; 
  display: flex;
  flex-direction: column;
}

.upcoming-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
  font-weight: 700;
  flex-shrink: 0;
}

.events-scroll-container {
  display: flex;
  flex-direction: column; 
  gap: 12px;
  overflow-y: auto; 
  padding-bottom: 16px;
}

.upcoming-card-wrapper {
  flex-shrink: 0;
  width: 100%;
}

.upcoming-card {
  width: 100%;
  height: 150px;
  border-radius: 12px;
  background-color: #37474F; 
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  transition: transform 0.2s ease;
  cursor: pointer;
}

.upcoming-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}

.card-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%);
  display: flex;
  align-items: center; 
  padding: 16px;
}

.card-content {
  color: white;
  width: 100%;
}

.card-date {
  font-size: 16px;
  font-weight: 700;
  color: #FFCA28;
  display: block;
  margin-bottom: 4px;
}

.card-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-type {
  font-size: 14px;
  opacity: 0.8;
  text-transform: uppercase;
  margin-top: 4px;
  display: block;
}

.card-type.b1g-type { color: #FFCDD2; }
.card-type.ccf-type { color: #FFD54F; }
.card-type.service-type { color: #BBDEFB; }

.no-upcoming-box {
  text-align: center;
  padding: 30px;
  background: #fff;
  border-radius: 12px;
  color: #78909C;
  border: 1px dashed #CFD8DC;
}

.link-btn {
  background: none;
  border: none;
  color: #1976D2;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 600;
  margin-left: 4px;
}

/* --- Notification cards layout */
.absence-notif-list {
  display: flex;
  gap: 12px;
  margin: 12px 0;
  overflow-x: auto;
  padding-bottom: 8px;
}

.notif-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ECEFF1;
  padding: 14px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 auto;
}

.notif-header {
  font-weight: 800;
  color: #b71c1c;
  font-size: 15px;
}

.notif-body {
  color: #546E7A;
  font-size: 13px;
  line-height: 1.3;
}

.notif-action {
  display: flex;
  justify-content: flex-end;
}

.notif-cta {
  background: transparent;
  border: none;
  color: #1976D2;
  font-weight: 700;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
}
.notif-cta:hover { text-decoration: underline; }

/* --- Mobile Adjustments --- */
@media (max-width: 768px) {
  .dashboard-container { padding: 0 10px 10px 10px; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .upcoming-card { height: 120px; }
  .card-title { font-size: 20px; }
}

@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
}

/* Event details modal content */
.event-details-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px;
  width: 100%;
  box-sizing: border-box;
}
.event-details-modal .modal-section h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #0D47A1;
}
.event-details-modal .meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  font-size: 14px;
  color: #37474F;
}
.event-details-modal .description {
  margin-top: 8px;
  color: #546E7A;
}
.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  margin-top: 8px;
}
/* red End Event button */
.end-btn {
  background: #D32F2F;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(211,47,47,0.18);
}
.end-btn:hover { background: #C62828; }
/* secondary close button */
.close-secondary {
  background: #F5F7FA;
  color: #37474F;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 9px 12px;
  cursor: pointer;
}

/* Absence modal header (sticky) */
.absence-modal-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.absence-modal-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: white;
  padding: 16px 12px;
  border-bottom: 1px solid #F1F3F5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.absence-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #D32F2F; /* alert color to match monitoring */
  font-weight: 800;
}
.absence-modal-subtext {
  margin: 6px 0 0 0;
  color: #546E7A;
  font-size: 13px;
}

/* body should scroll; keep header sticky */
.absence-modal-body {
  padding: 12px 8px 8px 8px;
  overflow: auto;
  flex: 1 1 auto;
}

/* Deep override to make AbsenceMonitoring cards horizontal inside the modal.
   Uses ::v-deep so the scoped styles apply into the child component. */
::v-deep(.absence-monitoring-wrapper .monitoring-cards) {
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: flex-start;
  /* keep cards on a single row, allow horizontal scroll when necessary */
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 6px;
}

/* make each group card take equal height and a reasonable width */
::v-deep(.absence-monitoring-wrapper .list-card) {
  flex: 0 0 360px; /* each card ~360px wide; adjust as desired */
  min-width: 300px;
  max-width: 42%;
  box-sizing: border-box;
}

/* ensure member tiles stack vertically within each card */
::v-deep(.absence-monitoring-wrapper .card-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ensure 5+ stays on the rightmost when space allows (cards are in order 3,4,5) */
/* for extra safety, set order explicitly */
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(1)) { order: 1; } /* 3 misses */
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(2)) { order: 2; } /* 4 misses */
::v-deep(.absence-monitoring-wrapper .list-card:nth-child(3)) { order: 3; } /* 5+ misses */

/* polish: hide internal card shadows overflow during horizontal scroll */
::v-deep(.absence-monitoring-wrapper .list-card) {
  scroll-snap-align: start;
}

/* small screens: stack vertically again */
@media (max-width: 860px) {
  ::v-deep(.absence-monitoring-wrapper .monitoring-cards) {
    display: block;
  }
  ::v-deep(.absence-monitoring-wrapper .list-card) {
    max-width: none;
    width: 100%;
    flex: none;
  }
}
</style>