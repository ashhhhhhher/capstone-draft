<script setup>
import { computed } from 'vue'
import { Download, FileText } from 'lucide-vue-next'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useMembersStore } from '../stores/members'
import buildComparisonPayload from '../utils/eventComparisonExport'
import { useEventsStore } from '../stores/events'
import { useAttendanceStore } from '../stores/attendance'
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

// Safe, reactive wrappers around props so template and script don't error
const attendees = computed(() => props.attendees || [])
const eventName = computed(() => props.eventName || '')
const eventDate = computed(() => props.eventDate || '')
const eventLocation = computed(() => props.eventLocation || '')
const eventSpeaker = computed(() => props.eventSpeaker || '')
const eventSeries = computed(() => props.eventSeries || '')
const filterTitle = computed(() => props.filterTitle || '')

const emit = defineEmits(['close'])

// --- Store Access for Attendance Rate ---
const membersStore = useMembersStore()
const { members, activeMembers } = storeToRefs(membersStore)
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()
const { allEvents } = storeToRefs(eventsStore)
const { allAttendance } = storeToRefs(attendanceStore)

// --- SORTING LOGIC ---
const sortedAttendees = computed(() => {
  return [...attendees.value].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  )
})

// Helper for sorting
function sortByName(list) {
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}


// =========================================================================
//  1. EXCEL EXPORT (Preserved Existing Logic)
// =========================================================================
function exportToExcel() {
  console.log('[AttendanceListModal] exportToExcel called', { eventName: eventName.value, attendees: (attendees && attendees.value) ? attendees.value.length : 0 })
  const source = attendees.value;
  const firstTimers = sortByName(source.filter(m => m.finalTags?.isFirstTimer));
  const leaders = sortByName(source.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isDgroupLeader));
  const volunteers = sortByName(source.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && m.finalTags?.isVolunteer));
  const regulars = source.filter(m => !m.finalTags?.isFirstTimer && !m.finalTags?.isDgroupLeader && !m.finalTags?.isVolunteer);
  
  const elevateMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags?.ageCategory === 'Elevate'));
  const elevateFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags?.ageCategory === 'Elevate'));
  const b1gMales = sortByName(regulars.filter(m => m.gender === 'Male' && m.finalTags?.ageCategory === 'B1G'));
  const b1gFemales = sortByName(regulars.filter(m => m.gender === 'Female' && m.finalTags?.ageCategory === 'B1G'));

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

  // Create an Event Comparison sheet using the same styling approach as `createSheet`
  const createComparisonSheet = (payload) => {
    try {
      const cards = (payload && payload.cards) ? payload.cards : [];
      const compCurrent = payload?.current || {};
      const compPrevious = payload?.previous || [];

      const compRows = [];
      compRows.push(["CHRIST COMMISSION FOUNDATION INC."]);
      compRows.push(['']);
      compRows.push(['Event Comparison (Current vs Previous 3)']);
      compRows.push(['']);

      // Event Details block
      const totalAttended = source.length;
      const totalRegistered = (members && members.value) ? members.value.length : 0;
      const attRate = totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0;
      compRows.push(['Event Details']);
      compRows.push(['Name of Event', eventName.value || 'N/A']);
      compRows.push(['Date', eventDate.value || 'N/A']);
      compRows.push(['Speaker', eventSpeaker.value || 'N/A']);
      compRows.push(['Venue', eventLocation.value || 'N/A']);
      compRows.push(['Series', eventSeries.value || 'N/A']);
      compRows.push(['Total Attendees', String(totalAttended)]);
      compRows.push(['Attendance Rate', `${attRate}%`]);
      compRows.push(['']);

      // Summary (dynamic values)
      const prevTotals = (compPrevious || []).map(p => ({ name: p.name || 'Unknown', total: p.total || 0 }));
      const prevSum = prevTotals.reduce((s, p) => s + (p.total || 0), 0);
      const prevAvg = prevTotals.length ? Math.round(prevSum / prevTotals.length) : 0;
      const prevListText = prevTotals.length ? prevTotals.map(p => `${p.name} (${p.total})`).join(', ') : 'none';
      const prevCombined = { elevate: (compPrevious || []).reduce((s,p) => s + (p.elevate||0), 0), b1g: (compPrevious || []).reduce((s,p) => s + (p.b1g||0), 0), firstTimers: (compPrevious || []).reduce((s,p) => s + (p.firstTimers||0), 0) };
      compRows.push(['Summary']);
      compRows.push([`Event: ${compCurrent.name || 'N/A'}`]);
      compRows.push([`Current attendees: ${compCurrent.total || 0}`]);
      compRows.push([`Previous events: ${prevListText}`]);
      compRows.push([`Previous average: ${prevAvg}`]);
      compRows.push([`Elevate — Current: ${compCurrent.elevate || 0}; Previous combined: ${prevCombined.elevate}`]);
      compRows.push([`B1G — Current: ${compCurrent.b1g || 0}; Previous combined: ${prevCombined.b1g}`]);
      compRows.push([`First Timers — Current: ${compCurrent.firstTimers || 0}; Previous combined: ${prevCombined.firstTimers}`]);
      compRows.push([`Attendance rate: ${attRate}%`]);
      compRows.push(['']);

      // Event Comparison Overview table
      compRows.push(['Type','Event Name','Date','Total','Elevate','B1G','First Timers','Volunteers']);
      if (compCurrent && compCurrent.name) {
        compRows.push(['Current', compCurrent.name, compCurrent.date || '', String(compCurrent.total || 0), String(compCurrent.elevate || 0), String(compCurrent.b1g || 0), String(compCurrent.firstTimers || 0), String(compCurrent.volunteers || 0)]);
      }
      (compPrevious || []).forEach(p => {
        compRows.push(['Previous', p.name || '', p.date || '', String(p.total || 0), String(p.elevate || 0), String(p.b1g || 0), String(p.firstTimers || 0), String(p.volunteers || 0)]);
      });
      compRows.push(['']);

      // Absence Monitoring (current vs previous avg)
      const prevCount = compPrevious.length || 0;
      const prevTotalSum = compPrevious.reduce((s,p) => s + (p.total || 0), 0);
      const prevAvgTotal = prevCount ? Math.round(prevTotalSum / prevCount) : 0;
      const currentPresent = compCurrent.total || 0;
      const activeCount = (activeMembers && activeMembers.value) ? activeMembers.value.length : (members && members.value ? members.value.length : 0);
      const currentAbsent = Math.max(0, activeCount - currentPresent);
      compRows.push(['Absence Monitoring']);
      compRows.push(['Metric','Current','Previous (avg)']);
      compRows.push(['Present (avg)', String(currentPresent), String(prevAvgTotal)]);
      compRows.push(['Absent (avg)', String(currentAbsent), String(Math.max(0, activeCount - prevAvgTotal))]);
      compRows.push(['']);

      // Demographics averaged (current vs previous avg)
      const demographicsForEventId = (eventId) => {
        const recs = (allAttendance.value || []).filter(a => a.eventId === eventId);
        const memberList = (members.value || []).filter(m => recs.some(r => r.memberId === m.id));
        const males = memberList.filter(m => m.gender === 'Male').length;
        const females = memberList.filter(m => m.gender === 'Female').length;
        const elevate = memberList.filter(m => m.finalTags?.ageCategory === 'Elevate').length;
        const b1g = memberList.filter(m => m.finalTags?.ageCategory === 'B1G').length;
        return { males, females, elevate, b1g };
      };

      const currentDemo = compCurrent.id ? demographicsForEventId(compCurrent.id) : { males:0, females:0, elevate:0, b1g:0 };
      const prevDemos = (compPrevious || []).map(p => p.id ? demographicsForEventId(p.id) : { males:0, females:0, elevate:0, b1g:0 });
      const avgPrevDemo = prevDemos.length ? prevDemos.reduce((acc, d) => ({ males: acc.males + d.males, females: acc.females + d.females, elevate: acc.elevate + d.elevate, b1g: acc.b1g + d.b1g }), { males:0, females:0, elevate:0, b1g:0 }) : { males:0, females:0, elevate:0, b1g:0 };
      const avgPrevDemoFinal = prevDemos.length ? { males: Math.round(avgPrevDemo.males / prevDemos.length), females: Math.round(avgPrevDemo.females / prevDemos.length), elevate: Math.round(avgPrevDemo.elevate / prevDemos.length), b1g: Math.round(avgPrevDemo.b1g / prevDemos.length) } : { males:0, females:0, elevate:0, b1g:0 };
      compRows.push(['Demographics (Current vs Previous avg)']);
      compRows.push(['Metric','Current','Previous (avg)']);
      compRows.push(['Males', String(currentDemo.males), String(avgPrevDemoFinal.males)]);
      compRows.push(['Females', String(currentDemo.females), String(avgPrevDemoFinal.females)]);
      compRows.push(['Elevate', String(currentDemo.elevate), String(avgPrevDemoFinal.elevate)]);
      compRows.push(['B1G', String(currentDemo.b1g), String(avgPrevDemoFinal.b1g)]);
      compRows.push(['']);

      // Append any remaining cards (charts/interpretation)
      cards.forEach(card => {
        compRows.push([card.title || 'Card']);
        compRows.push(['']);
        if (card.tableHeaders && Array.isArray(card.tableRows)) {
          compRows.push(card.tableHeaders.slice());
          (card.tableRows || []).forEach(r => compRows.push(r.slice()));
          compRows.push(['']);
        }
        if (card.charts && Array.isArray(card.charts)) {
          card.charts.forEach(chart => {
            compRows.push([chart.title || 'Chart']);
            const labels = chart.labels || [];
            const datasets = chart.datasets || [];
            const header = ['Label'].concat(datasets.map(d => d.label || 'series'));
            compRows.push(header);
            labels.forEach((lbl, idx) => {
              const row = [lbl].concat(datasets.map(d => (Array.isArray(d.raw) && d.raw[idx] !== undefined) ? d.raw[idx] : (Array.isArray(d.data) && d.data[idx] !== undefined ? d.data[idx] : '')));
              compRows.push(row);
            });
            compRows.push(['']);
          });
        }
        if (card.interpretation) {
          compRows.push(['Interpretation:']);
          compRows.push([card.interpretation]);
          compRows.push(['']);
        }
        compRows.push(['']);
      });

      // Create sheet from compRows and apply styles similar to createSheet
      if (!Array.isArray(compRows)) throw new Error('Comparison rows not an array');
      const ws = XLSX.utils.aoa_to_sheet(compRows);
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const colWidths = [];
        for (let r = range.s.r; r <= range.e.r; ++r) {
          const row = compRows[r] || [];
          row.forEach((cell, cIdx) => {
            const len = cell ? String(cell).length : 0;
            colWidths[cIdx] = Math.max(colWidths[cIdx] || 12, Math.min(len + 6, 60));
          });
        }

        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddr]) continue;
            const row0 = compRows[R] && compRows[R][0] ? String(compRows[R][0]) : '';

            if (R === 0) {
              ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, mainTitleStyle);
              continue;
            }

            if (['Event Comparison (Current vs Previous 3)', 'Event Details', 'Summary', 'Absence Monitoring', 'Demographics (Current vs Previous avg)'].includes(row0) || (row0 && row0.endsWith('Card'))) {
              ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, tableTitleStyle);
              continue;
            }

            if (Array.isArray(compRows[R]) && (compRows[R][0] === 'Type' || compRows[R][0] === 'Metric' || (compRows[R].length > 1 && String(compRows[R][0]).toLowerCase().includes('type')) || (compRows[R].some(v => String(v).toLowerCase && String(v).toLowerCase().includes('label'))))) {
              ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, tableHeaderStyle);
              continue;
            }

            if (row0 === 'Interpretation:' || (row0 && row0.startsWith('Interpretation:'))) {
              ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, { font: { italic: true }, alignment: { wrapText: true, horizontal: 'left' } });
              continue;
            }

            if (compRows[R] && compRows[R][0] === 'Current') {
              ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, { fill: { fgColor: { rgb: 'FFF3CD' } }, font: Object.assign({}, (ws[cellAddr].s && ws[cellAddr].s.font) || {}, { bold: true }), alignment: Object.assign({}, (ws[cellAddr].s && ws[cellAddr].s.alignment) || {}, { wrapText: true }) });
              continue;
            }

            ws[cellAddr].s = Object.assign({}, ws[cellAddr].s || {}, cellStyle);
          }
        }

        const merges = ws['!merges'] || [];
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const row0 = compRows[R] && compRows[R][0] ? String(compRows[R][0]) : '';
          if (row0 === 'Interpretation:' || row0 === 'Summary' || row0 === 'Event Details' || row0 === 'Demographics (Current vs Previous avg)' || row0 === 'Absence Monitoring' || row0 === 'Event Comparison (Current vs Previous 3)' ) {
            const next = R + 1;
            if (next <= range.e.r) merges.push({ s: { r: R, c: 0 }, e: { r: next, c: range.e.c } });
          }
        }
        ws['!merges'] = merges;

        ws['!cols'] = colWidths.map(w => ({ wch: w }));
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Event Comparison');
    } catch (e) {
      console.warn('Comparison sheet build failed', e);
    }
  };

  const createSheet = (sheetTabName, sheetTitle, tableHeaders, memberList, mapFunction) => {
    const colCount = tableHeaders.length;
    const rows = [
      ["CHRIST COMMISSION FOUNDATION INC."], [""],
      createMetadataRow(`Name of Event: ${eventName.value}`, `Speaker: ${eventSpeaker.value || 'N/A'}`, colCount),
      createMetadataRow(`Venue: ${eventLocation.value || 'N/A'}`, `Series: ${eventSeries.value || 'N/A'}`, colCount),
      createMetadataRow(`Ministry: Elevate Baguio x B1G Baguio`, `Date: ${eventDate.value}`, colCount),
      createMetadataRow(`Ministry in-charge: Elevate Baguio`, "", colCount),
      [""], [sheetTitle], tableHeaders
    ];

    if (memberList.length > 0) { memberList.forEach(m => rows.push(mapFunction(m))); } 
    else { rows.push(["No attendees in this category."]); }

      // Add interpretation lines for this sheet
    const total = memberList.length || 0;
    const elevate = memberList.filter(m => m.finalTags?.ageCategory === 'Elevate').length;
    const b1g = memberList.filter(m => m.finalTags?.ageCategory === 'B1G').length;
    const male = memberList.filter(m => m.gender === 'Male').length;
    const female = memberList.filter(m => m.gender === 'Female').length;
    const pct = (n) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';
    rows.push([]);
    rows.push(['Interpretation:']);
    rows.push([`Total: ${total} — Elevate ${elevate} (${pct(elevate)}), B1G ${b1g} (${pct(b1g)}). Gender: M ${male}, F ${female}.`]);

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
        else if (R > 8 && R <= range.e.r - 3) ws[cellAddress].s = cellStyle;
        else {
          // Style interpretation rows slightly differently (italic, smaller)
          ws[cellAddress].s = { font: { italic: true }, alignment: { wrapText: true, horizontal: 'left' } };
        }
      }
    }
    // merge title and sheet title rows + interpretation rows so text spans full width
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, { s: { r: 7, c: 0 }, e: { r: 7, c: colCount - 1 } }];
    // interpretation rows are expected to be the last 3 pushed: empty, 'Interpretation:', <text>
    const interpRowIndex = rows.length - 2; // index of 'Interpretation:'
    if (interpRowIndex >= 0) {
      merges.push({ s: { r: interpRowIndex, c: 0 }, e: { r: interpRowIndex, c: colCount - 1 } });
      merges.push({ s: { r: interpRowIndex + 1, c: 0 }, e: { r: interpRowIndex + 1, c: colCount - 1 } });
    }
    ws['!merges'] = merges;
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
  // Prepend Event Comparison sheet (current vs previous 3) to workbook using helper
  try {
    const payload = buildComparisonPayload({ allEvents: allEvents.value || [], allAttendance: allAttendance.value || [], members: members.value || [], activeMembers: (activeMembers && activeMembers.value) ? activeMembers.value : (members && members.value) ? members.value : [] })
    console.log('[AttendanceListModal] comparison payload for xlsx', payload && payload.cards ? payload.cards.map(c=>c.title) : 'no-cards')
    createComparisonSheet(payload)
  } catch (e) { console.warn('Comparison sheet build failed', e) }
  createSheet("Volunteers", "ATTENDANCE SHEET - VOLUNTEERS", ["Name", "Age", "Gender", "Ministry"], volunteers, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, (m.finalTags?.volunteerMinistry || []).join(', ')]);
  createSheet("DLeaders", "ATTENDANCE SHEET - DLEADERS", ["Name", "Age", "Gender", "Volunteer Ministry"], leaders, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, (m.finalTags?.volunteerMinistry || []).join(', ') || 'N/A']);
  createSheet("Elevate F", "ATTENDANCE SHEET - DGROUP MEMBERS (ELEVATE FEMALES)", ["Name", "Age", "DLeader Name"], elevateFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("Elevate M", "ATTENDANCE SHEET - DGROUP MEMBERS (ELEVATE MALES)", ["Name", "Age", "DLeader Name"], elevateMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("B1G F", "ATTENDANCE SHEET - DGROUP MEMBERS (B1G FEMALES)", ["Name", "Age", "DLeader Name"], b1gFemales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  createSheet("B1G M", "ATTENDANCE SHEET - DGROUP MEMBERS (B1G MALES)", ["Name", "Age", "DLeader Name"], b1gMales, (m) => [`${m.lastName}, ${m.firstName}`, m.age, m.dgroupLeader || 'Unassigned']);
  console.log('[AttendanceListModal] workbook sheets before write', wb && wb.SheetNames ? wb.SheetNames.slice() : [])
  XLSX.writeFile(wb, `${eventName.value || 'Attendance'} - Attendance Report.xlsx`);
}

// =========================================================================
//  2. PDF EXPORT (Enhanced Report Layout)
// =========================================================================
function exportToPDF() {
  console.log('[AttendanceListModal] exportToPDF called', {
    eventName: eventName.value,
    attendees: attendees?.value?.length || 0
  });

  const doc = new jsPDF();
  let y = 15;

  // Utility for section headers
const writeSectionHeader = (title) => {
  y += 6;
  if (y > 260) { doc.addPage(); y = 20; }

  doc.setFontSize(12.5)
     .setFont("helvetica", "bold")
     .setTextColor(13, 71, 161);

  doc.text(title, 15, y);
  y += 4;
  doc.setDrawColor(200).line(15, y, 195, y);
  y += 10;
};

  // Utility for paragraph writing
const writeParagraph = (text) => {
  // Adjust after autotable
  try {
    if (doc.lastAutoTable && doc.lastAutoTable.finalY) {
      const tableBottom = doc.lastAutoTable.finalY;
      if (y <= tableBottom + 4) y = tableBottom + 6;
    }
  } catch (e) {}

  // Use 95% of content width
  const wrapped = doc.splitTextToSize(text, 250);

  // Text bigger by 0.5 & left-aligned & justified width
  doc.setFontSize(9.5)
     .setFont("helvetica", "normal")
     .setTextColor(70);

  // Render each line, coloring numeric values blue while leaving other text default
  const valueRegex = /(\+?-?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?%?|\(\d{1,3}(?:[.,]\d{3})*\))/g;
  wrapped.forEach(line => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    let x = 15;
    let lastIndex = 0;
    let m;
    while ((m = valueRegex.exec(line)) !== null) {
      // text before match
      if (m.index > lastIndex) {
        const before = line.substring(lastIndex, m.index);
        doc.setTextColor(70);
        doc.text(before, x, y, { align: 'left' });
        x += doc.getTextWidth(before);
      }

      // matched value - decide whether to style or render normally
      const val = m[0];
      const prevChar = m.index > 0 ? line[m.index - 1] : '';
      const nextChar = (m.index + val.length) < line.length ? line[m.index + val.length] : '';
      const adjacentIsLetter = /[A-Za-z]/.test(prevChar) || /[A-Za-z]/.test(nextChar);

      if (adjacentIsLetter) {
        // part of a word (e.g., 'B1G' or 'Event 1') — render as normal text
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70);
        doc.text(val, x, y, { align: 'left' });
        x += doc.getTextWidth(val);
      } else {
        // standalone numeric/value -> blue + bold
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 71, 161);
        doc.text(val, x, y, { align: 'left' });
        x += doc.getTextWidth(val);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70);
      }

      lastIndex = m.index + val.length;
    }

    // remaining text after last match
    if (lastIndex < line.length) {
      const rest = line.substring(lastIndex);
      doc.setTextColor(70);
      doc.text(rest, x, y, { align: 'left' });
    }

    // reset color to default for subsequent content
    doc.setTextColor(70);
    y += 5.2;
  });

  y += 3;
};


  // =========================================================================
  // HEADER
  // =========================================================================
  try { doc.addImage('/ccf logo.png', 'PNG', 15, y, 20, 20); } catch (e) {}
  doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(13, 71, 161);
  doc.text("CHRIST'S COMMISSION FELLOWSHIP", 40, y + 10);

  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100);
  doc.text("Event Attendance Report", 40, y + 16);

  y += 28;
  doc.line(15, y, 195, y);
  y += 10;

  // =========================================================================
  // EVENT DETAILS
  // =========================================================================
  writeSectionHeader("Event Details");

  doc.setFontSize(10).setTextColor(0);
  doc.text(`Event: ${eventName.value}`, 15, y); y += 5;
  doc.text(`Date: ${eventDate.value}`, 15, y); y += 5;
  doc.text(`Speaker: ${eventSpeaker.value || 'N/A'}`, 120, y - 10);
  doc.text(`Venue: ${eventLocation.value || 'N/A'}`, 120, y - 5);

  y += 8;
  // Move concise summary metrics into Event Details (no separate Summary header)
  const totalAttended = attendees.value.length;
  const totalRegistered = members.value ? members.value.length : 0;
  const rate = totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0;

  doc.text(`Total Attendees: ${totalAttended}`, 15, y); y += 5;
  doc.text(`Attendance Rate: ${rate}%`, 15, y); y += 10;

    // =========================================================================
  // SAVE
  // =========================================================================
  // Add a concise 100-word summary paragraph on the final page
