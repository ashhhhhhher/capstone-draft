import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { PolynomialRegression, SLR } from 'ml-regression';

dayjs.extend(weekOfYear);

/**
 * ML-Powered Attendance Forecaster
 * Uses polynomial regression to learn patterns from historical data
 * Handles multiple variables: day of week, seasonality, trends
 */
export class AttendanceForecaster {
  constructor() {
    this.model = null;
    this.stats = {
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0
    };
  }

  /**
   * Extract features from a date
   */
  extractFeatures(dateStr, eventType = 'regular') {
    const date = dayjs(dateStr);
    return {
      dayOfWeek: date.day(), // 0-6
      weekOfYear: date.week(), // 1-52
      month: date.month(), // 0-11
      isWeekend: date.day() === 0 || date.day() === 6 ? 1 : 0,
      isSpecial: eventType === 'special' ? 1 : 0,
      // Cyclical encoding for seasonality
      monthSin: Math.sin((date.month() / 12) * 2 * Math.PI),
      monthCos: Math.cos((date.month() / 12) * 2 * Math.PI),
      weekSin: Math.sin((date.week() / 52) * 2 * Math.PI),
      weekCos: Math.cos((date.week() / 52) * 2 * Math.PI)
    };
  }

  /**
   * Calculate statistics for normalization
   */
  calculateStats(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    this.stats = { mean, stdDev, min, max };
  }

  /**
   * Train the model on historical attendance data
   * @param {Array} records - [{ date, count, eventType }]
   */
  train(records) {
    if (!records || records.length < 5) {
      console.warn('⚠️ Insufficient data for training. Need at least 5 records.');
      return false;
    }

    // Sort by date
    const sorted = records
      .filter(r => r.date && r.count != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length < 5) {
      console.warn('⚠️ Not enough valid records after filtering.');
      return false;
    }

    // Extract features and targets
    const X = [];
    const y = sorted.map(r => r.count);

    this.calculateStats(y);

    sorted.forEach((record, idx) => {
      const features = this.extractFeatures(record.date, record.eventType);
      
      // Combine multiple predictive features
      const composite = 
        features.weekOfYear * 0.3 + 
        features.dayOfWeek * 10 + 
        features.monthSin * 20 + 
        features.isSpecial * 15 +
        idx; // Trend component

      X.push(composite);
    });

    // Train polynomial regression (degree 3 to capture complex patterns)
    try {
      this.model = new PolynomialRegression(X, y, 3);
      console.log('✅ Attendance forecasting model trained successfully');
      console.log('📊 Training stats:', {
        samples: sorted.length,
        avgAttendance: this.stats.mean.toFixed(1),
        range: `${this.stats.min}-${this.stats.max}`
      });
      return true;
    } catch (error) {
      console.error('❌ Model training failed:', error);
      return false;
    }
  }

  /**
   * Forecast attendance for future dates
   * @param {String} startDate - Date to start forecasting from
   * @param {Number} periodsAhead - How many service periods to predict
   * @param {String} eventType - 'regular' or 'special'
   * @param {Boolean} isBiWeekly - True if services are every other week (default for Elevate)
   */
  forecast(startDate, periodsAhead = 4, eventType = 'regular', isBiWeekly = true) {
    if (!this.model) {
      console.error('❌ Model not trained. Call train() first.');
      return [];
    }

    const predictions = [];
    const baseDate = dayjs(startDate);
    const weekIncrement = isBiWeekly ? 2 : 1; // Every other Saturday vs every week

    for (let period = 1; period <= periodsAhead; period++) {
      const futureDate = baseDate.add(period * weekIncrement, 'week');
      const features = this.extractFeatures(futureDate.format('YYYY-MM-DD'), eventType);
      
      // Calculate composite feature (same formula as training)
      const composite = 
        features.weekOfYear * 0.3 + 
        features.dayOfWeek * 10 + 
        features.monthSin * 20 + 
        features.isSpecial * 15 +
        (52 + week); // Trend continuation

      const rawPrediction = this.model.predict(composite);
      
      // Clamp prediction to reasonable range
      const predicted = Math.max(
        this.stats.min * 0.8,
        Math.min(this.stats.max * 1.2, rawPrediction)
      );

      predictions.push({
        date: futureDate.format('YYYY-MM-DD'),
        dateLabel: futureDate.format('MMM DD'),
        count: Math.round(predicted),
        confidence: this.calculateConfidence(period, eventType),
        isSpecial: features.isSpecial === 1,
        weekNumber: period
      });
    }

    return predictions;
  }

