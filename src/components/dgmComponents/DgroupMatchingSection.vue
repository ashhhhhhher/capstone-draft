<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { storeToRefs } from 'pinia'
import { User, Sparkles, Check, ChevronRight, Calendar, Users } from 'lucide-vue-next'

// --- Store Setup ---
const membersStore = useMembersStore()
const { seekers, leaders, members } = storeToRefs(membersStore)

// --- State ---
const selectedSeekerId = ref(null)

// --- Helpers ---
function fullName(person) {
  return `${person.firstName} ${person.lastName}`
}

// Generate a consistent pastel color for avatars
function getAvatarColor(id) {
  const colors = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// --- Computed Data ---

// 1. Process Leaders with Stats
const leaderStats = computed(() => {
  return leaders.value.map(leader => {
    const name = fullName(leader)
    // Get actual members to analyze composition
    const groupMembers = members.value.filter(m => m.dgroupLeader === name)
    const currentMembers = groupMembers.length
    const capacity = leader.dgroupCapacity || 8
    const openSlots = capacity - currentMembers
    
    // Determine Group Type (ELEVATE vs B1G vs Mixed)
    let groupType = 'Mixed Aged Group'
    if (currentMembers === 0) {
      // If empty, base on Leader's category
      if (leader.finalTags?.ageCategory === 'Elevate') groupType = 'ELEVATE'
      else if (leader.finalTags?.ageCategory === 'B1G') groupType = 'B1G'
    } else {
      const allElevate = groupMembers.every(m => m.finalTags?.ageCategory === 'Elevate')
      const allB1G = groupMembers.every(m => m.finalTags?.ageCategory === 'B1G')
      
      if (allElevate) groupType = 'ELEVATE'
      else if (allB1G) groupType = 'B1G'
      else groupType = 'Mixed Aged Group'
    }

    // Calculate Average Member Age (Excluding Leader)
    const membersWithAge = groupMembers.filter(m => m.age)
    let averageMemberAge = null
    if (membersWithAge.length > 0) {
      const totalAge = membersWithAge.reduce((sum, m) => sum + Number(m.age), 0)
      averageMemberAge = Math.round(totalAge / membersWithAge.length)
    }

    return {
      id: leader.id,
      name,
      dgroupName: leader.dgroupName || `${leader.firstName}'s Dgroup`,
      gender: leader.gender || null,
      age: leader.age ?? null,
      current: currentMembers,
      capacity,
      openSlots,
      groupType,
      averageMemberAge
    }
  })
})

// 2. Process Seekers List
const seekerList = computed(() => {
  return seekers.value.map(s => ({
    id: s.id,
    name: fullName(s),
    firstName: s.firstName,
    lastName: s.lastName,
    age: s.age,
    gender: s.gender,
    photoURL: s.photoURL || s.profilePicture
  }))
})

// 3. Get Matches for Selected Seeker
const currentMatches = computed(() => {
  if (!selectedSeekerId.value) return []

  const seeker = seekerList.value.find(s => s.id === selectedSeekerId.value)
  if (!seeker) return []

  const sAge = Number(seeker.age)
  const sGender = seeker.gender

  // Filter candidates
  const candidates = leaderStats.value.filter(l => {
    // Must have open slots
    if (l.openSlots <= 0) return false
    // Must match gender
    if (sGender && l.gender && l.gender !== sGender) return false
    return true
  })

  // Calculate Scores & Metadata
  const scored = candidates.map(l => {
    let score = 0
    let reasons = []

    // A. Gender Match (Base Requirement)
    score += 40 

    // B. Age Compatibility Logic
    let ageScore = 0
    
    if (l.averageMemberAge && sAge) {
      // Logic: Compare Seeker Age to Group Average Age
      const diff = Math.abs(sAge - l.averageMemberAge)
      
      if (diff <= 2) {
        ageScore = 40 // Very close to average
        reasons.push('Fits group age profile')
      } else if (diff <= 5) {
        ageScore = 30 // Good fit
        reasons.push('Close age range')
      } else if (diff <= 8) {
        ageScore = 15 // Okay fit
      }
    } else {
      // Empty Group or missing data: Fallback to Leader Rule
      // "What matters is that they are 3 years older than you"
      if (l.age && sAge) {
        const leaderGap = l.age - sAge
        if (leaderGap >= 3) {
          ageScore = 30
          reasons.push('Leader is senior/mentor')
        } else if (leaderGap >= 0) {
          ageScore = 15
          reasons.push('Leader is peer')
        }
      } else {
        ageScore = 10 // Missing age data
      }
    }
    score += ageScore

    // C. Capacity Bonus
    if (l.openSlots >= 3) {
      score += 10
      reasons.push(`${l.openSlots} slots available`)
    } else {
      score += 5
      reasons.push('Space available')
    }

    // D. Cap at 98% (Nobody is perfect except...)
    if (score > 98) score = 98

    return {
      ...l,
      matchPercentage: score,
      reasons,
      averageMemberAge: l.averageMemberAge
    }
  })

  // Sort by score desc, show ALL
  return scored.sort((a, b) => b.matchPercentage - a.matchPercentage)
})

// --- Actions ---
function selectSeeker(id) {
  selectedSeekerId.value = id
}

async function assignLeader(leaderName) {
  if (!selectedSeekerId.value) return
  
  const seeker = members.value.find(m => m.id === selectedSeekerId.value)
  if (!seeker) return

  if(!confirm(`Assign ${seeker.firstName} to ${leaderName}?`)) return

  const updated = {
    ...seeker,
    dgroupLeader: leaderName,
    finalTags: {
      ...seeker.finalTags,
      isSeeker: false,
      isFirstTimer: false,
      isRegular: true
    }
  }
  
  try {
    await membersStore.updateMember(updated)
    // Clear selection after assignment
    selectedSeekerId.value = null
  } catch (e) {
    console.error('Failed to assign leader:', e)
  }
}
</script>

<template>
  <div class="matching-layout">
    <div class="header-section">
      <h3><Sparkles class="icon-inline" :size="20" /> DGroup Matching</h3>
      <p>Match seekers to recommended DGroups based on availability and compatibility.</p>
    </div>

    <div class="grid-container">
      
      <!-- LEFT PANEL: SEEKERS LIST -->
      <div class="panel left-panel">
        <div class="panel-header">
          <User :size="18" class="text-blue-600" />
          <h4>Seekers waiting to be matched ({{ seekerList.length }})</h4>
        </div>

        <div class="seekers-list-wrapper">
          <div v-if="seekerList.length === 0" class="empty-state-small">
            No seekers found.
          </div>

          <div 
            v-for="seeker in seekerList" 
            :key="seeker.id" 
            class="seeker-card"
            :class="{ 'active': selectedSeekerId === seeker.id }"
            @click="selectSeeker(seeker.id)"
          >
            <div class="seeker-avatar">
              <img v-if="seeker.photoURL" :src="seeker.photoURL" class="avatar-img" />
              <div v-else class="avatar-placeholder" :style="{ backgroundColor: getAvatarColor(seeker.id) }">
                {{ seeker.firstName[0] }}
              </div>
            </div>
            
            <div class="seeker-info">
              <div class="seeker-name">{{ seeker.name }}</div>
              <div class="seeker-meta">
                <span>{{ seeker.gender }}</span>
                <span v-if="seeker.age">• Age {{ seeker.age }}</span>
              </div>
            </div>

            <ChevronRight :size="16" class="chevron" />
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL: MATCHES -->
      <div class="panel right-panel">
        <div class="panel-header">
          <Users :size="18" class="text-blue-600" />
          <h4>Recommended DGroups</h4>
        </div>

        <div class="matches-content">
          <!-- EMPTY STATE -->
          <div v-if="!selectedSeekerId" class="empty-selection">
            <div class="empty-icon-circle">
              <Sparkles :size="32" color="#90A4AE" />
            </div>
            <p>Select a seeker to see recommended matches</p>
          </div>

          <!-- MATCH LIST -->
          <div v-else class="matches-list">
            <div v-if="currentMatches.length === 0" class="no-matches-warning">
              No eligible DGroups found based on gender match and capacity.
            </div>

            <div 
              v-for="(match, index) in currentMatches" 
              :key="match.id" 
              class="match-card"
            >
              <div class="match-header">
                <div class="match-title-block">
                  <h4 class="dgroup-name">{{ match.dgroupName }}</h4>
                  <span v-if="index === 0" class="best-match-badge">Best Match</span>
                  <div class="leader-sub">Lead by {{ match.name }}</div>
                </div>
                <div class="match-score">
                  <span class="score-val">{{ match.matchPercentage }}%</span>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="progress-bg">
                <div 
                  class="progress-fill" 
                  :style="{ width: match.matchPercentage + '%' }"
                  :class="match.matchPercentage > 80 ? 'high' : 'med'"
                ></div>
              </div>

              <!-- Tags -->
              <div class="match-tags">
                <span v-for="reason in match.reasons" :key="reason" class="match-tag">
                  <Check :size="10" /> {{ reason }}
                </span>
                
                <!-- Dynamic Group Type Tag -->
                <span class="match-tag type-tag" :class="match.groupType === 'Mixed Aged Group' ? 'mixed' : 'standard'">
                   {{ match.groupType }}
                </span>

                <!-- Average Member Age -->
                <span v-if="match.averageMemberAge" class="match-tag">
                   Avg Age: {{ match.averageMemberAge }}
                </span>
                <span v-else class="match-tag mixed">
                   New / Empty Group
                </span>
              </div>

              <!-- Action -->
              <button 
                class="assign-button" 
                :class="index === 0 ? 'primary' : 'outline'"
                @click="assignLeader(match.name)"
              >
                Assign to {{ match.dgroupName }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.matching-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-section {
  margin-bottom: 24px;
}
.header-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px 0;
  font-size: 20px;
  color: #0D47A1;
}
.header-section p {
  margin: 0;
  color: #546E7A;
  font-size: 14px;
}
.icon-inline { color: #1976D2; }

/* GRID */
.grid-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  flex: 1;
  min-height: 500px;
}

@media (min-width: 900px) {
  .grid-container {
    grid-template-columns: 350px 1fr;
  }
}

/* PANELS */
.panel {
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.panel-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #37474F;
}
.text-blue-600 { color: #1976D2; }

/* SEEKERS LIST */
.seekers-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.seeker-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #ECEFF1;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.seeker-card:hover {
  border-color: #B0BEC5;
  background: #FAFAFA;
}

.seeker-card.active {
  border-color: #1976D2;
  background: #E3F2FD;
  box-shadow: 0 0 0 1px #1976D2;
}

.seeker-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
.avatar-img {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
}
.avatar-placeholder {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; color: #455A64;
}

.seeker-info { flex: 1; }
.seeker-name { font-weight: 600; color: #263238; font-size: 14px; }
.seeker-meta { font-size: 12px; color: #78909C; margin-top: 2px; }

.chevron { color: #CFD8DC; }
.seeker-card.active .chevron { color: #1976D2; }


/* MATCHES RIGHT PANEL */
.matches-content {
  flex: 1;
  background: #FAFAFA; /* Light gray bg for contrast if needed, or white */
  border-radius: 16px;
  /* border: 1px dashed #CFD8DC; */
}

/* Empty State */
.empty-selection {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #90A4AE;
  border: 2px dashed #E0E0E0;
  border-radius: 16px;
  background: #fff;
}
.empty-icon-circle {
  width: 64px; height: 64px; background: #F5F5F5; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}

/* Matches List */
.matches-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.match-card {
  background: white;
  border: 1px solid #ECEFF1;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.match-title-block { display: flex; flex-direction: column; gap: 4px; }
.dgroup-name { margin: 0; font-size: 16px; font-weight: 700; color: #263238; }
.leader-sub { font-size: 12px; color: #78909C; }
.best-match-badge {
  display: inline-block;
  background: #1976D2; color: white;
  font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 4px;
  width: fit-content;
  text-transform: uppercase;
}

.match-score { text-align: right; }
.score-val { font-size: 20px; font-weight: 800; color: #1976D2; }

/* Progress Bar */
.progress-bg {
  height: 6px;
  background: #ECEFF1;
  border-radius: 3px;
  margin-bottom: 12px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.progress-fill.high { background: #1976D2; }
.progress-fill.med { background: #42A5F5; }

/* Tags */
.match-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.match-tag {
  background: #F1F5F9;
  color: #475569;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.match-tag.type-tag.mixed {
  background: #FFF3E0;
  color: #E65100;
}
.match-tag.type-tag.standard {
  background: #E3F2FD;
  color: #1565C0;
}
.match-tag.mixed {
  background: #FAFAFA;
  color: #90A4AE;
  font-style: italic;
}

/* Buttons */
.assign-button {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.assign-button.primary {
  background: #1976D2;
  color: white;
  border: none;
}
.assign-button.primary:hover { background: #1565C0; }

.assign-button.outline {
  background: white;
  border: 1px solid #CFD8DC;
  color: #546E7A;
}
.assign-button.outline:hover {
  background: #F5F5F5;
  border-color: #B0BEC5;
}

.no-matches-warning {
  padding: 20px;
  text-align: center;
  background: #FFF3E0;
  color: #E65100;
  border-radius: 12px;
  font-size: 14px;
}
.empty-state-small {
  text-align: center; color: #90A4AE; font-size: 13px; padding: 20px;
}
</style>