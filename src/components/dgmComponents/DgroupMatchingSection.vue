<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { storeToRefs } from 'pinia'
import { User, Sparkles, Check, ChevronRight, Calendar, Users, Clock, AlertCircle } from 'lucide-vue-next'

// --- Store Setup ---
const membersStore = useMembersStore()
const { seekers, leaders, members, joinRequests } = storeToRefs(membersStore)

// --- State ---
const selectedSeekerId = ref(null)

// --- Helpers ---
function fullName(person) {
  return `${person.firstName} ${person.lastName}`
}

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
    const groupMembers = members.value.filter(m => m.dgroupLeader === name)
    const currentMembers = groupMembers.length
    const capacity = leader.dgroupCapacity || 8
    const openSlots = capacity - currentMembers
    
    let groupType = 'Mixed Aged Group'
    if (currentMembers === 0) {
      if (leader.finalTags?.ageCategory === 'Elevate') groupType = 'ELEVATE'
      else if (leader.finalTags?.ageCategory === 'B1G') groupType = 'B1G'
    } else {
      const allElevate = groupMembers.every(m => m.finalTags?.ageCategory === 'Elevate')
      const allB1G = groupMembers.every(m => m.finalTags?.ageCategory === 'B1G')
      if (allElevate) groupType = 'ELEVATE'
      else if (allB1G) groupType = 'B1G'
      else groupType = 'Mixed Aged Group'
    }

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
      averageMemberAge,
      // Pass down prescriptive details
      interests: leader.dgroupDetails?.interests || [],
      meetingTime: leader.dgroupDetails?.meetingTime || 'Flexible'
    }
  })
})

// 2. Process Seekers List (Filtered to exclude those with Pending Requests)
const availableSeekerList = computed(() => {
  return seekers.value
    .filter(s => !s.joinRequest || s.joinRequest.status !== 'pending')
    .map(s => ({
      id: s.id,
      name: fullName(s),
      firstName: s.firstName,
      lastName: s.lastName,
      age: s.age,
      gender: s.gender,
      photoURL: s.photoURL || s.profilePicture,
      prefs: s.seekerPreferences || { interests: [], meetingTime: [] } // New field
    }))
})

// 3. Process Pending Requests
const pendingRequestList = computed(() => {
  return joinRequests.value.map(s => ({
    id: s.id,
    name: fullName(s),
    photoURL: s.photoURL || s.profilePicture,
    request: s.joinRequest,
    age: s.age,
    gender: s.gender
  }))
})

// 4. Get Matches for Selected Seeker
const currentMatches = computed(() => {
  if (!selectedSeekerId.value) return []

  const seeker = availableSeekerList.value.find(s => s.id === selectedSeekerId.value)
  if (!seeker) return []

  const sAge = Number(seeker.age)
  const sGender = seeker.gender
  const sPrefs = seeker.prefs

  const candidates = leaderStats.value.filter(l => {
    if (l.openSlots <= 0) return false
    if (sGender && l.gender && l.gender !== sGender) return false
    return true
  })

  const scored = candidates.map(l => {
    let score = 0
    let reasons = []

    // A. Gender Match
    score += 40 

    // B. Age Match
    let ageScore = 0
    if (l.averageMemberAge && sAge) {
      const diff = Math.abs(sAge - l.averageMemberAge)
      if (diff <= 2) { ageScore = 30; reasons.push('Fits group age'); }
      else if (diff <= 5) { ageScore = 20; }
    } else {
       if (l.age && sAge && l.age > sAge) ageScore = 15;
    }
    score += ageScore

    // C. Interest Match (New Prescriptive)
    if (sPrefs.interests?.length > 0 && l.interests.length > 0) {
       const intersect = l.interests.filter(i => sPrefs.interests.includes(i));
       if (intersect.length > 0) {
         score += 15
         reasons.push(`${intersect.length} Common Interests`)
       }
    }

    // D. Time Match (New Prescriptive)
    if (sPrefs.meetingTime?.includes(l.meetingTime) || l.meetingTime === 'Flexible' || sPrefs.meetingTime?.includes('Flexible')) {
       score += 15
       reasons.push('Schedule Match')
    }

    if (score > 98) score = 98

    return {
      ...l,
      matchPercentage: score,
      reasons,
      averageMemberAge: l.averageMemberAge
    }
  })

  return scored.sort((a, b) => b.matchPercentage - a.matchPercentage)
})

