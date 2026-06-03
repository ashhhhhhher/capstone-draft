/**
 * Prescriptive Analytics Recommendation Engine for Dgroups
 * * Updated Weights:
 * 1. Age Similarity (50%)
 * 2. Schedule Compatibility (25%)
 * 3. Life Stage Similarity (15%)
 * 4. Shared Interests (10%)
 */

export function calculateDgroupMatches(seeker, leaders, allMembers) {
  const seekerAge = Number(seeker.age) || null;
  const seekerLifeStage = seeker.lifeStage || seeker.finalTags?.lifeStage || null;
  const seekerGender = seeker.gender || null;
  const seekerPrefs = seeker.seekerPreferences || seeker.prefs || { interests: [], meetingTime: [] };

  // 1. Initial Filtering (Gender and Capacity)
  const candidates = leaders.filter(l => {
    // Strict gender match (men to men, women to women)
    if (seekerGender && l.gender && l.gender !== seekerGender) return false;
    
    // Capacity check
    const groupMembers = allMembers.filter(m => 
      m.dgroupLeaderId === l.id || 
      m.dgroupLeader === `${l.firstName} ${l.lastName}`
    );
    const capacity = l.dgroupCapacity || 12;
    if (groupMembers.length >= capacity) return false;

    return true;
  });

  // 2. Scoring System
  return candidates.map(l => {
    const groupMembers = allMembers.filter(m => 
      m.dgroupLeaderId === l.id || 
      m.dgroupLeader === `${l.firstName} ${l.lastName}`
    );
    
    let ageScore = 0;
    let scheduleScore = 0;
    let lifeStageScore = 0;
    let interestScore = 0;
    let reasons = [];

    // --- A. AGE SIMILARITY (Weight: 50%) ---
    let roundedAverageAge = null;
    let ageDifference = null;
    const membersWithAge = groupMembers.filter(m => m.age);
    
    if (membersWithAge.length > 0) {
      const totalAge = membersWithAge.reduce((sum, m) => sum + Number(m.age), 0);
      roundedAverageAge = Math.round(totalAge / membersWithAge.length);
    } else if (l.age) {
      // Fallback to leader's age if group is empty
      roundedAverageAge = Number(l.age);
    }

    if (seekerAge && roundedAverageAge) {
      ageDifference = Math.abs(seekerAge - roundedAverageAge);
      
      // Scoring brackets for age difference (Max 50)
      if (ageDifference <= 2) { 
        ageScore = 50; 
        reasons.push('Highly compatible age group'); 
      } else if (ageDifference <= 4) { 
        ageScore = 40; 
        reasons.push('Similar age group'); 
      } else if (ageDifference <= 6) { 
        ageScore = 30; 
      } else if (ageDifference <= 8) { 
        ageScore = 15; 
      } else { 
        ageScore = 5; // Minimal baseline
      }
    } else {
      ageScore = 25; // Default middle score if age data is missing
    }

// --- B. SCHEDULE COMPATIBILITY (Weight: 25%) ---
    const groupTime = l.dgroupDetails?.meetingTime || 'Flexible';
    const groupDay = l.dgroupDetails?.meetingDays || 'Flexible';
    
    const seekerTimes = seekerPrefs.meetingTime || [];
    const seekerDays = seekerPrefs.meetingDays || []; // Ensure your seeker object passes this

    // Helper booleans to check for flexibility
    const isGroupTimeFlex = groupTime === 'Flexible';
    const isGroupDayFlex = groupDay === 'Flexible';
    const isSeekerTimeFlex = seekerTimes.includes('Flexible') || seekerTimes.length === 0;
    const isSeekerDayFlex = seekerDays.includes('Flexible') || seekerDays.length === 0;

    // Helper booleans to check for exact specific matches
    const timeExactMatch = seekerTimes.includes(groupTime) && !isGroupTimeFlex && !isSeekerTimeFlex;
    const dayExactMatch = seekerDays.includes(groupDay) && !isGroupDayFlex && !isSeekerDayFlex;
    
    // Check if they are completely incompatible (e.g., Morning vs Evening)
    const timeCompatible = timeExactMatch || isGroupTimeFlex || isSeekerTimeFlex;
    const dayCompatible = dayExactMatch || isGroupDayFlex || isSeekerDayFlex;

    if (timeCompatible && dayCompatible) {
      if (timeExactMatch && dayExactMatch) {
        // Tier 1: Perfect Specific Match (e.g., 5-7pm AND Weekends)
        scheduleScore = 25;
        reasons.push('Perfect Specific Schedule Match');
      } else if (timeExactMatch || dayExactMatch) {
        // Tier 2: Partial Specific Match (e.g., 5-7pm matches, but days are flexible)
        scheduleScore = 18; 
        reasons.push('Partial Schedule Match (Requires Coordination)');
      } else {
        // Tier 3: Double Flexible (Both parties are flexible)
        scheduleScore = 10;
        reasons.push('Compatible via Flexible Schedule');
      }
    } else {
      // Tier 4: Hard Conflict (e.g., Seeker wants Weekends, Group meets Weekdays)
      scheduleScore = 0; 
    }

    // --- C. LIFE STAGE SIMILARITY (Weight: 15%) ---
    // Adjusted ratio calculation to max out at 15.
    let sameLifeStageCount = 0;
    if (seekerLifeStage) {
      sameLifeStageCount = groupMembers.filter(m => 
        m.finalTags?.lifeStage === seekerLifeStage || m.lifeStage === seekerLifeStage
      ).length;

      if (groupMembers.length > 0) {
        const ratio = sameLifeStageCount / groupMembers.length;
        lifeStageScore = Math.round(ratio * 15); 
      } else {
        // Compare with leader if the group is empty
        const leaderLifeStage = l.finalTags?.lifeStage || l.lifeStage;
        if (leaderLifeStage === seekerLifeStage) {
          lifeStageScore = 15;
          sameLifeStageCount = 1;
        }
      }
      
      if (lifeStageScore >= 10) {
        reasons.push('Shares your life stage');
      }
    }

    // --- D. SHARED INTERESTS (Weight: 10%) ---
    const groupInterests = l.dgroupDetails?.interests || [];
    const seekerInterests = seekerPrefs.interests || [];
    let sharedInterestsCount = 0;

    if (seekerInterests.length > 0 && groupInterests.length > 0) {
      const intersection = groupInterests.filter(i => seekerInterests.includes(i));
      sharedInterestsCount = intersection.length;
      
      if (sharedInterestsCount > 0) {
        const ratio = sharedInterestsCount / seekerInterests.length;
        interestScore = Math.round(ratio * 10);
        reasons.push(`${sharedInterestsCount} Shared Interest(s)`);
      }
    }

    // 3. Final Calculation
    const totalScore = ageScore + scheduleScore + lifeStageScore + interestScore;

    // Determine visual group type (Elevate, B1G, Mixed)
    let groupType = 'Mixed Age Group';
    if (groupMembers.length === 0) {
      if (l.finalTags?.ageCategory === 'Elevate') groupType = 'ELEVATE';
      else if (l.finalTags?.ageCategory === 'B1G') groupType = 'B1G';
    } else {
      const allElevate = groupMembers.every(m => m.finalTags?.ageCategory === 'Elevate');
      const allB1G = groupMembers.every(m => m.finalTags?.ageCategory === 'B1G');
      if (allElevate) groupType = 'ELEVATE';
      else if (allB1G) groupType = 'B1G';
    }

    return {
      ...l,
      leaderId: l.id,
      leaderName: `${l.firstName} ${l.lastName}`,
      dgroupName: l.dgroupName || `${l.firstName}'s Dgroup`,
      description: l.dgroupDescription || "A group of individuals growing together in faith and community.",
      interests: groupInterests,
      meetingTime: groupTime,
      meetingDays: l.dgroupDetails?.meetingDays || 'Flexible',
      capacity: l.dgroupCapacity || 12,
      memberCount: groupMembers.length,
      groupType,
      
      // Breakdown output required by instructions
      matchBreakdown: {
        ageScore,
        scheduleScore,
        lifeStageScore,
        interestScore,
        totalScore: Math.min(100, totalScore),
        roundedAverageAge,
        ageDifference,
        sameLifeStageCount,
        sharedInterestsCount
      },
      totalScore: Math.min(100, totalScore),
      reasons
    };
  }).sort((a, b) => b.totalScore - a.totalScore); // Rank highest to lowest
}