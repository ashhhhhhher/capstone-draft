// Lightweight helper to build a comparable payload similar to EventComparison.vue's exportPageData
export default function buildComparisonPayload({ allEvents = [], allAttendance = [], members = [], activeMembers = [] } = {}) {
  // select most recent service as current and previous up to 3 as previous
  const services = (allEvents || []).filter(e => e.eventType === 'service').slice().sort((a,b) => new Date(b.date) - new Date(a.date))
  if (!services.length) return { cards: [] }
  const current = services[0]
  const previous = services.slice(1,4)

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
      // Count volunteers by attendance record (ministry) so historical records remain accurate
      volunteers: recs.filter(r => r.ministry && r.ministry !== 'N/A').length
    }
  }

  const currentSum = summarize(current)
  const previousSums = previous.map(summarize)

  // per-event list (current + previous)
  const cards = []


  // Demographics simple: male/female and age groups
  function demographicsForList(list) {
    const at = [].concat(...(list||[]).map(ev => attendeesForEvent(ev).map(a => a.member).filter(Boolean)))
    const males = at.filter(m => m.gender === 'Male').length
    const females = at.filter(m => m.gender === 'Female').length
    const ageElevate = at.filter(m => m.finalTags?.ageCategory === 'Elevate').length
    const ageB1G = at.filter(m => m.finalTags?.ageCategory === 'B1G').length
    return { males, females, ageElevate, ageB1G }
  }
  return { cards, current: currentSum, previous: previousSums }
}
