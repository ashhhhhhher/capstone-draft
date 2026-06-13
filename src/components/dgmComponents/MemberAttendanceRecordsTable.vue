<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAttendanceStore } from '../../stores/attendance'
import { useEventsStore } from '../../stores/events'

const props = defineProps({
  member: {
    type: Object,
    required: true
  },
  allEvents: {
    type: Array,
    default: () => []
  },
  attendance: {
    type: Array,
    default: () => []
  },
  anchorDate: {
    type: [String, Date],
    default: null
  },
  itemsPerPage: {
    type: Number,
    default: 5
  }
})

const attendanceStore = useAttendanceStore()
const eventsStore = useEventsStore()

const loading = ref(true)
const currentPage = ref(1)

const toDateObj = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

const sourceEvents = computed(() => {
  return props.allEvents.length > 0 ? props.allEvents : eventsStore.allEvents || []
})

const sourceAttendance = computed(() => {
  return props.attendance.length > 0 ? props.attendance : attendanceStore.allAttendance || []
})

const memberDisplayName = computed(() => {
  if (!props.member) return 'Member'
  if (props.member.fullName) return props.member.fullName
  return `${props.member.firstName || ''} ${props.member.lastName || ''}`.trim() || 'Member'
})

const joinedDateStr = computed(() => {
  const raw = props.member?.joinedDate || props.member?.joinDate || props.member?.joinedAt || props.member?.createdAt || null
  if (!raw) return '2000-01-01'
  const d = toDateObj(raw)
  return !d || isNaN(d.getTime()) ? '2000-01-01' : d.toISOString().split('T')[0]
})

const joinedDateTime = computed(() => {
  const d = toDateObj(props.member?.joinedDate || props.member?.joinDate || props.member?.joinedAt || props.member?.createdAt)
  return d && !isNaN(d.getTime()) ? d.getTime() : null
})

const hasValidJoinDate = computed(() => joinedDateTime.value !== null)

const cutOffDateStr = computed(() => {
  const anchor = props.anchorDate ? toDateObj(props.anchorDate) : new Date()
  const anchorStr = !anchor || isNaN(anchor.getTime()) ? new Date().toISOString().split('T')[0] : anchor.toISOString().split('T')[0]
  const archiveRaw = props.member?.archivedAt ? toDateObj(props.member.archivedAt) : null
  const archiveStr = archiveRaw && !isNaN(archiveRaw.getTime()) ? archiveRaw.toISOString().split('T')[0] : null
  if (archiveStr && archiveStr < anchorStr) return archiveStr
  return anchorStr
})

const attendanceLookup = computed(() => {
  const lookup = new Set()
  for (const a of sourceAttendance.value) {
    lookup.add(`${a.eventId}_${a.memberId}`)
  }
  return lookup
})

const historyRows = computed(() => {
  if (!props.member || !hasValidJoinDate.value) return []

  const eventDateLimit = cutOffDateStr.value
  const joinedDateLimit = joinedDateTime.value

  return sourceEvents.value
    .filter(ev => {
      if (!ev?.date) return false
      const evDate = toDateObj(ev.date)
      if (!evDate || isNaN(evDate.getTime())) return false

      const evDateStr = evDate.toISOString().split('T')[0]
      const joinedOk = joinedDateLimit ? evDate.getTime() >= joinedDateLimit : true
      return joinedOk && evDateStr <= eventDateLimit
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(ev => {
      const isPresent = attendanceLookup.value.has(`${ev.id}_${props.member.id}`)

      return {
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date,
        status: isPresent ? 'present' : 'absent'
      }
    })
})

const totalPages = computed(() => Math.max(1, Math.ceil(historyRows.value.length / props.itemsPerPage)))

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * props.itemsPerPage
  return historyRows.value.slice(start, start + props.itemsPerPage)
})

watch(() => props.member?.id, () => {
  currentPage.value = 1
}, { immediate: true })

watch(historyRows, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

onMounted(async () => {
  loading.value = true
  try {
    if (!props.allEvents.length) {
      await eventsStore.fetchEvents()
    }
    if (!props.attendance.length) {
      await attendanceStore.fetchAllAttendance()
    }
  } finally {
    loading.value = false
  }
})

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  const d = toDateObj(dateStr)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'
}
</script>

<template>
  <div class="records-table-shell">
    <div v-if="loading" class="records-loading">Loading attendance records...</div>
    <template v-else>
      <div v-if="historyRows.length === 0" class="records-empty">
        No attendance records found for {{ memberDisplayName }}.
      </div>

      <template v-else>
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
              <tr v-for="event in paginatedRows" :key="event.eventId">
                <td class="text-gray-600">{{ formatDate(event.eventDate) }}</td>
                <td class="font-bold text-dark">{{ event.eventName }}</td>
                <td>
                  <div class="status-badge" :class="event.status">
                    <span class="icon" v-if="event.status === 'present'">✓</span>
                    <span class="icon" v-else>×</span>
                    {{ event.status === 'present' ? 'Present' : 'Absent' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-controls" v-if="totalPages > 1">
          <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages }} ({{ historyRows.length }} events)</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.records-table-shell { display: flex; flex-direction: column; gap: 14px; }
.records-loading, .records-empty { text-align: center; padding: 24px; background: #F8FAFC; border: 1px solid #ECEFF1; border-radius: 12px; color: #546E7A; }
.table-container { border: 1px solid #ECEFF1; border-radius: 12px; overflow-x: auto; overflow-y: hidden; background: white; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; min-width: 560px; }
th { background: #F8FAFC; color: #546E7A; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 16px; text-align: left; border-bottom: 2px solid #ECEFF1; }
td { padding: 12px 16px; border-bottom: 1px solid #ECEFF1; font-size: 14px; vertical-align: middle; }
.font-bold { font-weight: 700; }
.text-dark { color: #263238; }
.text-gray-600 { color: #475569; }
.status-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
.status-badge.present { background: #E8F5E9; color: #2E7D32; }
.status-badge.absent { background: #FFEBEE; color: #C62828; }
.status-badge .icon { font-size: 14px; font-weight: bold; }
.pagination-controls { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 8px 0 0; }
.page-btn { padding: 6px 12px; border: 1px solid #CFD8DC; background: #F5F7FA; border-radius: 6px; font-weight: 600; color: #546E7A; cursor: pointer; transition: 0.2s; }
.page-btn:hover:not(:disabled) { background: #ECEFF1; }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 13px; color: #78909C; font-weight: 500; }

@media (max-width: 640px) {
  .records-table-shell { gap: 10px; }
  .records-loading, .records-empty { padding: 18px 14px; border-radius: 10px; font-size: 13px; }
  .table-container { border-radius: 10px; }
  table { min-width: 520px; }
  th { padding: 12px 10px; font-size: 10px; }
  td { padding: 10px 10px; font-size: 13px; }
  .status-badge { font-size: 11px; padding: 4px 10px; gap: 4px; }
  .pagination-controls { flex-wrap: wrap; gap: 10px; }
  .page-info { width: 100%; text-align: center; }
}
</style>