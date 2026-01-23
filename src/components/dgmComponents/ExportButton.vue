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
    validator: (value) => ['members', 'events', 'page'].includes(value)
  },
  // optional structured page data provided by parent for reliable exports
  pageExportData: {
    type: Object,
    required: false
  }
  ,
  singleEvent: {
    type: Object,
    required: false
  }
  ,
  eventsList: {
    type: Array,
    required: false
  }
})

// expose prop values in template more ergonomically
const { exportType, pageExportData, singleEvent, eventsList } = props

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

    console.log('[ExportButton] exportMembersPDF called', { totalRegistered, firstTimers: firstTimers.length, leaders: leaders.length, volunteers: volunteers.length, regulars: regulars.length });

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

      console.log(`[ExportButton] renderSection() start - ${title}`, { rows: data.length, y });

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

      // After the table, add a short interpretation paragraph for this section
      // Guard against undefined lastAutoTable (older versions or unexpected failures)
      if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
        y = doc.lastAutoTable.finalY + 6;
      } else {
        console.warn('[ExportButton] doc.lastAutoTable.finalY is not available, falling back to y increment');
        y += 6;
      }
      const total = stats.total || 0;
      if (total > 0) {
        const elevate = stats.elevateMale + stats.elevateFemale
        const b1g = stats.b1gMale + stats.b1gFemale
        const pct = (n) => `${Math.round((n / total) * 100)}%`
        const interp = `Interpretation: ${total} total — Elevate ${elevate} (${pct(elevate)}), B1G ${b1g} (${pct(b1g)}). Gender: M ${stats.elevateMale + stats.b1gMale}, F ${stats.elevateFemale + stats.b1gFemale}.`
        doc.setFontSize(9).setFont('helvetica','normal').setTextColor(50)
        const wrapped = doc.splitTextToSize(interp, 170)
        wrapped.forEach(line => {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(line, 18, y)
          y += 5
        })
        y += 6
        console.log(`[ExportButton] wrote interpretation for ${title}, next y=${y}`);
      } else {
        y += 9
      }
    };

    renderSection("First Timers", firstTimers, ['Name', 'Age', 'Age Group', 'Gender', 'Contact #'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '']);
    renderSection("DLeaders", leaders, ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || 'N/A']);
    renderSection("Volunteers", volunteers, ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || '']);
    renderSection("Regular Members", regulars, ['Name', 'Age', 'Age Group', 'Gender', 'Dgroup Leader'], m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.dgroupLeader || 'Unassigned']);

    // After all sections, include a concise report summary / interpretation for the whole report
    try {
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setFontSize(12).setFont('helvetica','bold').text('Report Summary', 15, y)
      y += 8

      const totalMembers = all.length
      const totalFirstTimers = firstTimers.length
      const totalLeaders = leaders.length
      const totalVols = volunteers.length
      const elevateTotal = globalStats.elevate.total
      const b1gTotal = globalStats.b1g.total

      const lines = []
      lines.push(`Total registered members: ${totalMembers}`)
      lines.push(`First Timers: ${totalFirstTimers} (${totalMembers?Math.round((totalFirstTimers/totalMembers)*100):0}%)`)
      lines.push(`Dgroup Leaders: ${totalLeaders} (${totalMembers?Math.round((totalLeaders/totalMembers)*100):0}%)`)
      lines.push(`Volunteers: ${totalVols} (${totalMembers?Math.round((totalVols/totalMembers)*100):0}%)`)
      lines.push(`Elevate members: ${elevateTotal} (${totalMembers?Math.round((elevateTotal/totalMembers)*100):0}%) — M:${globalStats.elevate.male} F:${globalStats.elevate.female}`)
      lines.push(`B1G members: ${b1gTotal} (${totalMembers?Math.round((b1gTotal/totalMembers)*100):0}%) — M:${globalStats.b1g.male} F:${globalStats.b1g.female}`)

      doc.setFontSize(10).setFont('helvetica','normal').setTextColor(60)
      console.log('[ExportButton] writing summary block', { y, totalMembers, totalFirstTimers, totalLeaders, totalVols, elevateTotal, b1gTotal })
      lines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 20 }
        const wrapped = doc.splitTextToSize(line, 170)
        wrapped.forEach(l => { doc.text(l, 18, y); y += 5 })
        y += 4
      })

      // Final overall interpretation
      const overallInterp = `Interpretation: The membership pool shows ${elevateTotal} Elevate and ${b1gTotal} B1G members. First-timer proportion is ${totalMembers?Math.round((totalFirstTimers/totalMembers)*100):0}%, indicating ${ totalFirstTimers>0 ? 'some new engagement' : 'low new engagement' }.`
      if (y > 270) { doc.addPage(); y = 20 }
      const wrappedFinal = doc.splitTextToSize(overallInterp, 170)
      wrappedFinal.forEach(l => { doc.text(l, 18, y); y += 5 })
      y += 6
    } catch (summaryErr) {
      console.warn('Could not write summary block to PDF', summaryErr)
    }

    doc.save(`WKND_Elevate_Members_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("PDF Export Failed:", error);
    alert("An error occurred while exporting PDF. Check console for details.");
  }
}

//  3. EVENTS EXPORT LOGIC
function getEventsData(specificEvent = null) {
  // if a specific event is passed, export only that event
  // if `eventsList` prop is provided (custom list from parent), use that list instead
  let services = []
  if (specificEvent) services = [specificEvent]
  else if (props && props.eventsList && Array.isArray(props.eventsList) && props.eventsList.length) services = props.eventsList
  else if (eventsList && Array.isArray(eventsList) && eventsList.length) services = eventsList
  else services = (allEvents.value || []).filter(e => e.eventType === 'service').sort((a, b) => new Date(b.date) - new Date(a.date))
  if (!services || services.length === 0) return [];

  return services.map(event => {
    const attendees = (allAttendance.value || []).filter(a => a.eventId === event.id);
    const attendeeDetails = (activeMembers.value || []).filter(m => attendees.some(a => a.memberId === m.id));

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
    const data = getEventsData(singleEvent || null);
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
    const data = getEventsData(singleEvent || null);
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

// 4. PAGE (TSV) EXPORT - serializes visible cards under `.event-comparison-improved`
async function exportPageXLSX() {
  try {
    // support receiving a ref or a plain object
    const pdata = (pageExportData && pageExportData.value) ? pageExportData.value : (pageExportData || null)
    const cards = pdata && Array.isArray(pdata.cards) ? pdata.cards : null
    console.log('[ExportButton] exportPageXLSX received pageExportData prop:', pageExportData)
    console.log('[ExportButton] computed pdata:', pdata, 'cards length:', cards ? cards.length : 0)

    // Try to use exceljs for richer styling and embedded images if available
    try {
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
      const wb = new ExcelJS.Workbook()
      wb.creator = 'App'
      wb.created = new Date()

      // Add a cover sheet
      const cover = wb.addWorksheet('Summary')
      cover.mergeCells('A1', 'E1')
      cover.getCell('A1').value = "Event Comparison Export"
      cover.getCell('A1').font = { size: 16, bold: true }
      cover.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' }
      cover.getRow(2).values = ['Generated', new Date().toISOString()]

      // Helper to add card as a worksheet
      const addCardSheet = (card, idx) => {
        const nameBase = card.title ? String(card.title).substring(0, 28) : `Card_${idx+1}`
        const sheetName = wb.getWorksheet(nameBase) ? `${nameBase}_${idx+1}` : nameBase
        const ws = wb.addWorksheet(sheetName)
        let row = 1
        // Add a top header like other exports
        ws.mergeCells(row, 1, row, 6)
        ws.getCell(`A${row}`).value = 'CHRIST COMMISSION FOUNDATION INC.'
        ws.getCell(`A${row}`).font = { bold: true, size: 14 }
        row++
        ws.mergeCells(row, 1, row, 6)
        ws.getCell(`A${row}`).value = card.title || 'Report'
        ws.getCell(`A${row}`).font = { bold: true, size: 12 }
        row++
        if (card.desc) {
          ws.mergeCells(row, 1, row, 6)
          ws.getCell(`A${row}`).value = card.desc
          ws.getCell(`A${row}`).alignment = { wrapText: true }
          row++
        }

        if (card.tableHeaders && card.tableRows) {
          // set headers
          ws.addRow([])
          const headerRow = ws.addRow(card.tableHeaders.map(h => String(h)))
          headerRow.font = { bold: true }
          headerRow.alignment = { horizontal: 'left' }
          headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF2196F3'} }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true } })
          // add data rows
          (card.tableRows || []).forEach(r => {
            if (Array.isArray(r)) ws.addRow(r)
            else if (r && typeof r === 'object') ws.addRow(Object.values(r))
            else ws.addRow([String(r)])
          })
          row = ws.lastRow.number + 1
        }

        if (card.charts && Array.isArray(card.charts)) {
          card.charts.forEach(chart => {
            ws.addRow([])
            ws.addRow([chart.title || chart.label || 'Chart'])
            if (chart.labels) ws.addRow(['Labels', ...(chart.labels || [])])
            if (chart.datasets && Array.isArray(chart.datasets)) {
              chart.datasets.forEach(ds => ws.addRow([ds.label || 'series', ...((ds.raw || ds.data) || [])]))
            } else if (chart.raw) {
              ws.addRow(['Raw', ...(chart.raw || [])])
            }
          })
          row = ws.lastRow.number + 1
        }

        if (card.interpretation) {
          ws.addRow([])
          ws.addRow(['Interpretation:'])
          const lines = String(card.interpretation).split(/\r?\n/)
          lines.forEach(l => {
            const r = ws.addRow([l])
            r.getCell(1).alignment = { wrapText: true }
          })
          row = ws.lastRow.number + 1
        }

        // simple column width adjustments
        ws.columns = ws.columns.map(c => ({ width: Math.max(15, (c.header && String(c.header).length) || 15) }))
      }

      if (cards && cards.length) {
        cards.forEach((c, i) => addCardSheet(c, i))
      } else {
        // DOM fallback: build sheets from DOM cards
        const root = document.querySelector('.event-comparison-improved')
        if (!root) { alert('No comparison content found to export.'); return }
        const elems = Array.from(root.querySelectorAll('.card'))
        elems.forEach((el, i) => {
          const title = el.querySelector('h3')?.innerText || el.querySelector('h4')?.innerText || `Card_${i+1}`
          const desc = el.querySelector('.card-desc')?.innerText || ''
          const card = { title, desc }
          const table = el.querySelector('table')
          if (table) {
            const headers = Array.from(table.querySelectorAll('thead th')).map(t => t.innerText.trim())
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(r => Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim()))
            card.tableHeaders = headers
            card.tableRows = rows
          } else {
            card.interpretation = el.querySelector('.interpretation')?.innerText || ''
          }
          addCardSheet(card, i)
        })
      }

      // Attempt to capture chart canvases and add to a dedicated 'Charts' sheet
      try {
        const canvases = Array.from(document.querySelectorAll('.event-comparison-improved canvas'))
        console.log('[ExportButton] found canvases for embedding:', canvases.length)
        if (canvases.length) {
          const imgSheet = wb.addWorksheet('Charts')
          let row = 1
          for (let i = 0; i < canvases.length; i++) {
            try {
              const canvas = canvases[i]
              // ensure canvas has content (width/height > 0)
              if (!canvas.width || !canvas.height) { console.warn('[ExportButton] canvas has zero dimension, skipping', i); continue }
              const dataUrl = canvas.toDataURL('image/png')
              if (!dataUrl || !dataUrl.startsWith('data:image/png')) { console.warn('[ExportButton] canvas.toDataURL returned invalid dataUrl', i); continue }
              const base64 = dataUrl.split(',')[1]
              const imageId = wb.addImage({ base64, extension: 'png' })
              imgSheet.addImage(imageId, { tl: { col: 0, row: row - 1 }, ext: { width: 480, height: 240 } })
              console.log('[ExportButton] embedded canvas', i, 'as imageId', imageId)
              row += 15
            } catch (imgErr) {
              console.warn('Could not capture chart canvas for Excel image embedding', imgErr)
            }
          }
        }
      } catch (imgCollectionErr) {
        console.warn('Chart image collection failed', imgCollectionErr)
      }

      // write workbook to buffer and trigger download
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const fname = `page_export_${new Date().toISOString().split('T')[0]}.xlsx`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fname
      document.body.appendChild(link)
      link.click()
      link.remove()
      return
    } catch (e) {
      // exceljs unavailable or failed; fall back to xlsx-js-style implementation below
      console.warn('exceljs not available or failed — falling back to xlsx-js-style', e)
    }

    // Fallback: build nicely formatted workbook with xlsx-js-style
    const wb = XLSX.utils.book_new()
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: '2196F3' } }, alignment: { horizontal: 'center' } }

    const appendCardAsSheet = (card, idx) => {
      const rows = []
      if (card.title) rows.push([card.title])
      if (card.desc) rows.push([card.desc])
      rows.push([])

      if (card.tableHeaders && card.tableRows) {
        rows.push(card.tableHeaders)
        card.tableRows.forEach(r => rows.push(Array.isArray(r) ? r : (r && typeof r === 'object' ? Object.values(r) : [String(r)])))
        rows.push([])
      }

      if (card.charts && Array.isArray(card.charts)) {
        card.charts.forEach(chart => {
          rows.push([chart.title || chart.label || 'Chart'])
          if (chart.labels) rows.push(['Labels', ...(chart.labels || [])])
          if (chart.datasets && Array.isArray(chart.datasets)) {
            chart.datasets.forEach(ds => rows.push([ds.label || 'series', ...((ds.raw || ds.data) || [])]))
          } else if (chart.raw) {
            rows.push(['Raw', ...(chart.raw || [])])
          }
          rows.push([])
        })
      }

      if (card.interpretation) {
        rows.push(['Interpretation:'])
        const lines = String(card.interpretation).split(/\r?\n/)
        lines.forEach(l => rows.push([l]))
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      let name = card.title ? String(card.title).substring(0, 31) : `Card_${idx + 1}`
      // ensure unique sheet name
      let uniq = name
      let counter = 1
      while (wb.SheetNames.includes(uniq)) { uniq = (name.substring(0, 28) || 'Card') + `_${counter++}` }
      XLSX.utils.book_append_sheet(wb, ws, uniq)
    }

    if (cards && cards.length) {
      cards.forEach((c, i) => appendCardAsSheet(c, i))
    } else {
      const root = document.querySelector('.event-comparison-improved')
      if (!root) { alert('No comparison content found to export.'); return }
      const elems = Array.from(root.querySelectorAll('.card'))
      elems.forEach((el, i) => {
        const title = el.querySelector('h3')?.innerText?.trim() || el.querySelector('h4')?.innerText?.trim() || `Card_${i + 1}`
        const desc = el.querySelector('.card-desc')?.innerText?.trim() || ''
        const card = { title, desc }
        const table = el.querySelector('table')
        if (table) {
          const headers = Array.from(table.querySelectorAll('thead th')).map(t => t.innerText.trim())
          const rows = Array.from(table.querySelectorAll('tbody tr')).map(r => Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim()))
          card.tableHeaders = headers
          card.tableRows = rows
        } else {
          card.interpretation = el.querySelector('.interpretation')?.innerText?.trim() || ''
        }
        appendCardAsSheet(card, i)
      })
    }

    if (!wb.SheetNames.length) {
      console.warn('No sheets created for XLSX export (no card data)')
      alert('No exportable data found for the page.')
      return
    }
    const fname = `page_export_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fname)
  } catch (err) {
    console.error('Page XLSX export failed', err)
    alert('Page Excel export failed. See console for details.')
  }
}

