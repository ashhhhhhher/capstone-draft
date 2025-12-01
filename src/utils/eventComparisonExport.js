// Lightweight helper to build a comparable payload similar to EventComparison.vue's exportPageData
export default function buildComparisonPayload({ allEvents = [], allAttendance = [], members = [], activeMembers = [], currentEventId = null } = {}) {
  // select the specified current event if provided, otherwise pick most recent service
  const services = (allEvents || []).filter(e => e.eventType === 'service').slice().sort((a,b) => new Date(b.date) - new Date(a.date))
  if (!services.length) return { cards: [] }

  let current = null
  if (currentEventId) {
    current = services.find(s => s.id === currentEventId) || null
  }
  if (!current) {
    current = services[0]
  }

  // pick up to 3 previous services that are older than the current event
  const currentIndex = services.indexOf(current)
  const previous = services.slice(currentIndex + 1, currentIndex + 4)

  function attendeesForEvent(ev) {
    if (!ev) return []
    const recs = (allAttendance || []).filter(a => a.eventId === ev.id)
    return recs.map(r => ({ record: r, member: (members || []).find(m => m.id === r.memberId) || null }))
  }

  function attendanceRate(attList) {
    const denom = Array.isArray(activeMembers) ? activeMembers.length : (Array.isArray(members) ? members.length : 1)
    if (!denom) return 0
    return Math.round((attList.length / denom) * 100)
  }

  function summarize(ev) {
    if (!ev) return { name: '', date: '', total: 0, elevate: 0, b1g: 0, firstTimers: 0, volunteers: 0 }
    const recs = (allAttendance || []).filter(a => a.eventId === ev.id)
    const details = (members || []).filter(m => recs.some(r => r.memberId === m.id))
    return {
      id: ev.id,
      name: ev.name || '',
      date: ev.date || '',
      total: recs.length,
      elevate: details.filter(m => m.finalTags?.ageCategory === 'Elevate' && !m.finalTags?.isFirstTimer).length,
      b1g: details.filter(m => m.finalTags?.ageCategory === 'B1G' && !m.finalTags?.isFirstTimer).length,
      firstTimers: details.filter(m => m.finalTags?.isFirstTimer).length,
      volunteers: details.filter(m => m.finalTags?.isVolunteer).length
    }
  }

  const currentSum = summarize(current)
  const previousSums = previous.map(summarize)

  // per-event list (current + previous)
  const perList = [current].concat(previous).filter(Boolean)
  const labels = perList.map(e => `${e.name} (${e.date})`)
  const rawCounts = perList.map(e => attendeesForEvent(e).length)
  const participationPercents = perList.map(e => attendanceRate(attendeesForEvent(e)))

  const cards = []

  // Comparison summary
  cards.push({
    title: 'Comparison summary',
    tableHeaders: ['Group','Events'],
    tableRows: [[ 'Group A', `${current.name} (${current.date})` ], [ 'Group B', previous.map(p => `${p.name} (${p.date})`).join(' | ') || 'none' ]]
  })

  // Attendance totals chart
  cards.push({
    title: 'Attendance totals (per event)',
    charts: [{ title: 'Attendance', labels, datasets: [{ label: 'Attendance %', data: participationPercents, raw: rawCounts }] }],
    interpretation: `Current: ${current.name} (${current.date}) — ${currentSum.total}. Previous ${previous.length} events average: ${previousSums.length ? Math.round(previousSums.reduce((s,p)=>s+p.total,0)/previousSums.length) : 0}.`
  })

  // Participation
  cards.push({ title: 'Participation % (per event)', charts: [{ title: 'Participation', labels, datasets: [{ label: 'Participation %', data: participationPercents, raw: rawCounts }] }] })

  // Member distribution: compute simple counts for groups
  function categoryCountsForEvents(list) {
    const seen = new Map()
    ;(list||[]).forEach(ev => {
      attendeesForEvent(ev).forEach(a => {
        const m = a.member
        if (!m || !m.id) return
        if (!seen.has(m.id)) seen.set(m.id, m)
      })
    })
    const arr = Array.from(seen.values())
    return { regulars: arr.filter(m => m.finalTags?.isRegular).length, leaders: arr.filter(m => m.finalTags?.isDgroupLeader).length, firstTimers: arr.filter(m => m.finalTags?.isFirstTimer).length, volunteers: arr.filter(m => m.finalTags?.isVolunteer).length, total: arr.length }
  }

  const baseCounts = categoryCountsForEvents([current])
  const prevCounts = categoryCountsForEvents(previous)
  cards.push({
    title: 'Member Distribution',
    charts: [
      {
        title: 'Group A',
        labels: ['Regulars','Dgroup Leaders','First Timers'],
        datasets: [{ label: current.name, data: [baseCounts.regulars, baseCounts.leaders, baseCounts.firstTimers], raw: [baseCounts.regulars, baseCounts.leaders, baseCounts.firstTimers] }]
      },
      {
        title: 'Group B',
        labels: ['Regulars','Dgroup Leaders','First Timers'],
        datasets: [{ label: 'Previous', data: [prevCounts.regulars, prevCounts.leaders, prevCounts.firstTimers], raw: [prevCounts.regulars, prevCounts.leaders, prevCounts.firstTimers] }]
      }
    ]
  })

  // Member Category Distribution table
  const rows = ['Regulars','Dgroup Leaders','First Timers','Volunteers'].map(label => {
    const key = label === 'Regulars' ? 'regulars' : (label === 'Dgroup Leaders' ? 'leaders' : (label === 'First Timers' ? 'firstTimers' : 'volunteers'))
    return [label, String(baseCounts[key] || 0), String(prevCounts[key] || 0)]
  })
  cards.push({ title: 'Member Category Distribution', tableHeaders: ['Category', current.name || 'Current', 'Previous (combined)'], tableRows: rows })

  // Demographics simple: male/female and age groups
  function demographicsForList(list) {
    const at = [].concat(...(list||[]).map(ev => attendeesForEvent(ev).map(a => a.member).filter(Boolean)))
    const males = at.filter(m => m.gender === 'Male').length
    const females = at.filter(m => m.gender === 'Female').length
    const ageElevate = at.filter(m => m.finalTags?.ageCategory === 'Elevate').length
    const ageB1G = at.filter(m => m.finalTags?.ageCategory === 'B1G').length
    return { males, females, ageElevate, ageB1G }
  }
  const baseDemo = demographicsForList([current])
  const prevDemo = demographicsForList(previous)
  cards.push({ title: 'Demographics comparison', charts: [{ title: 'Demographics', labels: ['Males','Females','Elevate','B1G'], datasets: [{ label: current.name, data: [baseDemo.males, baseDemo.females, baseDemo.ageElevate, baseDemo.ageB1G], raw: [baseDemo.males, baseDemo.females, baseDemo.ageElevate, baseDemo.ageB1G] }, { label: 'Previous (combined)', data: [prevDemo.males, prevDemo.females, prevDemo.ageElevate, prevDemo.ageB1G], raw: [prevDemo.males, prevDemo.females, prevDemo.ageElevate, prevDemo.ageB1G] }] }])

  // Absence monitoring simple: present/absent counts
  const totalMembers = Array.isArray(activeMembers) ? activeMembers.length : (Array.isArray(members) ? members.length : 0)
  const presentCurrent = new Set(attendeesForEvent(current).map(a => a.member && a.member.id).filter(Boolean))
  const presentPrev = new Set([].concat(...previous.map(ev => attendeesForEvent(ev).map(a => a.member && a.member.id))).filter(Boolean))
  const presentCurrCount = presentCurrent.size
  const presentPrevCount = presentPrev.size
  const absentCurr = Math.max(0, totalMembers - presentCurrCount)
  const absentPrev = Math.max(0, totalMembers - presentPrevCount)
  cards.push({ title: 'Absence monitoring', tableHeaders: ['Metric', current.name || 'Current', 'Previous (combined)'], tableRows: [['Present (unique)', String(presentCurrCount), String(presentPrevCount)], ['Absent (unique)', String(absentCurr), String(absentPrev)]] })

  return { cards, current: currentSum, previous: previousSums }
}
