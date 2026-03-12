/**
 * Utility functions for weekly dgroup meeting management
 */

/**
 * Parse a YYYY-MM-DD string into a local Date (avoiding timezone issues)
 */
export function parseYMD(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d)
}

/**
 * Convert a Date to YYYY-MM-DD string (local time)
 */
export function toYMD(date) {
  const d = date || new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getWeekStartDate(dateStr) {
  const date = parseYMD(dateStr)
  const dayOfWeek = date.getDay()
  const diff = date.getDate() - dayOfWeek
  return new Date(date.getFullYear(), date.getMonth(), diff)
}

/**
 * Get the Saturday of the week containing the given date
 */
export function getWeekEndDate(dateStr) {
  const sundayDate = getWeekStartDate(dateStr)
  const saturdayDate = new Date(sundayDate)
  saturdayDate.setDate(saturdayDate.getDate() + 6)
  return saturdayDate
}

/**
 * Generate week ID from a date string
 * Format: YYMMDD-DD or YYMMDD-MMDD or YYMMDD-YYMMDD
 * Examples: 260308-14, 260329-0404, 251230-260106
 */
export function generateWeekId(dateStr) {
  const sundayDate = getWeekStartDate(dateStr)
  const saturdayDate = getWeekEndDate(dateStr)

  // Format start date as YYMMDD
  const startYear = String(sundayDate.getFullYear()).slice(-2)
  const startMonth = String(sundayDate.getMonth() + 1).padStart(2, '0')
  const startDay = String(sundayDate.getDate()).padStart(2, '0')
  const startStr = `${startYear}${startMonth}${startDay}`

  // Format end date based on whether year/month differs
  let endStr
  if (saturdayDate.getFullYear() !== sundayDate.getFullYear()) {
    // Different year: use YYMMDD
    const endYear = String(saturdayDate.getFullYear()).slice(-2)
    const endMonth = String(saturdayDate.getMonth() + 1).padStart(2, '0')
    const endDay = String(saturdayDate.getDate()).padStart(2, '0')
    endStr = `${endYear}${endMonth}${endDay}`
  } else if (saturdayDate.getMonth() !== sundayDate.getMonth()) {
    // Same year, different month: use MMDD
    const endMonth = String(saturdayDate.getMonth() + 1).padStart(2, '0')
    const endDay = String(saturdayDate.getDate()).padStart(2, '0')
    endStr = `${endMonth}${endDay}`
  } else {
    // Same year and month: just DD
    endStr = String(saturdayDate.getDate()).padStart(2, '0')
  }

  return `${startStr}-${endStr}`
}

/**
 * Parse week ID back to start and end dates
 * Returns { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 */
export function parseWeekId(weekId) {
  if (!weekId || !weekId.includes('-')) {
    return { startDate: null, endDate: null }
  }

  const parts = weekId.split('-')
  if (parts.length !== 2) {
    return { startDate: null, endDate: null }
  }

  const startPart = parts[0]
  const endPart = parts[1]

  // Parse start date (always YYMMDD)
  let startYear = parseInt(startPart.slice(0, 2))
  let startMonth = parseInt(startPart.slice(2, 4))
  let startDay = parseInt(startPart.slice(4, 6))

  // Assume 20xx for years 00-50, 19xx for 51-99
  if (startYear <= 50) startYear += 2000
  else startYear += 1900

  const startDate = new Date(startYear, startMonth - 1, startDay)
  const startYMD = toYMD(startDate)

  // Parse end date - could be DD, MMDD, or YYMMDD
  let endYear, endMonth, endDay

  if (endPart.length === 2) {
    // Just DD - same year and month as start
    endYear = startYear
    endMonth = startMonth
    endDay = parseInt(endPart)
  } else if (endPart.length === 4) {
    // MMDD - same year as start, different month
    endYear = startYear
    endMonth = parseInt(endPart.slice(0, 2))
    endDay = parseInt(endPart.slice(2, 4))
  } else if (endPart.length === 6) {
    // YYMMDD - different year
    endYear = parseInt(endPart.slice(0, 2))
    if (endYear <= 50) endYear += 2000
    else endYear += 1900
    endMonth = parseInt(endPart.slice(2, 4))
    endDay = parseInt(endPart.slice(4, 6))
  } else {
    return { startDate: startYMD, endDate: null }
  }

  const endDate = new Date(endYear, endMonth - 1, endDay)
  const endYMD = toYMD(endDate)

  return { startDate: startYMD, endDate: endYMD }
}

/**
 * Format a week ID for display (e.g., "Mar 8 - 14, 2026")
 */
export function formatWeekIdDisplay(weekId) {
  const { startDate, endDate } = parseWeekId(weekId)
  if (!startDate || !endDate) return weekId

  const start = parseYMD(startDate)
  const end = parseYMD(endDate)

  const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return `${startStr} - ${endStr}`
}

/**
 * Check if a given date falls within a week ID range
 */
export function isDateInWeek(dateStr, weekId) {
  const { startDate, endDate } = parseWeekId(weekId)
  if (!startDate || !endDate) return false

  const date = parseYMD(dateStr)
  const start = parseYMD(startDate)
  const end = parseYMD(endDate)

  return date >= start && date <= end
}
