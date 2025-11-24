<script setup>
import { ref } from 'vue'
import { Download, FileText, ChevronDown } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const props = defineProps({
  exportType: {
    type: String,
    required: true,
    validator: (value) => ['members', 'events'].includes(value)
  }
})

// --- Store Connections ---
const membersStore = useMembersStore()
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()

const { activeMembers } = storeToRefs(membersStore)
const { allEvents } = storeToRefs(eventsStore)
const { allAttendance } = storeToRefs(attendanceStore)

// --- UI State ---
const showMenu = ref(false)

// --- Helper: Categorize Members ---
function getSegmentedMembers() {
  if (!activeMembers.value || !Array.isArray(activeMembers.value)) {
    console.error("Active Members data is missing or invalid.");
    return { firstTimers: [], leaders: [], volunteers: [], regulars: [], all: [] };
  }

  const all = [...activeMembers.value].sort((a, b) => a.lastName.localeCompare(b.lastName));

  const firstTimers = all.filter(m => m.finalTags?.isFirstTimer);
  const leaders = all.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isDgroupLeader);
  const volunteers = all.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && m.finalTags?.isVolunteer);
  const regulars = all.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && !m.finalTags?.isVolunteer && m.finalTags?.isRegular);

  return { firstTimers, leaders, volunteers, regulars, all };
}

// --- Helper: Stats ---
function getDetailedStats(list) {
  return {
    total: list.length,
    b1gMale: list.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Male').length,
    b1gFemale: list.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Female').length,
    elevateMale: list.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Male').length,
    elevateFemale: list.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Female').length
  };
}

function getGlobalStats(allMembers) {
    const elevateMembers = allMembers.filter(m => m.finalTags?.ageCategory === 'Elevate');
    const b1gMembers = allMembers.filter(m => m.finalTags?.ageCategory === 'B1G');

    return {
        elevate: {
            total: elevateMembers.length,
            male: elevateMembers.filter(m => m.gender === 'Male').length,
            female: elevateMembers.filter(m => m.gender === 'Female').length
        },
        b1g: {
            total: b1gMembers.length,
            male: b1gMembers.filter(m => m.gender === 'Male').length,
            female: b1gMembers.filter(m => m.gender === 'Female').length
        }
    }
}