  /**
   * Calculate confidence interval (decreases with distance)
   */
  calculateConfidence(periodsAhead, eventType) {
    const baseConfidence = eventType === 'special' ? 0.7 : 0.85;
    const decay = 0.05 * periodsAhead;
    return Math.max(0.5, baseConfidence - decay);
  }

  /**
   * Detect trends in historical data
   */
  analyzeTrend(records) {
    if (records.length < 4) return 'insufficient_data';

    const sorted = records
      .filter(r => r.count != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const firstAvg = firstHalf.reduce((sum, r) => sum + r.count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + r.count, 0) / secondHalf.length;

    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (percentChange > 10) return 'growing';
    if (percentChange < -10) return 'declining';
    return 'stable';
  }
}

/**
 * D-Group Growth Forecaster
 * Predicts seeker endorsement based on historical patterns
 */
export class DgroupGrowthForecaster {
  constructor() {
    this.conversionRate = 0;
    this.avgTimeToConvert = 0;
  }

  /**
   * Analyze historical endorsement patterns
   * @param {Array} members - All member records
   * @param {Array} attendance - All attendance records
   */
  analyzeConversionPatterns(members, attendance) {
    const conversions = members.filter(m => 
      m.finalTags?.isSeeker && m.dgroupLeader
    );

    if (conversions.length === 0) {
      this.conversionRate = 0.25; // Default assumption: 25%
      this.avgTimeToConvert = 4; // 4 weeks average
      return;
    }

    // Calculate actual endorsement rate
    const totalSeekers = members.filter(m => m.finalTags?.isSeeker).length;
    this.conversionRate = conversions.length / Math.max(totalSeekers, 1);

    // Calculate average time to endorse (weeks attending before joining)
    const conversionTimes = conversions.map(member => {
      const memberAttendance = attendance.filter(a => a.memberId === member.id);
      return memberAttendance.length;
    });

    this.avgTimeToConvert = conversionTimes.length > 0
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      : 4;

    console.log('D-Group Endorsement Analysis:', {
      rate: `${(this.conversionRate * 100).toFixed(1)}%`,
      avgWeeks: this.avgTimeToConvert.toFixed(1)
    });
  }

  /**
   * Forecast D-Group growth
   * @param {Number} currentSeekers - Number of active seekers
   * @param {Number} currentMembers - Current D-Group members
   * @param {Number} weeksAhead - Forecast period
   */
  forecastGrowth(currentSeekers, currentMembers, weeksAhead = 12) {
    const predictions = [];
    
    // Assume 2 new seekers per month on average
    const newSeekersPerWeek = 0.5;
    
    let seekers = currentSeekers;
    let members = currentMembers;

    for (let week = 1; week <= weeksAhead; week++) {
      // New seekers arrive
      seekers += newSeekersPerWeek;

      // Some seekers convert (based on conversion rate and time)
      if (week % Math.ceil(this.avgTimeToConvert) === 0) {
        const converting = Math.floor(seekers * this.conversionRate);
        seekers -= converting;
        members += converting;
      }

      if (week % 4 === 0) { // Record monthly snapshots
        predictions.push({
          week: week,
          month: Math.ceil(week / 4),
          seekers: Math.round(seekers),
          members: Math.round(members),
          totalGrowth: Math.round(members - currentMembers)
        });
      }
    }

    return predictions;
  }
}

/**
 * Volunteer Availability Predictor
 * Identifies patterns in volunteer attendance
 */
export class VolunteerPredictor {
  constructor() {
    this.patterns = new Map();
    this.ministryStats = new Map();
  }

