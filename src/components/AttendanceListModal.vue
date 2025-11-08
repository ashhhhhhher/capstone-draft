<script setup>
import { Download } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

const props = defineProps({
  eventName: String,
  eventDate: String,
  attendees: Array,
  filterTitle: String
})

const emit = defineEmits(['close'])

function exportToExcel() {
  const dataToExport = props.attendees.map(member => ({
    'Name': `${member.firstName} ${member.lastName}`,
    'Age': member.age,
    'Gender': member.gender,
    'Dgroup Leader': member.dgroupLeader || 'N/A'
  }))
  
  const ws = XLSX.utils.json_to_sheet(dataToExport)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  
  XLSX.writeFile(wb, `${props.eventName} - ${props.filterTitle} Attendance.xlsx`)
}
</script>

<template>
  <div class="attendance-list-container">
    <div class="modal-header">
      <div class="header-text">
        <h2>{{ eventName }}</h2>
        <p>{{ eventDate }}</p>
        <h3>Attendance List: {{ filterTitle }} ({{ attendees.length }})</h3>
      </div>
      <button class="export-btn" @click="exportToExcel">
        <Download :size="16" />
        Export to Excel
      </button>
    </div>

    <!-- *** THIS WRAPPER IS FIXED *** -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Dgroup Leader</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="attendees.length === 0">
            <td colspan="4">No attendees match this filter.</td>
          </tr>
          <tr v-for="member in attendees" :key="member.id">
            <td>{{ member.firstName }} {{ member.lastName }}</td>
            <td>{{ member.age }}</td>
            <td>{{ member.gender }}</td>
            <td>{{ member.dgroupLeader || 'N/A' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.attendance-list-container {
  /* Remove width constraints, let the parent modal handle it */
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  /* This tells the container to grow to fill the modal */
  flex-grow: 1; 
}

/* *** THIS HEADER IS FIXED *** */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap; /* Allows button to wrap on small screens */
  gap: 16px; /* Adds space if it wraps */
}
.header-text {
  flex-grow: 1; /* Allows text to take available space */
}

h2 {
  margin: 0;
  color: #0D47A1;
}
p {
  margin: 4px 0 0 0;
  font-weight: 500;
  color: #546E7A;
}
h3 {
  margin: 12px 0 0 0;
  font-size: 18px;
  color: #333;
}
.export-btn {
  background-color: #2E7D32;
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
  flex-shrink: 0; /* Prevents button from shrinking */
}

/* *** THIS WRAPPER IS FIXED *** */
.table-wrapper {
  max-height: 60vh;
  overflow-y: auto;  /* For vertical scrolling */
  overflow-x: auto;  /* For horizontal scrolling */
  border: 1px solid #ddd;
  border-radius: 8px;
  flex-grow: 1; /* Allows the table to fill the modal height */
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
  white-space: nowrap; /* Prevents text from wrapping */
}
th {
  background-color: #f9f9f9;
  font-weight: 600;
  position: sticky;
  top: 0;
}
tr:last-child td {
  border-bottom: none;
}
tbody tr:hover {
  background-color: #f5f5f5;
}
td[colspan="4"] {
  text-align: center;
  padding: 40px;
  color: #777;
  white-space: normal;
}
.close-btn {
  width: 100%;
  padding: 14px;
  margin-top: 24px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>