//  1. MEMBERS EXCEL EXPORT
function exportMembersExcel() {
  try {
    const { firstTimers, leaders, volunteers, regulars } = getSegmentedMembers();

    if (firstTimers.length + leaders.length + volunteers.length + regulars.length === 0) {
      alert("No member data available to export.");
      return;
    }

    const wb = XLSX.utils.book_new();

    const segments = [
      { 
        name: 'First Timers', 
        data: firstTimers, 
        headers: ['Name', 'Age', 'Age Group', 'Gender', 'Contact #'],
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '']
      },
      { 
        name: 'Dgroup Leaders', 
        data: leaders, 
        headers: ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer Ministry'],
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || 'N/A']
      },
      { 
        name: 'Volunteers', 
        data: volunteers, 
        headers: ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'],
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || '']
      },
      { 
        name: 'Regular Members', 
        data: regulars, 
        headers: ['Name', 'Age', 'Age Group', 'Gender', 'Dgroup Leader'],
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.dgroupLeader || 'Unassigned']
      }
    ];

    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2196F3" } }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };
    const cellStyle = { alignment: { vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };

    segments.forEach(seg => {
      if (seg.data.length === 0) return;
      const rows = [ ["CHRIST COMMISSION FOUNDATION INC."], [`WKND ELEVATE BAGUIO - ${seg.name.toUpperCase()}`], [""], seg.headers ];
      seg.data.forEach(m => rows.push(seg.map(m)));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      if (ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cell]) continue;
                if (R === 0) ws[cell].s = titleStyle;
                else if (R === 3) ws[cell].s = headerStyle; 
                else if (R > 3) ws[cell].s = cellStyle;
            }
          }
          ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: seg.headers.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: seg.headers.length - 1 } }];
          ws['!cols'] = seg.headers.map(() => ({ wch: 22 }));
      }
      XLSX.utils.book_append_sheet(wb, ws, seg.name);
    });

    XLSX.writeFile(wb, `WKND_Elevate_Members_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Excel Export Failed:", error);
    alert("An error occurred while exporting Excel. Check console for details.");
  }
}


//  2. MEMBER PDF EXPORT
function exportMembersPDF() {
  try {
    const { firstTimers, leaders, volunteers, regulars, all } = getSegmentedMembers();
    const totalRegistered = all.length;

    if (totalRegistered === 0) {
      alert("No member data available to export.");
      return;
    }

    const doc = new jsPDF();
    
    // Header
    try { doc.addImage('/ccf logo.png', 'PNG', 15, 10, 20, 20); } catch (e) {}
    doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(13, 71, 161).text("CHRIST'S COMMISSION FELLOWSHIP", 40, 20);
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100).text("WKND ELEVATE BAGUIO Member List", 40, 26);
    doc.line(15, 35, 195, 35);

    // Summary
    const globalStats = getGlobalStats(all);
    
    let y = 45;
    doc.setTextColor(0);
    doc.setFontSize(13).setFont("helvetica", "bold"); 
    doc.text("Member Demographics Summary", 15, y);
    
    y += 8;
    doc.setFontSize(11).setFont("helvetica", "bold");
    doc.text(`Total Members: ${totalRegistered}`, 15, y);
    doc.text(`First Timers Count: ${firstTimers.length}`, 80, y);
    
    y += 6;
    doc.text(`Dgroup Leaders Count: ${leaders.length}`, 15, y);
    doc.text(`Volunteers Count: ${volunteers.length}`, 80, y);
    
    y += 8;
    doc.text(`Elevate Count: ${globalStats.elevate.total}`, 15, y);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(`(Male: ${globalStats.elevate.male}, Female: ${globalStats.elevate.female})`, 50, y);
    
    y += 6;
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(`B1G Count: ${globalStats.b1g.total}`, 15, y);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(`(Male: ${globalStats.b1g.male}, Female: ${globalStats.b1g.female})`, 50, y);
    
    y += 15;

    const renderSection = (title, data, headers, rowMapper) => {
      if (data.length === 0) return;

      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      const stats = getDetailedStats(data);

      doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(0);
      const titleText = `${title} : ${stats.total}`;
      doc.text(titleText, 15, y);
      
      const textWidth = doc.getTextWidth(titleText);
      doc.setDrawColor(0); // Black Line
      doc.line(15, y + 1, 15 + textWidth, y + 1);

      y += 6;
      
      doc.setFontSize(9).setTextColor(50);
      const col1 = 20; 
      const col2 = 80; 
      
      doc.text(`- B1G MALE: ${stats.b1gMale}`, col1, y);
      doc.text(`- ELEVATE MALE: ${stats.elevateMale}`, col2, y);
      
      y += 5;
      doc.text(`- B1G FEMALE: ${stats.b1gFemale}`, col1, y);
      doc.text(`- ELEVATE FEMALE: ${stats.elevateFemale}`, col2, y);

      y += 6;

      autoTable(doc, {
        startY: y,
        head: [headers],
        body: data.map(rowMapper),
        headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 15, right: 15 }
      });

      y = doc.lastAutoTable.finalY + 15;
    };

    renderSection("First Timers", firstTimers, ['Name', 'Age', 'Age Group', 'Gender', 'Contact #'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '']);
    renderSection("DLeaders", leaders, ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || 'N/A']);
    renderSection("Volunteers", volunteers, ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || '']);
    renderSection("Regular Members", regulars, ['Name', 'Age', 'Age Group', 'Gender', 'Dgroup Leader'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.dgroupLeader || 'Unassigned']);

    doc.save(`WKND_Elevate_Members_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("PDF Export Failed:", error);
    alert("An error occurred while exporting PDF. Check console for details.");
  }
}