  /**
   * Analyze volunteer attendance patterns
   * @param {Array} volunteers - Members with volunteer tag
   * @param {Array} attendance - All attendance records
   * @param {Array} events - All events
   */
  analyzePatterns(volunteers, attendance, events) {
    // Reset ministry stats
    this.ministryStats.clear();

    volunteers.forEach(volunteer => {
      const volunteerAttendance = attendance
        .filter(a => a.memberId === volunteer.id)
        .map(a => {
          const event = events.find(e => e.id === a.eventId);
          return {
            date: event?.date,
            dayOfWeek: dayjs(event?.date).day()
          };
        })
        .filter(a => a.date);

      // Calculate attendance frequency
      const totalEvents = events.filter(e => 
        new Date(e.date) <= new Date()
      ).length;

      const attendanceRate = volunteerAttendance.length / Math.max(totalEvents, 1);

      // Identify preferred days
      const dayFrequency = {};
      volunteerAttendance.forEach(a => {
        dayFrequency[a.dayOfWeek] = (dayFrequency[a.dayOfWeek] || 0) + 1;
      });

      const preferredDay = Object.keys(dayFrequency).reduce((a, b) => 
        dayFrequency[a] > dayFrequency[b] ? a : b, 0
      );

      // Get ministries
      const ministries = volunteer.finalTags?.volunteerMinistry || [];

      this.patterns.set(volunteer.id, {
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        attendanceRate: attendanceRate,
        preferredDay: parseInt(preferredDay),
        totalServices: volunteerAttendance.length,
        reliability: this.calculateReliability(attendanceRate),
        ministries: ministries
      });

      // Aggregate ministry stats
      ministries.forEach(ministry => {
        if (!this.ministryStats.has(ministry)) {
          this.ministryStats.set(ministry, {
            totalVolunteers: 0,
            highReliability: 0,
            avgAttendanceRate: 0,
            volunteers: []
          });
        }

        const stats = this.ministryStats.get(ministry);
        stats.totalVolunteers++;
        if (this.calculateReliability(attendanceRate) === 'high') {
          stats.highReliability++;
        }
        stats.volunteers.push({
          id: volunteer.id,
          name: `${volunteer.firstName} ${volunteer.lastName}`,
          rate: attendanceRate,
          reliability: this.calculateReliability(attendanceRate)
        });
      });
    });

    // Calculate average rates per ministry
    this.ministryStats.forEach((stats, ministry) => {
      const totalRate = stats.volunteers.reduce((sum, v) => sum + v.rate, 0);
      stats.avgAttendanceRate = totalRate / stats.volunteers.length;
    });

    console.log(`👥 Analyzed ${volunteers.length} volunteer patterns across ${this.ministryStats.size} ministries`);
  }

  /**
   * Calculate reliability score
   */
  calculateReliability(rate) {
    if (rate >= 0.8) return 'high';
    if (rate >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Predict volunteer availability for a specific date
   * @param {String} targetDate - YYYY-MM-DD
   * @param {String} filterMinistry - Optional ministry filter
   */
  predictAvailability(targetDate, filterMinistry = null) {
    const dayOfWeek = dayjs(targetDate).day();
    const predictions = [];

    this.patterns.forEach((pattern, volunteerId) => {
      // Filter by ministry if specified
      if (filterMinistry && !pattern.ministries.includes(filterMinistry)) {
        return;
      }

      // Higher probability if it matches their preferred day
      const dayMatch = pattern.preferredDay === dayOfWeek ? 1.2 : 1.0;
      const probability = Math.min(0.95, pattern.attendanceRate * dayMatch);

      predictions.push({
        volunteerId: volunteerId,
        name: pattern.name,
        probability: probability,
        reliability: pattern.reliability,
        isLikelyAvailable: probability > 0.6,
        ministries: pattern.ministries
      });
    });

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const volunteers = Array.from(this.patterns.values());
    
    const highReliability = volunteers.filter(v => v.reliability === 'high').length;
    const avgAttendance = volunteers.reduce((sum, v) => sum + v.attendanceRate, 0) / volunteers.length;

    return {
      total: volunteers.length,
      highReliability: highReliability,
      averageAttendanceRate: avgAttendance,
      mostReliable: volunteers
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 5),
      ministries: Array.from(this.ministryStats.entries()).map(([name, stats]) => ({
        name,
        ...stats
      }))
    };
  }

  /**
   * Get ministry-specific availability
   * @param {String} targetDate - YYYY-MM-DD
   */
  getMinistryAvailability(targetDate) {
    const ministryAvailability = new Map();

    this.ministryStats.forEach((stats, ministry) => {
      const predictions = this.predictAvailability(targetDate, ministry);
      const available = predictions.filter(p => p.isLikelyAvailable).length;

      ministryAvailability.set(ministry, {
        ministry: ministry,
        totalVolunteers: stats.totalVolunteers,
        likelyAvailable: available,
        availabilityRate: (available / stats.totalVolunteers) * 100,
        predictions: predictions
      });
    });

    return Array.from(ministryAvailability.values());
  }
}

/**
 * D-Group Annual Forecaster
 * Builds year-by-year leader/member totals from historical attendance and
 * forecasts next years' totals and increments using polynomial regression.
 */
export class DgroupAnnualForecaster {
  constructor() {
    this.series = [];
  }