function exportPagePDF() {
  try {
    const pdata = (pageExportData && pageExportData.value) ? pageExportData.value : (pageExportData || null)
    const cards = pdata && Array.isArray(pdata.cards) ? pdata.cards : null
    console.log('[ExportButton] exportPagePDF received pageExportData prop:', pageExportData)
    console.log('[ExportButton] computed pdata:', pdata, 'cards length:', cards ? cards.length : 0)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    // 1 inch margin -> 25.4 mm
    const margin = 25.4
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    // header area: avoid loading external images (can trigger CORS/file errors)
    doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(13,71,161)
    doc.text("CHRIST'S COMMISSION FELLOWSHIP", margin, margin)
    doc.setFontSize(10).setFont('helvetica','normal').setTextColor(100)
    doc.text('Event Comparison Export', margin, margin + 6)
    doc.line(margin, margin + 9, pageWidth - margin, margin + 9)
    let y = margin + 14

    const writeWrapped = (text) => {
      if (!text) return
      const maxWidth = pageWidth - margin * 2
      const lines = doc.splitTextToSize(String(text), maxWidth)
      lines.forEach(line => {
        if (y > pageHeight - margin - 10) { doc.addPage(); y = margin + 10 }
        doc.setFontSize(10).setFont('helvetica','normal').text(line, margin, y)
        y += 5
      })
    }

    const renderCard = (card) => {
      if (y > pageHeight - margin - 20) { doc.addPage(); y = margin + 10 }
      doc.setFontSize(12).setFont('helvetica','bold').setTextColor(0).text(card.title || 'Card', margin, y)
      y += 6
      if (card.desc) { writeWrapped(card.desc); y += 4 }

      if (card.tableHeaders && card.tableRows) {
        autoTable(doc, { startY: y, head: [card.tableHeaders], body: card.tableRows, theme: 'grid', styles: { fontSize: 9 }, margin: { left: margin, right: margin } })
        y = doc.lastAutoTable.finalY + 8
      }

      if (card.charts && Array.isArray(card.charts)) {
        card.charts.forEach(chart => {
          if (y > pageHeight - margin - 20) { doc.addPage(); y = margin + 10 }
          doc.setFontSize(10).setFont('helvetica','bold').text(chart.title || chart.label || 'Chart data', margin, y)
          y += 6
          const rows = []
          if (chart.labels) rows.push(['labels', ...chart.labels])
          if (chart.datasets) {
            chart.datasets.forEach(ds => rows.push([ds.label || 'series', ...(ds.raw || ds.data || [])]))
          } else if (chart.raw) {
            rows.push(['raw', ...(chart.raw || [])])
          }
          if (rows.length) {
            autoTable(doc, { startY: y, body: rows, styles: { fontSize: 8 }, margin: { left: margin, right: margin }, theme: 'grid' })
            y = doc.lastAutoTable.finalY + 8
          }
        })
      }

      if (card.interpretation) { writeWrapped(card.interpretation); y += 8 }
    }

    if (cards) {
      if (!cards.length) { alert('No card data available to export.'); return }
      cards.forEach(c => renderCard(c))
    } else {
      // fallback: simple DOM fallback
      const root = document.querySelector('.event-comparison-improved')
      if (!root) { alert('No content to export.'); return }
      const elems = Array.from(root.querySelectorAll('.card'))
      elems.forEach(el => {
        const title = el.querySelector('h3')?.innerText || el.querySelector('h4')?.innerText || 'Card'
        const desc = el.querySelector('.card-desc')?.innerText || ''
        // Attempt to capture any Chart.js data from canvases inside this card
        const charts = []
        try {
          const canvases = Array.from(el.querySelectorAll('canvas'))
          canvases.forEach((cv) => {
            try {
              let chartInstance = null
              if (window.Chart && typeof window.Chart.getChart === 'function') chartInstance = window.Chart.getChart(cv)
              if (!chartInstance && cv.__chart__) chartInstance = cv.__chart__
              if (!chartInstance && cv._chart) chartInstance = cv._chart
              if (chartInstance && chartInstance.data) {
                const chart = { title: (chartInstance.options && chartInstance.options.plugins && chartInstance.options.plugins.title && chartInstance.options.plugins.title.text) || '', labels: chartInstance.data.labels || [], datasets: (chartInstance.data.datasets || []).map(ds => ({ label: ds.label || '', raw: ds.data ? ds.data.slice() : (ds._data ? ds._data.slice() : []) })) }
                charts.push(chart)
              }
            } catch (cErr) { /* ignore per-canvas errors */ }
          })
        } catch (e) { /* no canvases or error */ }

        renderCard({ title, desc, tableHeaders: null, tableRows: null, charts: charts.length ? charts : null, interpretation: el.querySelector('.interpretation')?.innerText || '' })
      })
    }

    doc.save(`page_export_${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (err) {
    console.error('Page PDF export failed', err)
    alert('Page PDF export failed. See console for details.')
  }
}

// --- Main Handler ---
function handleExport(type) {
  showMenu.value = false;
  // Executing directly to ensure browser doesn't block downloads (sync context preferable)
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
}
</script>

<template>
  <div class="export-dropdown-wrapper">
    <div v-if="showMenu" class="menu-overlay" @click="showMenu = false" aria-hidden="true"></div>
      <button class="export-trigger-btn" @click="showMenu = !showMenu" aria-haspopup="true" :aria-expanded="showMenu">
      <Download :size="16" />
      Export
      <ChevronDown :size="14" />
    </button>
      <div v-if="showMenu" class="export-menu" role="menu" aria-label="Export menu">
        <!-- For page exports show only XLSX and PDF (no other generic items) -->
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
        <!-- For members/events keep the existing generic Excel/PDF actions -->
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
.export-trigger-btn { position: relative; z-index: 95; background-color: #fff; border: 1px solid #CFD8DC; color: #546E7A; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
.export-trigger-btn:hover { background-color: #F5F5F5; color: #37474F; border-color: #B0BEC5; }
.export-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #ECEFF1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 160px; z-index: 100; overflow: hidden; padding: 4px; }
.menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; text-align: left; font-size: 13px; color: #37474F; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.menu-item:hover { background-color: #E3F2FD; color: #1565C0; }
.icon-box { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
.excel-icon { background-color: #2E7D32; }
.pdf-icon { background-color: #D32F2F; }
</style>