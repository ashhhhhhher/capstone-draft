<script setup>
import { ref } from 'vue'
import { Download, FileText, ChevronDown } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../../stores/members'
import { useEventsStore } from '../../stores/events'
import { useAttendanceStore } from '../../stores/attendance'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const props = defineProps({
  exportType: {
    type: String,
    required: true,
    validator: (value) => ['members', 'events', 'page', 'volunteers'].includes(value)
  },
  variant: {
    type: String,
    default: 'default', // 'default' or 'on-blue'
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  customLabel: {
    type: String,
    default: 'Export'
  },
  // optional structured page data provided by parent for reliable exports
  pageExportData: {
    type: Object,
    required: false
  },
  singleEvent: {
    type: Object,
    required: false
  },
  eventsList: {
    type: Array,
    required: false
  },
  yearlySummaryData: {
    type: Object,
    required: false
  },
  // New props for volunteer exports
  volunteersData: {
    type: Array,
    required: false
  },
  volunteerTab: {
    type: String,
    default: 'All'
  }
})

// expose prop values in template more ergonomically
const { exportType, pageExportData, singleEvent, eventsList, yearlySummaryData, volunteersData, volunteerTab } = props

// --- Store Connections ---
const membersStore = useMembersStore()
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()

const { activeMembers } = storeToRefs(membersStore)
const { allEvents, currentEvent } = storeToRefs(eventsStore)
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

  const ministryMap = {};
  const curEvtId = currentEvent && currentEvent.value && currentEvent.value.id ? currentEvent.value.id : null;
  if (curEvtId) {
    (allAttendance.value || []).filter(a => a.eventId === curEvtId && a.ministry && a.ministry !== 'N/A').forEach(r => {
      ministryMap[r.memberId] = r.ministry || 'N/A'
    })
  }

  // 1. First Timers
  const firstTimers = all.filter(m => m.finalTags?.isFirstTimer).map(m => ({ ...m, _servingMinistry: ministryMap[m.id] || null }));
  
  // 2. Dgroup Leaders (Takes precedence over volunteer)
  const leaders = all.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isDgroupLeader).map(m => ({ ...m, _servingMinistry: ministryMap[m.id] || null }));
  
  // 3. Volunteers (Must NOT be a Dgroup Leader)
  const volunteers = all.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && (m.finalTags?.isVolunteer || !!ministryMap[m.id])).map(m => ({ ...m, _servingMinistry: ministryMap[m.id] || null }));
  
  // 4. Regulars (Neither FT, Leader, nor Volunteer)
  const regulars = all.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && !m.finalTags?.isVolunteer && !ministryMap[m.id]).map(m => ({ ...m, _servingMinistry: ministryMap[m.id] || null }));

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
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, (m.finalTags?.volunteerMinistry && m.finalTags.volunteerMinistry.length > 0) ? m.finalTags.volunteerMinistry.join(', ') : (m._servingMinistry || 'N/A')]
      },
      { 
        name: 'Volunteers', 
        data: volunteers, 
        headers: ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'],
        map: m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, (m.finalTags?.volunteerMinistry && m.finalTags.volunteerMinistry.length > 0) ? m.finalTags.volunteerMinistry.join(', ') : (m._servingMinistry || '')]
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

      y += 2;
      
      doc.setFontSize(9).setTextColor(50);

      y += 2;

      autoTable(doc, {
        startY: y,
        head: [headers],
        body: data.map(rowMapper),
        headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 15, right: 15 }
      });

      if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
        y = doc.lastAutoTable.finalY + 6;
      } else {
        y += 6;
      }
    };

    renderSection("First Timers", firstTimers, ['Name', 'Age', 'Age Group', 'Gender', 'Contact #'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '']);
    renderSection("DLeaders", leaders, ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, (m.finalTags?.volunteerMinistry && m.finalTags.volunteerMinistry.length > 0) ? m.finalTags.volunteerMinistry.join(', ') : (m._servingMinistry || 'N/A')]);
    renderSection("Volunteers", volunteers, ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, (m.finalTags?.volunteerMinistry && m.finalTags.volunteerMinistry.length > 0) ? m.finalTags.volunteerMinistry.join(', ') : (m._servingMinistry || '')]);
    renderSection("Regular Members", regulars, ['Name', 'Age', 'Age Group', 'Gender', 'Dgroup Leader'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.dgroupLeader || 'Unassigned']);


    doc.save(`WKND_Elevate_Members_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("PDF Export Failed:", error);
    alert("An error occurred while exporting PDF. Check console for details.");
  }
}

//  3. EVENTS EXPORT LOGIC
function getEventsData(specificEvent = null) {
  let services = []
  if (specificEvent) services = [specificEvent]
  else if (props && props.eventsList && Array.isArray(props.eventsList) && props.eventsList.length) services = props.eventsList
  else if (eventsList && Array.isArray(eventsList) && eventsList.length) services = eventsList
  else services = (allEvents.value || []).filter(e => e.eventType === 'service').sort((a, b) => new Date(b.date) - new Date(a.date))
  if (!services || services.length === 0) return [];

  return services.map(event => {
    const attendees = (allAttendance.value || []).filter(a => a.eventId === event.id);
    const attendeeDetails = (activeMembers.value || []).filter(m => attendees.some(a => a.memberId === m.id));

    const volunteerCount = attendees.filter(a => a.ministry && a.ministry !== 'N/A').length;

    return {
      name: event.name, date: event.date, total: attendees.length,
      elevate: attendeeDetails.filter(m => m.finalTags?.ageCategory === 'Elevate' && !m.finalTags?.isFirstTimer).length,
      b1g: attendeeDetails.filter(m => m.finalTags?.ageCategory === 'B1G' && !m.finalTags?.isFirstTimer).length,
      firstTimers: attendeeDetails.filter(m => m.finalTags?.isFirstTimer).length,
      volunteers: volunteerCount
    };
  });
}

function exportEventsExcel() {
  try {
    const data = getEventsData(singleEvent || null);
    if (data.length === 0 && !props.yearlySummaryData) { alert("No historical event data found for this selection."); return; }
    
    const wb = XLSX.utils.book_new();

    // 1. Optional Yearly Summary Sheet
    if (props.yearlySummaryData) {
      const summaryHeaders = ['Month', 'Total Attendance'];
      const summaryRows = [
        ["CHRIST COMMISSION FOUNDATION INC."],
        [`YEARLY ATTENDANCE SUMMARY - ${props.yearlySummaryData.year}`],
        [""],
        summaryHeaders
      ];

      props.yearlySummaryData.labels.forEach((label, idx) => {
        summaryRows.push([label, props.yearlySummaryData.data[idx]]);
      });

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      const summaryHeaderStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2196F3" } }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
      
      if (summaryWs['!ref']) {
        const range = XLSX.utils.decode_range(summaryWs['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cell = XLSX.utils.encode_cell({ r: R, c: C });
              if (!summaryWs[cell]) continue;
              if (R === 3) summaryWs[cell].s = summaryHeaderStyle;
              else if (R > 3) summaryWs[cell].s = { alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
            }
        }
        summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
        summaryWs['!cols'] = [{ wch: 20 }, { wch: 20 }];
      }

      XLSX.utils.book_append_sheet(wb, summaryWs, "Monthly Summary");
    }

    // 2. Raw Events List Sheet
    if (data.length > 0) {
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
      XLSX.utils.book_append_sheet(wb, ws, props.yearlySummaryData ? "Events Historical Attendance" : "History");
    }

    if (wb.SheetNames.length === 0) return;

    XLSX.writeFile(wb, `Events_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Event Excel Export Failed:", error);
  }
}