try {
  // Recompute comparison payload to ensure we have latest values
  const payloadFinal = buildComparisonPayload({ 
    allEvents: allEvents.value || [], 
    allAttendance: allAttendance.value || [], 
    members: members.value || [], 
    activeMembers: activeMembers?.value || members?.value || [] 
  });

  const compFinal = { current: payloadFinal.current, previous: payloadFinal.previous };
  const prevTotalsFinal = (compFinal.previous || []).map(p => ({ name: p.name || 'Unknown', total: p.total || 0 }));
  const prevSumFinal = prevTotalsFinal.reduce((s, p) => s + (p.total || 0), 0);
  const prevAvgFinal = (prevTotalsFinal.length) ? Math.round(prevSumFinal / prevTotalsFinal.length) : 0;
  const prevListTextFinal = prevTotalsFinal.length ? prevTotalsFinal.map(p => `${p.name} (${p.total})`).join(', ') : 'none';
  const prevCombinedFinal = { 
    elevate: (compFinal.previous || []).reduce((s,p) => s + (p.elevate||0), 0), 
    b1g: (compFinal.previous || []).reduce((s,p) => s + (p.b1g||0), 0), 
    firstTimers: (compFinal.previous || []).reduce((s,p) => s + (p.firstTimers||0), 0) 
  };
  const currentTotalFinal = compFinal.current?.total || 0;

  writeSectionHeader('Summary');

  // Human-readable summary paragraph
  writeParagraph(
    `    This report provides an overview of attendance for the event "${compFinal.current?.name || 'N/A'}" compared to the previous three events. A total of ${currentTotalFinal} attendees participated in the current event, while previous events — ${prevListTextFinal} — averaged ${prevAvgFinal} participants. 

    Looking at specific groups, the Elevate category had ${compFinal.current?.elevate || 0} attendees (previous average: ${prevAvgFinal.elevate}), the B1G group had ${compFinal.current?.b1g || 0} attendees (previous average: ${prevAvgFinal.b1g}), and First Timers totaled ${compFinal.current?.firstTimers || 0} (previous average: ${prevAvgFinal.firstTimers}). 

    Overall, the attendance rate was ${rate}%. Key insights, including absence monitoring and demographics, are summarized in the following sections, along with member breakdowns for First Timers, Leaders, Volunteers, and B1G/Elevate cohorts. This summary is intended to provide a concise yet comprehensive snapshot of event participation and engagement trends.`
  );

} catch (e) { 
  console.warn('Failed writing summary paragraph', e); 
}

  // =========================================================================
  // EVENT COMPARISON
  // =========================================================================
  try {
    writeSectionHeader("Event Comparison Overview (Current vs Previous 3)");

    const payload = buildComparisonPayload({
      allEvents: allEvents.value || [],
      allAttendance: allAttendance.value || [],
      members: members.value || [],
      activeMembers: activeMembers?.value || members?.value || []
    });

    const comp = { current: payload.current, previous: payload.previous };
    const compBody = [];

    if (comp.current?.name) {
      compBody.push([
        'Current',
        comp.current.name,
        comp.current.date,
        comp.current.total,
        comp.current.elevate,
        comp.current.b1g,
        comp.current.firstTimers,
        comp.current.volunteers
      ]);
    }

    (comp.previous || []).forEach(p => {
      compBody.push([
        'Previous',
        p.name,
        p.date,
        p.total,
        p.elevate,
        p.b1g,
        p.firstTimers,
        p.volunteers
      ]);
    });

    if (compBody.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Type','Event Name','Date','Total','Elevate','B1G','First Timers','Volunteers']],
        body: compBody,
        headStyles: { fillColor: [33,150,243], textColor: [255,255,255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        margin: { left: 15, right: 15 },
        didParseCell: function (data) {
          // highlight the 'Current' row (first body row) for clarity
          if (data.row && data.row.section === 'body' && data.row.index === 0) {
            data.cell.styles.fillColor = [255, 243, 205]; // light yellow
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = doc.lastAutoTable.finalY + 8;

      // Comparison paragraph - clearer numeric summary and direction
      const prevTotals = (comp.previous || []).map(p => ({ name: p.name || 'Unknown', total: p.total || 0 }));
      const prevSum = prevTotals.reduce((s, p) => s + (p.total || 0), 0);
      const prevAvg = (prevTotals.length) ? Math.round(prevSum / prevTotals.length) : 0;
      const currentTotal = comp.current?.total || 0;
      const delta = currentTotal - prevAvg;
      const direction = delta > 0 ? 'increased' : (delta < 0 ? 'decreased' : 'no change');
      const pctChange = (prevAvg && prevAvg !== 0) ? Math.round((delta / prevAvg) * 100) : null;

      // Build a concise attendance totals summary listing previous events and their totals
      const prevListText = prevTotals.length ? prevTotals.map(p => `${p.name} (${p.total})`).join(', ') : 'none';

      let summaryText = `The current event: ${comp.current?.name || 'N/A'} had a total of (${currentTotal}) attendees. Previous events: ${prevListText} had ${prevAvg} participants on average.`;
      if (pctChange !== null) {
        const sign = pctChange > 0 ? '+' : '';
        summaryText += ` This ${direction} by ${Math.abs(delta)} (${sign}${pctChange}%) compared with the previous average.`;
      } else if (direction !== 'had no change') {
        summaryText += ` This ${direction} by ${Math.abs(delta)} (unable to compute percent change because previous average is 0).`;
      } else {
        summaryText += ` There was no change compared with the previous average.`;
      }

      // Add a short sentence about Elevate/B1G/FirstTimers comparisons using combined previous counts
      const prevCombined = { elevate: (comp.previous || []).reduce((s,p) => s + (p.elevate||0), 0), b1g: (comp.previous || []).reduce((s,p) => s + (p.b1g||0), 0), firstTimers: (comp.previous || []).reduce((s,p) => s + (p.firstTimers||0), 0) };
      const elevText = `Elevate had ${comp.current?.elevate || 0} attendees compared to previous event averagee of ${prevAvg.elevate}.`;
      const b1gText = `B1g had ${comp.current?.b1g || 0} attendees compared to previous event average of ${prevAvg.b1g}.`;
      const ftText = `Lasty, there were  ${comp.current?.firstTimers || 0} first-time attendees in the current event.`;

      writeParagraph(`${summaryText} ${elevText} ${b1gText} ${ftText}`);

      // Render only the Absence Monitoring card (keep Overview table above)
      try {
        const cards = (payload && payload.cards) ? payload.cards : []
        const absenceCard = cards.find(c => (c.title || '').toLowerCase().includes('absence'))
        console.log('[AttendanceListModal] PDF rendering comparison - found absence card?', !!absenceCard)
        if (absenceCard) {
          writeSectionHeader(absenceCard.title || 'Absence monitoring')

          // Compute previous average totals (previous array from payload)
          const prevSummaries = payload.previous || []
          const prevCount = prevSummaries.length || 0
          const prevTotalSum = prevSummaries.reduce((s,p) => s + (p.total || 0), 0)
          const prevAvgTotal = prevCount ? Math.round(prevTotalSum / prevCount) : 0

          // Current present/absent (using comp.current.total as present unique approximation)
          const currentPresent = comp.current?.total || 0
          const currentAbsent = (Array.isArray(activeMembers?.value) ? activeMembers.value.length : (members?.value ? members.value.length : 0)) - currentPresent

          // Build absence table showing averages instead of combined previous
          const absenceHead = ['Metric', 'Current', 'Previous (avg)']
          const absenceBody = [
            ['Present (avg)', String(currentPresent), String(prevAvgTotal)],
            ['Absent (avg)', String(currentAbsent >= 0 ? currentAbsent : 0), String(Math.max(0, (Array.isArray(activeMembers?.value) ? activeMembers.value.length : (members?.value ? members.value.length : 0)) - prevAvgTotal))]
          ]

          autoTable(doc, {
            startY: y,
            head: [absenceHead],
            body: absenceBody,
            headStyles: { fillColor: [33,150,243], textColor: [255,255,255], fontStyle: 'bold' },
            styles: { fontSize: 9 },
            margin: { left: 15, right: 15 }
          })
          y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 8

          // If absenceCard has interpretation, keep it but adapt to averages
          if (absenceCard.interpretation) {
            // adapt interpretation to show averages
            const interp = `Interpretation (avg): ${absenceCard.interpretation}`
            writeParagraph(interp)
          }

          // Add demographics averaged table (per-event averages for previous)
          // Helper to compute demographics for a given event id
          const demographicsForEventId = (eventId) => {
            const recs = (allAttendance.value || []).filter(a => a.eventId === eventId)
            const memberList = (members.value || []).filter(m => recs.some(r => r.memberId === m.id))
            const males = memberList.filter(m => m.gender === 'Male').length
            const females = memberList.filter(m => m.gender === 'Female').length
            const elevate = memberList.filter(m => m.finalTags?.ageCategory === 'Elevate').length
            const b1g = memberList.filter(m => m.finalTags?.ageCategory === 'B1G').length
            return { males, females, elevate, b1g }
          }

          // Current demographics (from comp.current.id if present)
          const currentDemo = comp.current && comp.current.id ? demographicsForEventId(comp.current.id) : { males: 0, females: 0, elevate: 0, b1g: 0 }

          // Previous per-event demographics averaged
          const prevDemos = prevSummaries.map(p => p.id ? demographicsForEventId(p.id) : { males: 0, females: 0, elevate: 0, b1g: 0 })
          const avgPrevDemo = prevDemos.length ? prevDemos.reduce((acc, d) => ({ males: acc.males + d.males, females: acc.females + d.females, elevate: acc.elevate + d.elevate, b1g: acc.b1g + d.b1g }), { males:0, females:0, elevate:0, b1g:0 }) : { males:0, females:0, elevate:0, b1g:0 }
          const avgPrevDemoFinal = prevDemos.length ? { males: Math.round(avgPrevDemo.males / prevDemos.length), females: Math.round(avgPrevDemo.females / prevDemos.length), elevate: Math.round(avgPrevDemo.elevate / prevDemos.length), b1g: Math.round(avgPrevDemo.b1g / prevDemos.length) } : { males:0, females:0, elevate:0, b1g:0 }

          // Render demographics avg table
          const demoHead = ['Metric', 'Current', 'Previous (avg)']
          const demoBody = [
            ['Males', String(currentDemo.males), String(avgPrevDemoFinal.males)],
            ['Females', String(currentDemo.females), String(avgPrevDemoFinal.females)],
            ['Elevate', String(currentDemo.elevate), String(avgPrevDemoFinal.elevate)],
            ['B1G', String(currentDemo.b1g), String(avgPrevDemoFinal.b1g)]
          ]

          writeSectionHeader('Demographics')
          autoTable(doc, {
            startY: y,
            head: [demoHead],
            body: demoBody,
            headStyles: { fillColor: [33,150,243], textColor: [255,255,255], fontStyle: 'bold' },
            styles: { fontSize: 9 },
            margin: { left: 15, right: 15 }
          })
          y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 8

        } else {
          console.log('[AttendanceListModal] No absence card found in comparison payload')
        }
      } catch (errCards) {
        console.warn('Failed rendering comparison cards into PDF', errCards)
      }
    }
  } catch (e) {
    console.warn("Comparison PDF build failed", e);
  }

  // =========================================================================
  // CATEGORY TABLE GENERATOR
  // =========================================================================
  const data = attendees.value;

  const firstTimers = sortByName(data.filter(m => m.finalTags?.isFirstTimer));
  const leaders = sortByName(data.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isDgroupLeader));
  const volunteers = sortByName(data.filter(m => !m.finalTags?.isFirstTimer && m.finalTags?.isVolunteer));

  const regulars = data.filter(m =>
    !m.finalTags?.isFirstTimer &&
    !m.finalTags?.isDgroupLeader &&
    !m.finalTags?.isVolunteer
  );

  const b1gMale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Male'));
  const b1gFemale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'B1G' && m.gender === 'Female'));
  const elevateMale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Male'));
  const elevateFemale = sortByName(regulars.filter(m => m.finalTags?.ageCategory === 'Elevate' && m.gender === 'Female'));

  const createTable = (title, list, columns, mapFn) => {
    if (list.length === 0) return;

    writeSectionHeader(title);

    autoTable(doc, {
      startY: y,
      head: [columns],
      body: list.map(mapFn),
      headStyles: { fillColor: [33,150,243], textColor: [255,255,255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 }
    });

    y = doc.lastAutoTable.finalY + 8;

    const total = list.length;
    const elevate = list.filter(m => m.finalTags?.ageCategory === 'Elevate').length;
    const b1g = list.filter(m => m.finalTags?.ageCategory === 'B1G').length;
    const male = list.filter(m => m.gender === 'Male').length;
    const female = list.filter(m => m.gender === 'Female').length;

    const pct = (n) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';

    writeParagraph(
      `${total} attendees are listed in this group. 
      - Age groups include Elevate (${elevate}, ${pct(elevate)}) and B1G (${b1g}, ${pct(b1g)}). 
      - Gender distribution shows ${male} male and ${female} female participants.`
    );
  };

  // =========================================================================
  // TABLE SECTIONS
  // =========================================================================
  // Section wrapper for member breakdowns
  writeSectionHeader('Current Event Member Breakdown');
      writeParagraph(
      `The following sections provide a breakdown of attendees by their roles and demographics within the event.`
    );

  createTable(
    "First Timers",
    firstTimers,
    ['Name', 'Age', 'Age Group', 'Gender', 'Contact'],
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.contactNumber || '-']
  );

  createTable(
    "Dgroup Leaders",
    leaders,
    ['Name', 'Age', 'Age Group', 'Gender', 'Volunteer'],
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || 'N/A']
  );

  createTable(
    "Volunteers",
    volunteers,
    ['Name', 'Age', 'Age Group', 'Gender', 'Ministry'],
    m => [`${m.lastName}, ${m.firstName}`, m.age, m.finalTags?.ageCategory || '-', m.gender, m.finalTags?.volunteerMinistry?.join(', ') || '-']
  );

  const regColumns = ['Name', 'Age', 'Gender', 'Dgroup Leader'];
  const regMap = m => [`${m.lastName}, ${m.firstName}`, m.age, m.gender, m.dgroupLeader || 'Unassigned'];

  createTable("B1G Male Members", b1gMale, regColumns, regMap);
  createTable("B1G Female Members", b1gFemale, regColumns, regMap);
  createTable("Elevate Male Members", elevateMale, regColumns, regMap);
  createTable("Elevate Female Members", elevateFemale, regColumns, regMap);

doc.save(`${eventName.value || 'Attendance'}_Attendance_Report.pdf`);
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
          Reports (.pdf)
        </button>

        <button class="export-btn excel-btn" @click="exportToExcel">
          <Download :size="16" />
          Data (.xlsx)
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
                <span v-if="member.finalTags?.isFirstTimer" class="tag ft">First Timer</span>
                <span v-else-if="member.finalTags?.isDgroupLeader" class="tag dl">Leader</span>
                <span v-else-if="member.finalTags?.isVolunteer" class="tag vol">Volunteer</span>
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