<script setup>
import * as XLSX from 'xlsx'
import { Download } from 'lucide-vue-next'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import { useMembersStore } from '../stores/members'

const props = defineProps({
    exportType: {
        type: String, // 'members' or 'events'
        required: true
    }
})

const { members } = storeToRefs(useMembersStore())
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(useAttendanceStore())

// --- Helpers ---
const recentServiceIds = computed(() => {
    return allEvents.value
        .filter(e => e.eventType === 'service')
        .slice(0, 5)
        .map(e => e.id)
})

function getMemberStatus(memberId) {
    if (recentServiceIds.value.length === 0) return 'Unknown';
    const attendedRecentService = allAttendance.value.some(att => 
        att.memberId === memberId && recentServiceIds.value.includes(att.eventId)
    );
    return attendedRecentService ? 'Active' : 'Inactive';
}

function adjustColumnWidths(worksheet, dataArray) {
    const colWidths = dataArray[0].map((_, colIndex) => {
        const maxLen = dataArray.reduce((max, row) => {
            const cellValue = row[colIndex] ? row[colIndex].toString() : "";
            return Math.max(max, cellValue.length);
        }, 10);
        return { wch: maxLen + 2 };
    });
    worksheet['!cols'] = colWidths;
}

// --- 1. Export Total Members List (Updated) ---
function exportMembers() {
    // Sort Alphabetically by Last Name
    const sortedMembers = [...members.value].sort((a, b) => 
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );

    const headers = [
        'Name', 'Age', 'Age Group', 'Gender', 'Email Address', 
        'Contact Number', 'Dgroup Leader', 'Category Tags', 'Status'
    ];

    const rows = sortedMembers.map(m => [
        `${m.lastName}, ${m.firstName}`, // Last, First format
        m.age,
        m.finalTags.ageCategory,
        m.gender,
        m.email,
        m.contactNumber || 'N/A',
        m.dgroupLeader || 'N/A',
        [
            m.finalTags.isRegular ? 'Regular' : '',
            m.finalTags.isDgroupLeader ? 'Leader' : '',
            m.finalTags.isFirstTimer ? 'First Timer' : '',
            m.finalTags.isVolunteer ? `Volunteer (${m.finalTags.volunteerMinistry.join(', ')})` : ''
        ].filter(Boolean).join('; '),
        getMemberStatus(m.id)
    ]);

    const reportData = [
        ["Christ's Commission Foundation Inc."],
        ["WKND ELEVATE BAGUIO MEMBERS DIRECTORY"],
        [""],
        headers,
        ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
    ];

    adjustColumnWidths(ws, reportData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members Directory');
    XLSX.writeFile(wb, `Elevate_Baguio_Members.xlsx`);
}

// --- 2. Export Historical Attendance ---
function exportHistoricalEvents() {
    // Sort Events by Date (Newest First)
    const sortedEvents = [...allEvents.value]
        .filter(e => e.eventType === 'service')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = [
        'Event Name', 'Date', 'Total Attendees', 'Location', 
        'Total Elevate', 'Total B1G', 'Total First Timers', 
        'Total Leaders', 'Total Volunteers'
    ];

    const rows = sortedEvents.map(event => {
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

        return [
            event.name,
            event.date,
            attendees.length,
            event.eventLocation || 'N/A',
            stats.elevate,
            stats.b1g,
            stats.firstTimers,
            stats.leaders,
            stats.volunteers
        ]
    });

    const reportData = [
        ["Christ's Commission Foundation Inc."],
        ["WKND ELEVATE HISTORICAL ATTENDANCE"],
        [""],
        headers,
        ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
    ];

    adjustColumnWidths(ws, reportData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance History');
    XLSX.writeFile(wb, `Elevate_Baguio_Attendance_History.xlsx`);
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
        Export Report
    </button>
</template>

<style scoped>
.export-btn {
    background-color: #2E7D32;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
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