//  3. EVENTS EXPORT LOGIC
function getEventsData() {
  if (!allEvents.value || allEvents.value.length === 0) return [];
  const services = allEvents.value.filter(e => e.eventType === 'service').sort((a, b) => new Date(b.date) - new Date(a.date)); 

  return services.map(event => {
    const attendees = allAttendance.value.filter(a => a.eventId === event.id);
    const attendeeDetails = activeMembers.value.filter(m => attendees.some(a => a.memberId === m.id));
    
    return {
      name: event.name, date: event.date, total: attendees.length,
      elevate: attendeeDetails.filter(m => m.finalTags?.ageCategory === 'Elevate' && !m.finalTags?.isFirstTimer).length,
      b1g: attendeeDetails.filter(m => m.finalTags?.ageCategory === 'B1G' && !m.finalTags?.isFirstTimer).length,
      firstTimers: attendeeDetails.filter(m => m.finalTags?.isFirstTimer).length,
      volunteers: attendeeDetails.filter(m => m.finalTags?.isVolunteer).length
    };
  });
}

function exportEventsExcel() {
  try {
    const data = getEventsData();
    if (data.length === 0) { alert("No historical event data found."); return; }
    
    const wb = XLSX.utils.book_new();
    const headers = ['Event Name', 'Date', 'Total', 'Elevate', 'B1G', 'First Timers', 'Volunteers'];
    const rows = [["CHRIST COMMISSION FOUNDATION INC."], ["HISTORICAL ATTENDANCE REPORT"], [""], headers, ...data.map(e => [e.name, e.date, e.total, e.elevate, e.b1g, e.firstTimers, e.volunteers])];
    const ws = XLSX.utils.aoa_to_sheet(rows);

    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2196F3" } }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cell]) continue;
            if (R === 3) ws[cell].s = headerStyle;
            else if (R > 3) ws[cell].s = { alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
          }
      }
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
    }
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, `Events_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Event Excel Export Failed:", error);
  }
}

function exportEventsPDF() {
  try {
    const data = getEventsData();
    if (data.length === 0) { alert("No historical event data found."); return; }
    const doc = new jsPDF();
    try { doc.addImage('/ccf logo.png', 'PNG', 15, 10, 20, 20); } catch (e) {}
    doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(13, 71, 161).text("CHRIST'S COMMISSION FELLOWSHIP", 40, 20);
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100).text("Historical Attendance Report", 40, 26);
    doc.line(15, 35, 195, 35);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Event Name', 'Total', 'Elevate', 'B1G', 'FT', 'Vols']],
      body: data.map(e => [e.date, e.name, e.total, e.elevate, e.b1g, e.firstTimers, e.volunteers]),
      headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255] },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 1: { halign: 'left' } } 
    });
    doc.save(`Events_History_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("Event PDF Export Failed:", error);
  }
}

// --- Main Handler ---
function handleExport(type) {
  showMenu.value = false;
  // Executing directly to ensure browser doesn't block downloads (sync context preferable)
  if (props.exportType === 'members') {
    if (type === 'excel') exportMembersExcel();
    else exportMembersPDF();
  } else {
    if (type === 'excel') exportEventsExcel();
    else exportEventsPDF();
  }
}
</script>

<template>
  <div class="export-dropdown-wrapper">
    <div v-if="showMenu" class="menu-overlay" @click="showMenu = false"></div>
    <button class="export-trigger-btn" @click="showMenu = !showMenu">
      <Download :size="16" />
      Export
      <ChevronDown :size="14" />
    </button>
    <div v-if="showMenu" class="export-menu">
      <button class="menu-item" @click="handleExport('excel')">
        <div class="icon-box excel-icon"><Download :size="14" /></div>
        <span>Export to Excel</span>
      </button>
      <button class="menu-item" @click="handleExport('pdf')">
        <div class="icon-box pdf-icon"><FileText :size="14" /></div>
        <span>Export to PDF</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-dropdown-wrapper { position: relative; display: inline-block; }
.menu-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 90; background: transparent; cursor: default; }
.export-trigger-btn { position: relative; z-index: 95; background-color: #fff; border: 1px solid #CFD8DC; color: #546E7A; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
.export-trigger-btn:hover { background-color: #F5F5F5; color: #37474F; border-color: #B0BEC5; }
.export-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #ECEFF1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 160px; z-index: 100; overflow: hidden; padding: 4px; }
.menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; text-align: left; font-size: 13px; color: #37474F; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.menu-item:hover { background-color: #E3F2FD; color: #1565C0; }
.icon-box { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
.excel-icon { background-color: #2E7D32; }
.pdf-icon { background-color: #D32F2F; }
</style>