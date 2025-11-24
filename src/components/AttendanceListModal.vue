<script setup>
import { computed } from 'vue'
import { Download, FileText } from 'lucide-vue-next'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useMembersStore } from '../stores/members'
import { storeToRefs } from 'pinia'

const props = defineProps({
  eventName: String,
  eventDate: String,
  eventLocation: String,
  eventSpeaker: String,
  eventSeries: String,
  attendees: Array,
  filterTitle: String
})

const emit = defineEmits(['close'])

// --- Store Access for Attendance Rate ---
const membersStore = useMembersStore()
const { members } = storeToRefs(membersStore)

// --- SORTING LOGIC ---
const sortedAttendees = computed(() => {
  return [...props.attendees].sort((a, b) => 
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  )
})

// Helper for sorting
function sortByName(list) {
  return list.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

// =========================================================================
//  1. EXCEL EXPORT (Preserved Existing Logic)
// =========================================================================
function exportToExcel() {
  const firstTimers = sortByName(props.attendees.filter(m => m.finalTags.isFirstTimer));
  const leaders = sortByName(props.attendees.filter(m => !m.finalTags.isFirstTimer && m.finalTags.isDgroupLeader));
  const volunteers = sortByName(props.attendees.filter(m => !m.finalTags.isFirstTimer && !m.finalTags.isDgroupLeader && m.finalTags.isVolunteer));
  const regulars = props.attendees.filter(m => !m.finalTags.isFirstTimer && !m.finalTags.isDgroupLeader && !m.finalTags.isVolunteer);
  
  const elevateMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'Elevate'));
  const elevateFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'Elevate'));
  const b1gMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags.ageCategory === 'B1G'));
  const b1gFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags.ageCategory === 'B1G'));

  const wb = XLSX.utils.book_new();
  const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  const mainTitleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
  const tableTitleStyle = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center", vertical: "center" } };
  const tableHeaderStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "FF0000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
  const cellStyle = { alignment: { vertical: "center" }, border: borderStyle };

  const createMetadataRow = (leftText, rightText, totalCols) => {
    const row = new Array(totalCols).fill("");
    row[0] = leftText;
    if (totalCols > 1) { row[totalCols - 1] = rightText; }
    return row;
  };

  const createSheet = (sheetTabName, sheetTitle, tableHeaders, memberList, mapFunction) => {
    const colCount = tableHeaders.length;
    const rows = [
      ["CHRIST COMMISSION FOUNDATION INC."], [""],
      createMetadataRow(`Name of Event: ${props.eventName}`, `Speaker: ${props.eventSpeaker || 'N/A'}`, colCount),
      createMetadataRow(`Venue: ${props.eventLocation || 'N/A'}`, `Series: ${props.eventSeries || 'N/A'}`, colCount),
      createMetadataRow(`Ministry: Elevate Baguio x B1G Baguio`, `Date: ${props.eventDate}`, colCount),
      createMetadataRow(`Ministry in-charge: Elevate Baguio`, "", colCount),
      [""], [sheetTitle], tableHeaders
    ];

    if (memberList.length > 0) { memberList.forEach(m => rows.push(mapFunction(m))); } 
    else { rows.push(["No attendees in this category."]); }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        if (R === 0) ws[cellAddress].s = mainTitleStyle;
        else if (R >= 2 && R <= 5) ws[cellAddress].s = { alignment: { wrapText: false } };
        else if (R === 7) ws[cellAddress].s = tableTitleStyle;
        else if (R === 8) ws[cellAddress].s = tableHeaderStyle;
        else if (R > 8) ws[cellAddress].s = cellStyle;
      }
    }
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, { s: { r: 7, c: 0 }, e: { r: 7, c: colCount - 1 } }];
    const colWidths = [];
    rows.forEach((row, rIdx) => {
      if (rIdx === 0 || rIdx === 7) return; 
      row.forEach((cell, i) => {
        const len = cell ? cell.toString().length : 0;
        colWidths[i] = Math.max(colWidths[i] || 15, len + 5); 
      });
    });
    if (colCount < 5) { colWidths[0] = Math.max(colWidths[0], 35); colWidths[colCount - 1] = Math.max(colWidths[colCount - 1], 25); }
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sheetTabName);
  };

  createSheet("First Timers", "ATTENDANCE SHEET - FIRST TIMERS", ["Name", "Gender", "Age", "Contact Number", "Fb/Messenger", "Email", "School/Occupation"], firstTimers, (m) => [`${m.lastName}, ${m.firstName}`, m.gender, m.age, m.contactNumber || '', m.fbAccount || '', m.email, m.school || '']);
  createSheet("Volunteers", "ATTENDANCE SHEET - VOLUNTEERS", ["Name", "Age", "Gender", "Ministry"], volunteers, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, m.finalTags.volunteerMinistry.join(', ')]);
  createSheet("DLeaders", "ATTENDANCE SHEET - DLEADERS", ["Name", "Age", "Gender", "Volunteer Ministry"], leaders, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, m.finalTags.volunteerMinistry.join(', ') || 'N/A']);
  createSheet("Elevate F", "ATTENDANCE SHEET - DGROUP MEMBERS (ELEVATE FEMALES)", ["Name", "Age", "DLeader Name"], elevateFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("Elevate M", "ATTENDANCE SHEET - DGROUP MEMBERS (ELEVATE MALES)", ["Name", "Age", "DLeader Name"], elevateMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("B1G F", "ATTENDANCE SHEET - DGROUP MEMBERS (B1G FEMALES)", ["Name", "Age", "DLeader Name"], b1gFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("B1G M", "ATTENDANCE SHEET - DGROUP MEMBERS (B1G MALES)", ["Name", "Age", "DLeader Name"], b1gMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  XLSX.writeFile(wb, `${props.eventName} - Attendance Report.xlsx`);
}

// =========================================================================
//  2. PDF EXPORT (Updated)
// =========================================================================
function exportToPDF() {
  const doc = new jsPDF();
  
  // Calculate Stats
  const totalAttended = props.attendees.length;
  const totalRegistered = members.value ? members.value.length : 0;
  const rate = totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0;

  // --- Header ---
  try { doc.addImage('/ccf logo.png', 'PNG', 15, 10, 20, 20); } catch (e) { console.warn("Logo not found"); }
  doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(13, 71, 161).text("CHRIST'S COMMISSION FELLOWSHIP", 40, 20);
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100).text("Event Attendance Report", 40, 26);
  doc.line(15, 35, 195, 35);

  // --- Event Details ---
  doc.setFontSize(10).setTextColor(0);
  doc.text(`Event: ${props.eventName}`, 15, 45);
  doc.text(`Date: ${props.eventDate}`, 15, 50);
  doc.text(`Speaker: ${props.eventSpeaker || 'N/A'}`, 120, 45);
  doc.text(`Venue: ${props.eventLocation || 'N/A'}`, 120, 50);

  // --- Summary Stats (Matched Font Size) ---
  // Font size 10, normal weight to match headers above
  doc.text(`Total Attendees: ${totalAttended}`, 15, 60);
  doc.text(`Attendance Rate: ${rate}%`, 120, 60);

  // --- Filter Data for Tables ---
  const data = props.attendees;
  
  const firstTimers = sortByName(data.filter(m => m.finalTags?.isFirstTimer));
  const leaders = sortByName(data.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isDgroupLeader));
  const volunteers = sortByName(data.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && m.finalTags?.isVolunteer));
  
  // Regulars Split Logic
  const regulars = data.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && !m.finalTags?.isVolunteer);
  const b1gMale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Male'));
  const b1gFemale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Female'));
  const elevateMale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Male'));
  const elevateFemale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Female'));

  let y = 70;

  const createTable = (title, list, columns, mapFn) => {
    if (list.length === 0) return;
    
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFontSize(11).setTextColor(13, 71, 161).setFont("helvetica", "bold");
    doc.text(`${title} (${list.length})`, 15, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [columns],
      body: list.map(mapFn),
      // Blue Header [33, 150, 243]
      headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 }
    });

    y = doc.lastAutoTable.finalY + 15;
  };

  // 1. First Timers
  createTable(
    "First Timers", 
    firstTimers, 
    ['Name', 'Age', 'Age Group', 'Gender', 'Contact'], 
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '-']
  );

  // 2. Dgroup Leaders
  createTable(
    "Dgroup Leaders", 
    leaders, 
    ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer'], 
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || 'N/A']
  );

  // 3. Volunteers
  createTable(
    "Volunteers", 
    volunteers, 
    ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'], 
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || '-']
  );

  // 4. Regulars Split
  const regColumns = ['Name', 'Age', 'Gender', 'Dgroup Leader'];
  const regMap = m => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, m.dgroupLeader || 'Unassigned'];

  createTable("B1G Male Members", b1gMale, regColumns, regMap);
  createTable("B1G Female Members", b1gFemale, regColumns, regMap);
  createTable("ELEVATE Male Members", elevateMale, regColumns, regMap);
  createTable("ELEVATE Female Members", elevateFemale, regColumns, regMap);

  doc.save(`${props.eventName}_Attendance_Report.pdf`);
}
</script>

