<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  selectedEvent: Object, // The event clicked on from the table
  allEvents: Array,      // Array of past events for this type (e.g., all WKNDs)
  attendance: Array,     // The bulk attendance list pulled when modal opened
  members: Array         // Active/Archived members passed from store
})

const emit = defineEmits(['close'])

const activeFilter = ref('All')
const statusFilter = ref('All') 
const currentPage = ref(1)
const itemsPerPage = 10

// Track the member currently selected for detailed view
const selectedMemberDetail = ref(null)

// Detail view pagination
const detailCurrentPage = ref(1)
const detailItemsPerPage = 5

// Reset pagination and detail view when filters change
watch([activeFilter, statusFilter], () => {
  currentPage.value = 1
  selectedMemberDetail.value = null
})

// Reset detail pagination when member selection changes
watch(selectedMemberDetail, () => {
  detailCurrentPage.value = 1
})

// Find the last 5 events leading up to and including the selected event for the table dots
const relevantEvents = computed(() => {
  if (!props.selectedEvent || !props.allEvents) return []
  return props.allEvents
    .filter(e => new Date(e.date) <= new Date(props.selectedEvent.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .reverse() // Oldest to newest (left to right) for the dots
})

// OPTIMIZATION: Create an O(1) lookup set to avoid massive nested loops over attendance array
const attendanceLookup = computed(() => {
  const lookup = new Set()
  if (props.attendance) {
    for (const a of props.attendance) {
      lookup.add(`${a.eventId}_${a.memberId}`)
    }
  }
  return lookup
})

// Pre-map members to avoid redundant recalculations
const mappedMembers = computed(() => {
  if (!props.selectedEvent || !props.members) return []

  const eventDateObj = new Date(props.selectedEvent.date);

  const baseMembers = props.members.filter(m => {
    const isCreatedBefore = m.createdAt ? new Date(m.createdAt) <= eventDateObj : true;
    const isNotArchivedYet = m.status === 'active' || (m.archivedAt && new Date(m.archivedAt) > eventDateObj);
    const isCorrectGroup = props.selectedEvent.eventType === 'b1g' ? m.finalTags?.ageCategory === 'B1G' : true;

    return isCreatedBefore && isNotArchivedYet && isCorrectGroup;
  });

  return baseMembers.map(member => {
    const joinedDateStr = member.createdAt ? member.createdAt.split('T')[0] : '2000-01-01';

    // 1. Status for Selected Event (O(1) lookup)
    const isPresentNow = attendanceLookup.value.has(`${props.selectedEvent.id}_${member.id}`)

    // 2. Last 5 Events Array (for main table dots)
    let totalAbsences = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    const historyDetails = relevantEvents.value.map(ev => {
      let isMemberDuringEvent = ev.date >= joinedDateStr;
      const present = attendanceLookup.value.has(`${ev.id}_${member.id}`);

      if (present) isMemberDuringEvent = true;

      let statusStr = 'not-member';
      if (isMemberDuringEvent) {
        if (present) {
          statusStr = 'present';
        } else {
          statusStr = 'absent';
        }
      }

      return {
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date,
        status: statusStr
      };
    })

    // Calculate streaks and totals from history
    historyDetails.forEach(detail => {
      if (detail.status === 'absent') {
        totalAbsences++;
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0; // Reset streak if present or not a member
      }
    });

    // Calculate Risk Strategy based on exact criteria
    let risk = 'Good';
    let riskScore = 1;

    if (maxStreak >= 4) {
      // 4-5 consecutive absences
      risk = 'High risk';
      riskScore = 3;
    } else if (totalAbsences >= 3) {
      // 3-4 total absences but not 4 consecutive (e.g. 2 absent, 1 present, 2 absent)
      risk = 'Watch';
      riskScore = 2;
    } else {
      // Less than 3 absences total
      risk = 'Good';
      riskScore = 1;
    }

    const groupName = member.finalTags?.ageCategory || 'N/A'

    return {
      id: member.id,
      name: `${member.firstName} ${member.lastName.charAt(0)}.`,
      fullName: `${member.firstName} ${member.lastName}`,
      joinedDate: member.createdAt || null,
      group: groupName,
      status: isPresentNow ? 'Present' : 'Absent',
      historyDetails, // For main table short preview
      risk,
      _riskScore: riskScore // Hidden metric for sorting
    }
  })
})

// Calculate insights based on the selected group (ignores status filter for context stability)
const insightsSummary = computed(() => {
  let data = mappedMembers.value;
  if (activeFilter.value !== 'All') {
    data = data.filter(m => m.group.toUpperCase() === activeFilter.value.toUpperCase())
  }
  
  let presentCount = 0
  let absentCount = 0
  
  data.forEach(m => {
    if (m.status === 'Present') presentCount++
    else absentCount++
  })

  return { presentCount, absentCount, total: presentCount + absentCount }
})

// Filter based on tabs for main list
const memberPresenceData = computed(() => {
  let filteredData = mappedMembers.value;
  
  if (activeFilter.value !== 'All') {
    filteredData = filteredData.filter(m => m.group.toUpperCase() === activeFilter.value.toUpperCase())
  }
  if (statusFilter.value !== 'All') {
    filteredData = filteredData.filter(m => m.status === statusFilter.value)
  }
  
  return filteredData.sort((a, b) => {
    // 1. Sort by Risk level (High Risk -> Watch -> Good)
    if (a._riskScore !== b._riskScore) {
      return b._riskScore - a._riskScore;
    }
    // 2. Secondary sort by current event status (Absent first)
    if (a.status !== b.status) {
      return a.status === 'Absent' ? -1 : 1;
    }
    // 3. Alphabetical sort
    return a.name.localeCompare(b.name);
  })
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return memberPresenceData.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => {
  return Math.ceil(memberPresenceData.value.length / itemsPerPage) || 1
})

// Generate dynamic history up to last seen for detail view
const selectedMemberExtendedHistory = computed(() => {
  if (!selectedMemberDetail.value || !props.allEvents) return []
  
  const memberId = selectedMemberDetail.value.id
  const joinedDateStr = selectedMemberDetail.value.joinedDate 
    ? selectedMemberDetail.value.joinedDate.split('T')[0] 
    : '2000-01-01'

  // Get all events sorted descending (newest to oldest) up to the selected event
  const pastEventsDesc = props.allEvents
    .filter(e => new Date(e.date) <= new Date(props.selectedEvent.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const dynamicHistory = []

  for (const ev of pastEventsDesc) {
    let isMemberDuringEvent = ev.date >= joinedDateStr
    const isPresent = attendanceLookup.value.has(`${ev.id}_${memberId}`)

    if (isPresent) isMemberDuringEvent = true

    let statusStr = 'not-member'
    if (isMemberDuringEvent) {
      statusStr = isPresent ? 'present' : 'absent'
    }

    dynamicHistory.push({
      eventId: ev.id,
      eventName: ev.name,
      eventDate: ev.date,
      status: statusStr
    })

    // Stop searching backward if:
    // We have at least 5 events AND we've hit a state where they were Present (their "last seen")
    // OR we hit the events before they were a member (not-member state)
    if (dynamicHistory.length >= 5 && (statusStr === 'present' || statusStr === 'not-member')) {
      break;
    }
  }

  return dynamicHistory
})

const paginatedDetailData = computed(() => {
  const start = (detailCurrentPage.value - 1) * detailItemsPerPage
  return selectedMemberExtendedHistory.value.slice(start, start + detailItemsPerPage)
})

const detailTotalPages = computed(() => {
  return Math.ceil(selectedMemberExtendedHistory.value.length / detailItemsPerPage) || 1
})

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
<template>
  <div class="presence-modal">
    <div class="modal-header">
      <div class="header-titles">
        <h2>Member presence — {{ selectedEvent?.name }} — {{ formatDate(selectedEvent?.date) }}</h2>
        <p>Who was present and who was absent at this event, tracking consecutive absences.</p>
      </div>

      <!-- INSIGHTS BAR -->
      <div class="insights-bar" v-show="!selectedMemberDetail">
        <div class="insight-stat total">
          <span class="label">Filtered Total:</span>
          <span class="val">{{ insightsSummary.total }}</span>
        </div>
        <div class="insight-stat present">
          <span class="label">Present:</span>
          <span class="val">{{ insightsSummary.presentCount }}</span>
        </div>
        <div class="insight-stat absent">
          <span class="label">Absent:</span>
          <span class="val">{{ insightsSummary.absentCount }}</span>
        </div>
      </div>
      
      <div class="filters-container" v-show="!selectedMemberDetail">
        <div class="pill-filters">
          <button class="pill" :class="{ active: activeFilter === 'All' }" @click="activeFilter = 'All'">All Groups</button>
          <button class="pill" :class="{ active: activeFilter === 'ELEVATE' }" @click="activeFilter = 'ELEVATE'">ELEVATE</button>
          <button class="pill" :class="{ active: activeFilter === 'B1G' }" @click="activeFilter = 'B1G'">B1G</button>
        </div>

        <div class="pill-filters">
          <button class="pill" :class="{ active: statusFilter === 'All' }" @click="statusFilter = 'All'">All Status</button>
          <button class="pill" :class="{ active: statusFilter === 'Present' }" @click="statusFilter = 'Present'">Present</button>
          <button class="pill" :class="{ active: statusFilter === 'Absent' }" @click="statusFilter = 'Absent'">Absent</button>
        </div>
      </div>
    </div>

    <!-- MAIN TABLE VIEW -->
    <div v-if="!selectedMemberDetail">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>GROUP</th>
              <th>STATUS</th>
              <th>LAST {{ relevantEvents.length }} EVENTS</th>
              <th>RISK</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in paginatedData" :key="member.id" class="clickable-row" @click="selectedMemberDetail = member" title="Click to view full attendance details">
              <td class="font-bold text-dark">{{ member.name }}</td>
              
              <td>
                <span class="group-badge" :class="member.group.toLowerCase()">{{ member.group }}</span>
              </td>
              
              <td>
                <div class="status-badge" :class="member.status.toLowerCase()">
                  <span class="icon">{{ member.status === 'Present' ? '✓' : '×' }}</span> {{ member.status }}
                </div>
              </td>
              
              <td>
                <div class="history-dots">
                  <div v-for="(eventDetail, i) in member.historyDetails" :key="i" class="dot" :class="eventDetail.status" :title="`${eventDetail.eventName}: ${eventDetail.status}`"></div>
                </div>
              </td>
              
              <td>
                <span class="risk-badge" :class="member.risk.replace(' ', '-').toLowerCase()">{{ member.risk }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="memberPresenceData.length === 0" class="no-data">No members found for this filter.</div>
      </div>

      <!-- Main Pagination Controls -->
      <div class="pagination-controls" v-if="memberPresenceData.length > 0">
        <button 
          class="page-btn" 
          :disabled="currentPage === 1" 
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }} ({{ memberPresenceData.length }} members)</span>
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages" 
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>

    <!-- MEMBER DETAIL VIEW -->
    <div v-else class="member-detail-view">
      <button class="back-btn" @click="selectedMemberDetail = null">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to List
      </button>

      <div class="member-detail-header">
        <h3>{{ selectedMemberDetail.fullName }}</h3>
        <p>Member Since: <strong>{{ formatDate(selectedMemberDetail.joinedDate) }}</strong></p>
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
            <tr v-for="event in paginatedDetailData" :key="event.eventId">
              <td class="text-gray-600">{{ formatDate(event.eventDate) }}</td>
              <td class="font-bold text-dark">{{ event.eventName }}</td>
              <td>
                <div class="status-badge" :class="event.status">
                  <span class="icon" v-if="event.status === 'present'">✓</span>
                  <span class="icon" v-else-if="event.status === 'absent'">×</span>
                  <span class="icon" v-else>-</span>
                  {{ event.status === 'not-member' ? 'Not Joined Yet' : (event.status === 'present' ? 'Present' : 'Absent') }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detail Pagination Controls -->
      <div class="pagination-controls" v-if="selectedMemberExtendedHistory.length > detailItemsPerPage">
        <button 
          class="page-btn" 
          :disabled="detailCurrentPage === 1" 
          @click="detailCurrentPage--"
        >
          Previous
        </button>
        <span class="page-info">Page {{ detailCurrentPage }} of {{ detailTotalPages }} ({{ selectedMemberExtendedHistory.length }} events)</span>
        <button 
          class="page-btn" 
          :disabled="detailCurrentPage === detailTotalPages" 
          @click="detailCurrentPage++"
        >
          Next
        </button>
      </div>
    </div>

    <button class="close-btn mt-4" @click="emit('close')">Close Detail View</button>
  </div>
</template>

<style scoped>
.presence-modal { padding: 24px; max-width: 1000px; }
.modal-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.header-titles h2 { font-size: 20px; font-weight: 700; color: #263238; margin: 0 0 4px 0; }
.header-titles p { font-size: 14px; color: #546E7A; margin: 0; }

.insights-bar {
  display: flex; gap: 16px; background: #F8FAFC; 
  border: 1px solid #ECEFF1; border-radius: 8px; padding: 12px 20px;
}
.insight-stat { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.insight-stat .label { color: #546E7A; font-weight: 600; }
.insight-stat .val { font-weight: 700; font-size: 16px; }
.insight-stat.total .val { color: #0F172A; }
.insight-stat.present .val { color: #2E7D32; }
.insight-stat.absent .val { color: #C62828; }

.filters-container { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; }
.pill-filters { display: flex; gap: 8px; }
.pill { border: 1px solid #CFD8DC; background: white; padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #546E7A; cursor: pointer; transition: 0.2s; }
.pill:hover { border-color: #90A4AE; }
.pill.active { border-color: #2962FF; color: #2962FF; }

.table-container { border: 1px solid #ECEFF1; border-radius: 8px; overflow: hidden; background: white;}
table { width: 100%; border-collapse: collapse; min-width: 600px; }
th { background: #F8FAFC; color: #546E7A; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 16px; text-align: left; border-bottom: 2px solid #ECEFF1; }
td { padding: 12px 16px; border-bottom: 1px solid #ECEFF1; font-size: 14px; vertical-align: middle; }
.font-bold { font-weight: 700; }
.text-dark { color: #263238; }
.text-gray-600 { color: #475569; }

.clickable-row { cursor: pointer; transition: background-color 0.2s ease; }
.clickable-row:hover { background-color: #F8FAFC; }

/* Group Badges */
.group-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; display: inline-block; }
.group-badge.b1g { background: #FFF3E0; color: #E65100; }
.group-badge.elevate { background: #E3F2FD; color: #1565C0; }

/* Status Badges */
.status-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
.status-badge.present { background: #E8F5E9; color: #2E7D32; }
.status-badge.absent { background: #FFEBEE; color: #C62828; }
.status-badge.not-member { background: #F1F5F9; color: #64748B; }
.status-badge .icon { font-size: 14px; font-weight: bold; }

/* Dots */
.history-dots { display: flex; gap: 4px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.present { background-color: #2E7D32; }
.dot.absent { background-color: #E53935; }
.dot.not-member { background-color: #CBD5E1; } /* Gray dot for non-members */

/* Risk Badges */
.risk-badge { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; display: inline-block; }
.risk-badge.good { background: #E8F5E9; color: #2E7D32; }
.risk-badge.watch { background: #FFF3E0; color: #E65100; }
.risk-badge.high-risk { background: #FFEBEE; color: #C62828; }

.no-data { text-align: center; padding: 32px; color: #90A4AE; font-size: 14px; }

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

/* Pagination */
.pagination-controls { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 16px; background: white; border-top: 1px solid #ECEFF1; }
.page-btn { padding: 6px 12px; border: 1px solid #CFD8DC; background: #F5F7FA; border-radius: 6px; font-weight: 600; color: #546E7A; cursor: pointer; transition: 0.2s; }
.page-btn:hover:not(:disabled) { background: #ECEFF1; }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 13px; color: #78909C; font-weight: 500; }

.close-btn { width: 100%; padding: 12px; background: #F5F7FA; border: 1px solid #CFD8DC; border-radius: 8px; font-weight: 600; color: #546E7A; cursor: pointer; transition: 0.2s; }
.close-btn:hover { background: #ECEFF1; }
.mt-4 { margin-top: 16px; }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>