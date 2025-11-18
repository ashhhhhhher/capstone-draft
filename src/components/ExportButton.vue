<script setup>
import * as XLSX from 'xlsx'
import { Download } from 'lucide-vue-next'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useMembersStore } from '../stores/members'
import ServiceAttendanceHistory from '../components/ServiceAttendanceHistory.vue'
import AttendanceForecast from '../components/charts/AttendanceForecast.vue'
import ForecastInsights from '../components/ForecastInsights.vue'

const props = defineProps({
    exportType: {
        type: String, // 'members' or 'events'
        required: true
    }
})

const { members } = storeToRefs(useMembersStore())
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Helpers for Status Calculation ---

// Get IDs of the 5 most recent weekend services for active check
const recentServiceIds = computed(() => {
    return allEvents.value
        .filter(e => e.eventType === 'service')
        .slice(0, 5) // Last 5 services
        .map(e => e.id)
})

function getMemberStatus(memberId) {
    if (recentServiceIds.value.length === 0) return 'Unknown (No Service Data)';

    const attendedRecentService = allAttendance.value.some(att => 
        att.memberId === memberId && recentServiceIds.value.includes(att.eventId)
    );

    return attendedRecentService ? 'Active' : 'Inactive (Missed last 5)';
}


// --- Export Total Members List ---
function exportMembers() {
    const dataToExport = members.value.map(m => ({
        'Name': `${m.firstName} ${m.lastName}`,
        'Age': m.age,
        'Age Group': m.finalTags.ageCategory,
        'Gender': m.gender,
        'Email Address': m.email,
        'Contact Number': m.contactNumber || 'N/A',
        'Dgroup Leader': m.dgroupLeader || 'N/A',
        'Category Tags': [
            m.finalTags.isRegular ? 'Regular' : '',
            m.finalTags.isDgroupLeader ? 'Leader' : '',
            m.finalTags.isFirstTimer ? 'First Timer' : '',
            m.finalTags.isVolunteer ? `Volunteer (${m.finalTags.volunteerMinistry.join(', ')})` : ''
        ].filter(Boolean).join('; '),
        'Status': getMemberStatus(m.id)
    }))

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'All Members')
    XLSX.writeFile(wb, `Elevate_Baguio_All_Members_Export.xlsx`)
}

// ---Export Historical Attendance ---
function exportHistoricalEvents() {
    const dataToExport = allEvents.value
        .filter(e => e.eventType === 'service') 
        .map(event => {
            const attendees = allAttendance.value.filter(att => att.eventId === event.id)
            const attendeeIds = attendees.map(a => a.memberId)
            const fullAttendees = members.value.filter(m => attendeeIds.includes(m.id))

            const stats = fullAttendees.reduce((acc, m) => {
                acc.elevate += m.finalTags.ageCategory === 'Elevate' ? 1 : 0
                acc.b1g += m.finalTags.ageCategory === 'B1G' ? 1 : 0
                acc.firstTimers += m.finalTags.isFirstTimer ? 1 : 0
                acc.leaders += m.finalTags.isDgroupLeader ? 1 : 0
                acc.volunteers += m.finalTags.isVolunteer ? 1 : 0
                return acc
            }, { elevate: 0, b1g: 0, firstTimers: 0, leaders: 0, volunteers: 0 })

            return {
                'Event Name': event.name,
                'Date': event.date,
                'Total Attendees': attendees.length,
                'Location': event.eventLocation || 'N/A',
                'Total Elevate': stats.elevate,
                'Total B1G': stats.b1g,
                'Total First Timers': stats.firstTimers,
                'Total Dgroup Leaders': stats.leaders,
                'Total Volunteers': stats.volunteers
            }
        })

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historical Attendance')
    XLSX.writeFile(wb, `Elevate_Baguio_Historical_Attendance_Export.xlsx`)
}

function handleClick() {
    if (props.exportType === 'members') {
        exportMembers()
    } else if (props.exportType === 'events') {
        exportHistoricalEvents()
    }
}
</script>

<template>
    <button class="export-btn" @click="handleClick">
        <Download :size="16" />
        Export
    </button>
</template>

<style scoped>
.export-btn {
    background-color: #2E7D32; /* Green */
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}
.export-btn:hover {
    background-color: #388E3C;
}
</style>