function exportEventsPDF() {
  try {
    const data = getEventsData(singleEvent || null);
    if (data.length === 0 && !props.yearlySummaryData) { alert("No historical event data found for this selection."); return; }
    
    const doc = new jsPDF();
    try { doc.addImage('/ccf logo.png', 'PNG', 15, 10, 20, 20); } catch (e) {}
    doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(13, 71, 161).text("CHRIST'S COMMISSION FELLOWSHIP", 40, 20);
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100).text("Historical Attendance Report", 40, 26);
    doc.line(15, 35, 195, 35);

    let currentY = 45;

    // 1. Optional Yearly Summary Table
    if (props.yearlySummaryData) {
      doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(0);
      doc.text(`Yearly Summary (${props.yearlySummaryData.year})`, 15, currentY);
      currentY += 5;

      const summaryRows = [];
      props.yearlySummaryData.labels.forEach((month, index) => {
        summaryRows.push([month, props.yearlySummaryData.data[index]]);
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Month', 'Total Attendance']],
        body: summaryRows,
        headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255] },
        styles: { fontSize: 9, halign: 'center' },
        margin: { left: 15, right: 15 }
      });
      
      currentY = doc.lastAutoTable.finalY + 15;
    }

    // 2. Raw Events List
    if (data.length > 0) {
      if (props.yearlySummaryData) {
         if (currentY > 240) { doc.addPage(); currentY = 20; }
         doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(0);
         doc.text("Events Historical Attendance", 15, currentY);
         currentY += 5;
      }

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Event Name', 'Total', 'Elevate', 'B1G', 'FT', 'Vols']],
        body: data.map(e => [e.date, e.name, e.total, e.elevate, e.b1g, e.firstTimers, e.volunteers]),
        headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255] },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 1: { halign: 'left' } } 
      });
    }

    doc.save(`Events_History_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("Event PDF Export Failed:", error);
  }
}

// 4. PAGE (TSV) EXPORT (Unchanged)
async function exportPageXLSX() {
    // ... logic remains unchanged
}
function exportPagePDF() {
    // ... logic remains unchanged
}

// 5. VOLUNTEER PERFORMANCE EXCEL EXPORT
function exportVolunteerExcel() {
  try {
    if (!props.volunteersData || props.volunteersData.length === 0) {
      alert("No records to export.");
      return;
    }

    const data = props.volunteersData;
    const tabName = props.volunteerTab || 'All';
    const wb = XLSX.utils.book_new();
    
    const headers = tabName === 'All' 
      ? ['Member Name', 'Ministry', 'Total Events', 'Volunteered', 'Attendance Rate']
      : ['Member Name', 'Total Events', 'Volunteered', 'Attendance Rate'];
      
    const rows = [
      ["CHRIST COMMISSION FOUNDATION INC."],
      [`VOLUNTEER PERFORMANCE REPORT - ${tabName.toUpperCase()}`],
      [""],
      headers
    ];

    data.forEach(row => {
      if (tabName === 'All') {
        rows.push([row.fullName, row.ministryStr, row.totalEvents, row.volunteered, `${row.rate}%`]);
      } else {
        rows.push([row.fullName, row.totalEvents, row.volunteered, `${row.rate}%`]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    const headerStyle = { 
      font: { bold: true, color: { rgb: "FFFFFF" } }, 
      fill: { fgColor: { rgb: "2196F3" } }, 
      alignment: { horizontal: "center", vertical: "center" }, 
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } 
    };
    const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
    const cellStyle = { alignment: { vertical: "center", horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const nameStyle = { alignment: { vertical: "center", horizontal: "left" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };

    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cell]) continue;
          if (R === 0 || R === 1) ws[cell].s = titleStyle;
          else if (R === 3) ws[cell].s = headerStyle;
          else if (R > 3) {
             if (C === 0 || (tabName === 'All' && C === 1)) ws[cell].s = nameStyle; // Left align names & ministry
             else ws[cell].s = cellStyle; // Center align numbers
          }
        }
      }
      const colCount = headers.length;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }
      ];
      
      // Auto-fit columns
      const colWidths = headers.map((h, i) => {
         let maxLen = h.length + 5;
         for(let R = 4; R <= range.e.r; ++R) {
            const cell = ws[XLSX.utils.encode_cell({ r: R, c: i })];
            if (cell && cell.v) {
                const len = String(cell.v).length;
                if (len > maxLen) maxLen = len;
            }
         }
         return { wch: maxLen + 2 };
      });
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Performance");
    XLSX.writeFile(wb, `Volunteer_Performance_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Excel Export Failed:", error);
    alert("An error occurred while exporting to Excel.");
  }
}