function selectSeeker(id) {
  selectedSeekerId.value = id
}

async function assignLeader(leaderName) {
  if (!selectedSeekerId.value) return
  const seeker = members.value.find(m => m.id === selectedSeekerId.value)
  if (!seeker) return
  if(!confirm(`Assign ${seeker.firstName} to ${leaderName}?`)) return

  // Try to resolve leader id from leaders list
  const leaderObj = leaders.value.find(l => `${l.firstName} ${l.lastName}` === leaderName)
  try {
    if (leaderObj && leaderObj.id) {
      // Use centralized assign to also set dgroupId
      await membersStore.assignDgroupLeader(seeker.id, leaderObj.id)
    } else {
      // Fallback to previous behavior if we can't find leader id
      const updated = {
        ...seeker,
        dgroupLeader: leaderName,
        finalTags: { ...seeker.finalTags, isSeeker: false, isFirstTimer: false, isRegular: true }
      }
      await membersStore.updateMember(updated)
    }
    selectedSeekerId.value = null
  } catch (e) { console.error(e) }
}

async function adminOverrideRequest(req, action) {
  // When overriding, pass the leader id (dgroupLeaderId) rather than a group code
  const dgroupData = action === 'approve' ? { leaderName: req.request.leaderName, leaderId: req.request.leaderId || req.request.dgroupLeaderId } : null;
  if (!confirm(`ADMIN OVERRIDE: Are you sure you want to ${action} this request for ${req.request.leaderName}?`)) return;
  
  try {
     await membersStore.respondToJoinRequest(req.id, action, dgroupData)
     alert(`Request ${action}d via admin override.`)
  } catch(e) {
     alert("Error processing override.")
  }
}
</script>

