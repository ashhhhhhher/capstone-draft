<script setup>
import { Download } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

const props = defineProps({
  eventName: String,
  eventDate: String,
  eventLocation: String,
  eventSpeaker: String, // NEW
  eventSeries: String,  // NEW
  attendees: Array,
  filterTitle: String
})

const emit = defineEmits(['close'])

function sortByName(list) {
  return list.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

function exportToExcel() {
  // (Filtering logic remains the same as before)
  const firstTimers = sortByName(props.attendees.filter(m => m.finalTags.isFirstTimer));
  const leaders = sortByName(props.attendees.filter(m => !m.finalTags.isFirstTimer && m.finalTags.isDgroupLeader));
  const volunteers = sortByName(props.attendees.filter(m => !m.finalTags.isFirstTimer && !m.finalTags.isDgroupLeader && m.finalTags.isVolunteer));
  const regulars = props.attendees.filter(m => !m.finalTags.isFirstTimer && !m.finalTags.isDgroupLeader && !m.finalTags.isVolunteer);
  const elevateFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'Elevate'));
  const elevateMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'Elevate'));
  const b1gFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'B1G'));
  const b1gMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'B1G'));

  let reportData = [];

  // --- UPDATED REPORT HEADER (For Excel) ---
  // We use columns A,B,C and D,E,F for the two sides
  reportData.push(["CHRIST COMMISION FOUNDATION INC"]);
  reportData.push([""]);
  // Row: Name | Speaker
  reportData.push([`Name of Event: ${props.eventName}`, "", "", `Speaker: ${props.eventSpeaker || 'N/A'}`]);
  // Row: Venue | Series
  reportData.push([`Venue: ${props.eventLocation || 'N/A'}`, "", "", `Series: ${props.eventSeries || 'N/A'}`]);
  // Row: Ministry | Date
  reportData.push(["Ministry: Elevate Baguio x B1G Baguio", "", "", `Date: ${props.eventDate}`]);
  // Row: In-Charge
  reportData.push(["Ministry in-charge: Elevate Baguio"]);
  reportData.push([""]);
  reportData.push([""]);

  const appendSection = (title, headers, members, mapFunction) => {
    reportData.push([title]);
    reportData.push(headers);
    if (members.length > 0) {
        members.forEach(m => reportData.push(mapFunction(m)));
    }
    reportData.push([""]);
    reportData.push([""]);
  };

  // (Table Generation remains the same)
  appendSection("ATTENDANCE SHEET- FIRST TIMERS", ["Name", "Gender", "Age", "Fb/Messenger", "Contact Number", "Email", "School/Occupation"], firstTimers, (m) => [`${m.lastName}, ${m.firstName}`, m.gender, m.age, m.fbAccount || '', m.contactNumber || '', m.email, m.school || '']);
  appendSection("ATTENDANCE SHEET- VOLUNTEERS", ["Name", "Age", "Ministry"], volunteers, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags.volunteerMinistry.join(', ')]);
  appendSection("ATTENDANCE SHEET- DLeaders", ["Name", "Age", "Gender", "Volunteer Ministry"], leaders, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, m.finalTags.volunteerMinistry.join(', ') || 'N/A']);
  appendSection("ATTENDANCE SHEET- DGroup Members (ELEVATE FEMALES)", ["Name", "Age", "DLeader Name"], elevateFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  appendSection("ATTENDANCE SHEET- DGroup Members (ELEVATE MALES)", ["Name", "Age", "DLeader Name"], elevateMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  appendSection("ATTENDANCE SHEET- DGroup Members (B1G FEMALES)", ["Name", "Age", "DLeader Name"], b1gFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  appendSection("ATTENDANCE SHEET- DGroup Members (B1G MALES)", ["Name", "Age", "DLeader Name"], b1gMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);

  const ws = XLSX.utils.aoa_to_sheet(reportData);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]; // Center Top Title

  // Auto-fit logic
  const colWidths = [];
  reportData.forEach(row => {
    row.forEach((cell, i) => {
        const len = cell ? cell.toString().length : 0;
        colWidths[i] = Math.max(colWidths[i] || 10, len + 2);
    });
  });
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
  XLSX.writeFile(wb, `${props.eventName} - Attendance Report.xlsx`);
}
</script>

<template>
  <div class="attendance-list-container">
    <!-- UPDATED: Header Layout for UI Display -->
    <div class="modal-header-wrapper">
      <div class="report-header">
        <h2 class="foundation-title">CHRIST COMMISSION FOUNDATION INC.</h2>
        <div class="header-grid">
            <div class="header-left">
                <p><strong>Name of Event:</strong> {{ eventName }}</p>
                <p><strong>Venue:</strong> {{ eventLocation || 'N/A' }}</p>
                <p><strong>Ministry:</strong> Elevate Baguio x B1G Baguio</p>
                <p><strong>Ministry in-charge:</strong> Elevate Baguio</p>
            </div>
            <div class="header-right">
                <p><strong>Speaker:</strong> {{ eventSpeaker || 'N/A' }}</p>
                <p><strong>Series:</strong> {{ eventSeries || 'N/A' }}</p>
                <p><strong>Date:</strong> {{ eventDate }}</p>
            </div>
        </div>
        <h3>Attendance List: {{ filterTitle }} ({{ attendees.length }})</h3>
      </div>
      
      <button class="export-btn" @click="exportToExcel">
        <Download :size="16" />
        Export 
      </button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Dgroup Leader</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="attendees.length === 0">
            <td colspan="5">No attendees match this filter.</td>
          </tr>
          <tr v-for="member in attendees" :key="member.id">
            <td>{{ member.lastName }}, {{ member.firstName }}</td>
            <td>{{ member.age }}</td>
            <td>{{ member.gender }}</td>
            <td>{{ member.dgroupLeader || 'N/A' }}</td>
            <td>
                <span v-if="member.finalTags.isFirstTimer" class="tag ft">First Timer</span>
                <span v-else-if="member.finalTags.isDgroupLeader" class="tag dl">Leader</span>
                <span v-else-if="member.finalTags.isVolunteer" class="tag vol">Volunteer</span>
                <span v-else class="tag reg">Regular</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.attendance-list-container {
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1; 
}

/* --- New Header Styles --- */
.modal-header-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.report-header {
  flex-grow: 1;
}

.foundation-title {
    font-size: 18px;
    font-weight: 800;
    color: #0D47A1;
    text-align: center;
    margin-bottom: 20px;
    text-transform: uppercase;
}

.header-grid {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 15px;
}

.header-left, .header-right {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.header-right {
    text-align: right;
}

.header-grid p {
    margin: 0;
    font-size: 13px;
    color: #333;
}

h3 { 
    margin: 0; 
    font-size: 16px; 
    color: #546E7A; 
    font-weight: 600;
}

.export-btn {
  background-color: #2E7D32;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 5px;
}

.table-wrapper {
  max-height: 60vh;
  overflow-y: auto; 
  border: 1px solid #ddd;
  border-radius: 8px;
  flex-grow: 1;
}
table { width: 100%; border-collapse: collapse; }
th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}
th { background-color: #f9f9f9; font-weight: 600; position: sticky; top: 0; }
tr:last-child td { border-bottom: none; }
tbody tr:hover { background-color: #f5f5f5; }
td[colspan="5"] { text-align: center; padding: 40px; color: #777; white-space: normal; }

.tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.tag.ft { background: #FFF9C4; color: #FBC02D; }
.tag.dl { background: #E3F2FD; color: #1976D2; }
.tag.vol { background: #ECEFF1; color: #546E7A; }
.tag.reg { background: #E8F5E9; color: #2E7D32; }

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

@media (max-width: 600px) {
    .header-grid {
        flex-direction: column;
        gap: 12px;
    }
    .header-right {
        text-align: left;
    }
    .modal-header-wrapper {
        flex-direction: column;
        gap: 16px;
    }
    .export-btn {
        width: 100%;
        justify-content: center;
        margin-left: 0;
    }
}
</style>