// --- Main Handler ---
function handleExport(type) {
  showMenu.value = false;
  if (exportType === 'members') {
    if (type === 'excel') exportMembersExcel();
    else exportMembersPDF();
    return
  }
  if (exportType === 'events') {
    if (type === 'excel') exportEventsExcel();
    else exportEventsPDF();
    return
  }
  if (exportType === 'page') {
    if (type === 'excel') exportPageXLSX();
    else if (type === 'pdf-page') exportPagePDF();
    else alert('Only Excel or PDF export is supported for page exports.');
    return
  }
  if (exportType === 'volunteers') {
      if (type === 'excel') exportVolunteerExcel();
      // No PDF needed for this yet based on instructions
      return;
  }
}
</script>

<template>
  <div class="export-dropdown-wrapper">
    <div v-if="showMenu" class="menu-overlay" @click="showMenu = false" aria-hidden="true"></div>
      
      <!-- Direct Button for Volunteers (If specified) -->
      <button v-if="exportType === 'volunteers'" 
              class="export-trigger-btn" 
              @click="handleExport('excel')">
          <Download :size="16" /> {{ customLabel }}
      </button>

      <!-- Standard Dropdown Handling -->
      <button v-else
        class="export-trigger-btn" 
        :class="{ 'on-blue': variant === 'on-blue', 'icon-only': iconOnly }"
        @click="showMenu = !showMenu" 
        aria-haspopup="true" 
        :aria-expanded="showMenu"
      >
        <Download :size="iconOnly ? 18 : 16" />
        <span v-if="!iconOnly">{{ customLabel }}</span>
        <ChevronDown v-if="!iconOnly" :size="14" />
      </button>

      <div v-if="showMenu && exportType !== 'volunteers'" class="export-menu" role="menu" aria-label="Export menu">
        <template v-if="exportType === 'page'">
          <button class="menu-item" @click="handleExport('excel')" role="menuitem" aria-label="Export page as XLSX">
            <div class="icon-box excel-icon"><Download :size="14" /></div>
            <span>Export page (XLSX)</span>
          </button>
          <button class="menu-item" @click="handleExport('pdf-page')" role="menuitem" aria-label="Export page as PDF">
            <div class="icon-box pdf-icon"><FileText :size="14" /></div>
            <span>Export page (PDF)</span>
          </button>
        </template>
        <template v-else>
          <button class="menu-item" @click="handleExport('excel')" role="menuitem" aria-label="Export to Excel">
            <div class="icon-box excel-icon"><Download :size="14" /></div>
            <span>Export to Excel</span>
          </button>
          <button class="menu-item" @click="handleExport('pdf')" role="menuitem" aria-label="Export to PDF">
            <div class="icon-box pdf-icon"><FileText :size="14" /></div>
            <span>Export to PDF</span>
          </button>
        </template>
      </div>
  </div>