<template>
  <div class="matching-layout">
    <div class="header-section">
      <h3><Sparkles class="icon-inline" :size="20" /> DGroup Matching</h3>
      <p>Match seekers to recommended DGroups based on availability and compatibility.</p>
    </div>

    <!-- PENDING LEADER APPROVAL SECTION -->
    <div v-if="pendingRequestList.length > 0" class="pending-section">
       <div class="section-label">
          <AlertCircle :size="16" /> Awaiting Leader Approval
       </div>
       <div class="pending-grid">
          <div v-for="req in pendingRequestList" :key="req.id" class="pending-card">
             <div class="pending-info">
                <strong>{{ req.name }}</strong>
                <span>Requested: {{ req.request.dgroupName }}</span>
                <span class="sub-text">Leader: {{ req.request.leaderName }}</span>
             </div>
             <div class="pending-actions">
                <button class="btn-xs approve" @click="adminOverrideRequest(req, 'approve')">Approve</button>

             </div>
          </div>
       </div>
    </div>

    <div class="grid-container">
      
      <!-- LEFT PANEL: SEEKERS LIST -->
      <div class="panel left-panel">
        <div class="panel-header">
          <User :size="18" class="text-blue-600" />
          <h4>Unmatched Seekers ({{ availableSeekerList.length }})</h4>
        </div>

        <div class="seekers-list-wrapper">
          <div v-if="availableSeekerList.length === 0" class="empty-state-small">
            No unmatched seekers found.
          </div>

          <div 
            v-for="seeker in availableSeekerList" 
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
              <!-- Pref Icons -->
              <div class="seeker-prefs" v-if="seeker.prefs?.interests?.length">
                 <span class="pref-badge">{{ seeker.prefs.interests.length }} Interests</span>
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
                
                <!-- Time Tag -->
                <span class="match-tag time-tag" v-if="match.meetingTime">
                   <Clock :size="10" /> {{ match.meetingTime }}
                </span>
              </div>

              <!-- Action -->
              <button 
                class="assign-button" 
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
.matching-layout { height: 100%; display: flex; flex-direction: column; }
.header-section { margin-bottom: 24px; }
.header-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px 0; font-size: 20px; color: #0D47A1; }
.header-section p { margin: 0; color: #546E7A; font-size: 14px; }
.icon-inline { color: #1976D2; }

/* PENDING SECTION */
.pending-section { background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
.section-label { font-weight: 700; color: #C2410C; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; }
.pending-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.pending-card { background: white; border: 1px solid #FED7AA; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
.pending-info { display: flex; flex-direction: column; }
.pending-info strong { font-size: 14px; color: #431407; }
.pending-info span { font-size: 12px; color: #9A3412; }
.pending-info .sub-text { color: #64748B; font-style: italic; font-size: 11px; }
.pending-actions { display: flex; flex-direction: column; gap: 4px; }
.btn-xs { padding: 4px 8px; font-size: 11px; border-radius: 4px; border: none; cursor: pointer; font-weight: 600; }
.btn-xs.approve { background: #EA580C; color: white; }
.btn-xs.reject { background: #FEE2E2; color: #991B1B; }

/* GRID */
.grid-container { display: grid; grid-template-columns: 1fr; gap: 24px; flex: 1; min-height: 500px; }
@media (min-width: 900px) { .grid-container { grid-template-columns: 350px 1fr; } }

/* PANELS */
.panel { display: flex; flex-direction: column; }
.panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.panel-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: #37474F; }
.text-blue-600 { color: #1976D2; }

/* SEEKERS LIST */
.seekers-list-wrapper { display: flex; flex-direction: column; gap: 12px; }
.seeker-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border: 1px solid #ECEFF1; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; }
.seeker-card:hover { border-color: #B0BEC5; background: #FAFAFA; }
.seeker-card.active { border-color: #1976D2; background: #E3F2FD; box-shadow: 0 0 0 1px #1976D2; }
.seeker-avatar { width: 40px; height: 40px; flex-shrink: 0; }
.avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #455A64; }
.seeker-info { flex: 1; }
.seeker-name { font-weight: 600; color: #263238; font-size: 14px; }
.seeker-meta { font-size: 12px; color: #78909C; margin-top: 2px; }
.seeker-prefs { margin-top: 4px; }
.pref-badge { background: #F1F5F9; color: #475569; font-size: 10px; padding: 2px 6px; border-radius: 8px; font-weight: 600; }
.chevron { color: #CFD8DC; }
.seeker-card.active .chevron { color: #1976D2; }

/* MATCHES RIGHT PANEL */
.matches-content { flex: 1; background: #FAFAFA; border-radius: 16px; }
.empty-selection { height: 100%; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #90A4AE; border: 2px dashed #E0E0E0; border-radius: 16px; background: #fff; }
.empty-icon-circle { width: 64px; height: 64px; background: #F5F5F5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.matches-list { display: flex; flex-direction: column; gap: 16px; }
.match-card { background: white; border: 1px solid #ECEFF1; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
.match-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.match-title-block { display: flex; flex-direction: column; gap: 4px; }
.dgroup-name { margin: 0; font-size: 16px; font-weight: 700; color: #263238; }
.leader-sub { font-size: 12px; color: #78909C; }
.best-match-badge { display: inline-block; background: #1976D2; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; width: fit-content; text-transform: uppercase; }
.match-score { text-align: right; }
.score-val { font-size: 20px; font-weight: 800; color: #1976D2; }
.progress-bg { height: 6px; background: #ECEFF1; border-radius: 3px; margin-bottom: 12px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.progress-fill.high { background: #1976D2; }
.progress-fill.med { background: #42A5F5; }
.match-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.match-tag { background: #F1F5F9; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.match-tag.type-tag.mixed { background: #FFF3E0; color: #E65100; }
.match-tag.type-tag.standard { background: #E3F2FD; color: #1565C0; }
.match-tag.time-tag { background: #F0FDF4; color: #15803D; }
.assign-button { width: 100%; padding: 10px; background: white; border-radius: 8px; font-weight: 600; font-size: 13px; color: #000000; cursor: pointer; transition: all 0.2s; }
.assign-button:hover { background: #1565C0;color: #ffffff; }
.no-matches-warning { padding: 20px; text-align: center; background: #FFF3E0; color: #E65100; border-radius: 12px; font-size: 14px; }
.empty-state-small { text-align: center; color: #90A4AE; font-size: 13px; padding: 20px; }
</style>