  /**
   * Build annual series of active leaders and members based on attendance participation.
   * A person is counted for a year if they attended at least once in that calendar year.
   * Leaders are members with finalTags.isDgroupLeader; Members are those with a dgroupLeader assigned.
   * @param {Array} members - all member records
   * @param {Array} attendance - all attendance records with timestamp
   * @returns {Array} [{ year, leaders, members }]
   */
  buildAnnualSeries(members, attendance) {
    if (!Array.isArray(members) || !Array.isArray(attendance)) {
      this.series = [];
      return this.series;
    }

    // Map year -> Set(memberId) who attended that year
    const yearMap = new Map();
    attendance.forEach(a => {
      let dt;
      try {
        dt = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      } catch {
        dt = null;
      }
      if (!dt || isNaN(dt.getTime())) return;
      const y = dt.getFullYear();
      if (!yearMap.has(y)) yearMap.set(y, new Set());
      yearMap.get(y).add(a.memberId);
    });

    const byYear = [];
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    const memberById = new Map(members.map(m => [m.id, m]));

    sortedYears.forEach(year => {
      const ids = yearMap.get(year);
      let leaders = 0;
      let membersCount = 0;
      ids.forEach(id => {
        const m = memberById.get(id);
        if (!m) return;
        if (m.finalTags?.isDgroupLeader) leaders++;
        if (m.dgroupLeader) membersCount++;
      });
      byYear.push({ year, leaders, members: membersCount });
    });

    this.series = byYear;
    return this.series;
  }

  /**
   * Compute year-over-year increments based on totals
   */
  computeIncrements(series = this.series) {
    if (!Array.isArray(series)) return [];
    return series.map((row, idx) => {
      if (idx === 0) return { ...row, leadersInc: 0, membersInc: 0 };
      const prev = series[idx - 1];
      return {
        ...row,
        leadersInc: row.leaders - prev.leaders,
        membersInc: row.members - prev.members
      };
    });
  }

  /**
   * Forecast next N years of totals using polynomial regression (degree 2)
   * @param {number} yearsAhead
   */
  forecastTotals(yearsAhead = 1) {
    const series = this.series || [];
    if (series.length < 3) {
      // Not enough data: project flat growth
      const last = series[series.length - 1] || { year: new Date().getFullYear(), leaders: 0, members: 0 };
      const out = [];
      for (let i = 1; i <= yearsAhead; i++) {
        out.push({ year: last.year + i, leaders: last.leaders, members: last.members });
      }
      return out;
    }

    // Use index time (0..N-1) to avoid year scaling issues
    const X = series.map((_, i) => i);
    const yLeaders = series.map(r => r.leaders);
    const yMembers = series.map(r => r.members);

    let leadersModel, membersModel;
    try {
      leadersModel = new PolynomialRegression(X, yLeaders, 2);
      membersModel = new PolynomialRegression(X, yMembers, 2);
    } catch (e) {
      console.warn('Poly regression failed, falling back to last known totals', e);
      const last = series[series.length - 1];
      const out = [];
      for (let i = 1; i <= yearsAhead; i++) out.push({ year: last.year + i, leaders: last.leaders, members: last.members });
      return out;
    }

    const forecasts = [];
    const lastIndex = X[X.length - 1];
    const lastYear = series[series.length - 1].year;
    for (let step = 1; step <= yearsAhead; step++) {
      const idx = lastIndex + step;
      const leaders = Math.max(0, Math.round(leadersModel.predict(idx)));
      const members = Math.max(0, Math.round(membersModel.predict(idx)));
      forecasts.push({ year: lastYear + step, leaders, members });
    }
    return forecasts;
  }

  /**
   * Convenience: Get combined historical+forecast with increments
   */
  getCombinedWithIncrements(yearsAhead = 1) {
    const hist = this.computeIncrements(this.series);
    const next = this.forecastTotals(yearsAhead);
    const combined = hist.concat(this.computeIncrements(hist.slice(-1).concat(next).slice(1))); // recompute inc for forecast

    // The above line is tricky; simpler explicit recompute:
    const out = [...hist];
    let prev = hist[hist.length - 1] || null;
    next.forEach(n => {
      const row = {
        year: n.year,
        leaders: n.leaders,
        members: n.members,
        leadersInc: prev ? n.leaders - prev.leaders : 0,
        membersInc: prev ? n.members - prev.members : 0
      };
      out.push(row);
      prev = row;
    });
    return out;
  }
}

/**
 * Utility: Prepare attendance data from stores
 */
export function prepareAttendanceData(events, attendance) {
  return events
    .filter(e => new Date(e.date) <= new Date()) // Only past events
    .map(event => ({
      date: event.date,
      count: attendance.filter(a => a.eventId === event.id).length,
      eventType: event.type || 'regular',
      name: event.name
    }))
    .filter(r => r.count > 0); // Remove zero-attendance events
}