<template>
  <div class="attendance-list-container">
    
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
      
      <div class="btn-group">
        <button class="export-btn pdf-btn" @click="exportToPDF">
          <FileText :size="16" />
          Export PDF
        </button>

        <button class="export-btn excel-btn" @click="exportToExcel">
          <Download :size="16" />
          Export Excel
        </button>
      </div>
      
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
          <tr v-if="sortedAttendees.length === 0">
            <td colspan="5">No attendees match this filter.</td>
          </tr>
          <tr v-for="member in sortedAttendees" :key="member.id">
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

.modal-header-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.report-header {
  flex: 1;
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

/* Button Group for Side-by-Side or Stacked buttons */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 20px;
}

.export-btn {
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
  white-space: nowrap;
  justify-content: center;
}

.excel-btn {
    background-color: #2E7D32; /* Green */
}
.excel-btn:hover {
    background-color: #388E3C;
}

.pdf-btn {
    background-color: #D32F2F; 
}
.pdf-btn:hover {
    background-color: #B71C1C;
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
    .modal-header-wrapper {
        flex-direction: column;
        gap: 16px;
    }
    .btn-group {
        width: 100%;
        margin-left: 0;
        flex-direction: row;
    }
    .export-btn {
        flex: 1;
    }
    .header-grid {
        flex-direction: column;
        gap: 12px;
    }
    .header-right {
        text-align: left;
    }
}
</style>