</template>

<style scoped>
.export-dropdown-wrapper { position: relative; display: inline-block; }
.menu-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 90; background: transparent; cursor: default; }

/* Default Button */
.export-trigger-btn { 
  position: relative; 
  z-index: 95; 
  background-color: #fff; 
  border: 1px solid #CFD8DC; 
  color: #546E7A; 
  padding: 6px 12px; 
  border-radius: 6px; 
  font-size: 13px; 
  font-weight: 600; 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  cursor: pointer; 
  transition: all 0.2s; 
}
.export-trigger-btn:hover { background-color: #F5F5F5; color: #37474F; border-color: #B0BEC5; }

/* Variant: On Blue Card */
.export-trigger-btn.on-blue {
    background-color: #FFFFFF;
    border: none;
    color: #37474F;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.export-trigger-btn.on-blue:hover {
    background-color: #F5F5F5;
    color: #263238;
}

/* Icon Only Mode */
.export-trigger-btn.icon-only {
    padding: 6px;
    width: 32px;
    height: 32px;
    justify-content: center;
    border-radius: 8px;
    gap: 0;
}

.export-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #ECEFF1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 160px; z-index: 100; overflow: hidden; padding: 4px; }
.menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; text-align: left; font-size: 13px; color: #37474F; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.menu-item:hover { background-color: #E3F2FD; color: #1565C0; }
.icon-box { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
.excel-icon { background-color: #2E7D32; }
.pdf-icon { background-color: #D32F2F; }
</style>