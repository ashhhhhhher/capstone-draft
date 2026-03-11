<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { calculateDgroupMatches } from '../../utils/DgroupMatcher'
import { storeToRefs } from 'pinia'
import { User, Sparkles, Check, ChevronRight, Calendar, Users, Clock, AlertCircle, Star, Cake, GraduationCap } from 'lucide-vue-next'

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
      lifeStage: s.finalTags?.lifeStage || s.lifeStage, // Added life stage mapping
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

// 4. Get Matches for Selected Seeker using unified utility + UI enrichment
const currentMatches = computed(() => {
  if (!selectedSeekerId.value) return []

  const seeker = availableSeekerList.value.find(s => s.id === selectedSeekerId.value)
  if (!seeker) return []

  const rawMatches = calculateDgroupMatches(
    seeker, 
    membersStore.leaders, 
    membersStore.activeMembers
  )

  // Enrich for visual UI
  return rawMatches.map((group, index) => {
    const groupMembers = membersStore.activeMembers.filter(m => m.dgroupLeaderId === group.leaderId || m.dgroupLeader === group.leaderName);
    
    let minAge = Infinity, maxAge = -Infinity;
    const lifeStageCounts = {};
    
    groupMembers.forEach(m => {
        if (m.age) {
            minAge = Math.min(minAge, Number(m.age));
            maxAge = Math.max(maxAge, Number(m.age));
        }
        const ls = m.finalTags?.lifeStage || m.lifeStage;
        if (ls) {
            lifeStageCounts[ls] = (lifeStageCounts[ls] || 0) + 1;
        }
    });

    let ageRange = 'N/A';
    if (minAge !== Infinity) {
        ageRange = minAge === maxAge ? `${minAge}` : `${minAge} - ${maxAge}`;
    } else if (group.age) {
        ageRange = `${group.age}`;
    }
    
    let lifeStageMode = null;
    let maxCount = 0;
    for (const [ls, count] of Object.entries(lifeStageCounts)) {
        if (count > maxCount) {
            maxCount = count;
            lifeStageMode = ls;
        }
    }
    if (!lifeStageMode) {
        lifeStageMode = group.finalTags?.lifeStage || group.lifeStage || 'Mixed';
    }
    
    const formatLs = (ls) => {
        if(ls === 'young-professional' || ls === 'Young Professional') return 'Young Professional';
        if(ls === 'college-university' || ls === 'College/University') return 'College/University';
        if(ls === 'high-school' || ls === 'High School') return 'High School';
        return ls;
    };

    const matchedOn = [];
    if (group.matchBreakdown.ageScore >= 30) matchedOn.push({ label: 'AGE', tagClass: 'tag-age' });
    if (group.matchBreakdown.lifeStageScore >= 15) matchedOn.push({ label: 'LIFE STAGE', tagClass: 'tag-lifestage' });
    if (group.matchBreakdown.scheduleScore >= 10) matchedOn.push({ label: 'SCHEDULE', tagClass: 'tag-schedule' });
    if (group.matchBreakdown.interestScore > 0) matchedOn.push({ label: 'INTERESTS', tagClass: 'tag-interests' });

    const nameParts = group.leaderName.split(' ');
    const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length-1][0] : nameParts[0][0];

    const leaderObj = membersStore.leaders.find(l => l.id === group.leaderId);
    const leaderPhoto = leaderObj?.photoURL || leaderObj?.profilePicture || null;

    return {
        ...group,
        originalIndex: index,
        ageRange,
        lifeStageMode: formatLs(lifeStageMode),
        matchedOn,
        leaderInitials: initials.toUpperCase(),
        leaderPhoto,
        leaderShortName: nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length-1][0]}.` : group.leaderName
    };
  });
})

function formatInterestLabel(id) {
  const labels = { music: 'Music', arts: 'Arts and Crafts', sports: 'Sports', tech: 'Tech', photography: 'Photography', fitness: 'Fitness', reading: 'Books/Reading', dancing: 'Dancing' };
  return labels[id] || id;
}

function selectSeeker(id) {
  selectedSeekerId.value = id
}

async function assignLeader(leaderName) {
  if (!selectedSeekerId.value) return
  const seeker = members.value.find(m => m.id === selectedSeekerId.value)
  if (!seeker) return
  if(!confirm(`Assign ${seeker.firstName} to ${leaderName}?`)) return

  // Try to resolve leader id from leaders list
  const leaderObj = membersStore.leaders.find(l => `${l.firstName} ${l.lastName}` === leaderName)
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

            <!-- NEW UI MATCH CARD FOR ADMIN -->
            <div 
              v-for="group in currentMatches" 
              :key="group.leaderId" 
              class="match-card-v2"
            >
              <div class="mc-header">
                  <div class="mc-avatar">
                      <img v-if="group.leaderPhoto" :src="group.leaderPhoto" />
                      <span v-else>{{ group.leaderInitials }}</span>
                  </div>
                  <div class="mc-title-col">
                      <div v-if="group.originalIndex === 0" class="mc-badge"><Star :size="10" fill="currentColor" /> BEST MATCH</div>
                      <h3>{{ group.dgroupName }}</h3>
                      <p>Led by <span>{{ group.leaderShortName }}</span></p>
                  </div>
                  <div class="mc-ring-col">
                      <svg class="circular-chart" viewBox="0 0 36 36">
                          <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path class="circle" :stroke-dasharray="group.totalScore + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div class="percentage">
                          <span class="num">{{ group.totalScore }}%</span>
                          <span class="lbl">MATCH</span>
                      </div>
                  </div>
              </div>

              <div class="mc-grid">
                  <div class="mc-info-box">
                      <div class="mc-icon"><Cake :size="18" /></div>
                      <div class="mc-info-text">
                          <span class="lbl">AGE RANGE</span>
                          <span class="val">{{ group.ageRange }}</span>
                          <span class="sub" v-if="group.matchBreakdown.roundedAverageAge">Typical age: {{ group.matchBreakdown.roundedAverageAge }}</span>
                      </div>
                  </div>
                  <div class="mc-info-box">
                      <div class="mc-icon"><GraduationCap :size="18" /></div>
                      <div class="mc-info-text">
                          <span class="lbl">LIFE STAGE</span>
                          <span class="val">{{ group.lifeStageMode }}</span>
                      </div>
                  </div>
                  <div class="mc-info-box full">
                      <div class="mc-icon"><Calendar :size="18" /></div>
                      <div class="mc-info-text">
                          <span class="lbl">SCHEDULE</span>
                          <span class="val">{{ group.meetingDays }} · {{ group.meetingTime }}</span>
                      </div>
                  </div>
              </div>

              <div class="mc-interests" v-if="group.interests.length">
                  <span class="lbl">INTERESTS</span>
                  <div class="mc-pill-row">
                      <span class="mc-interest-pill" v-for="i in group.interests" :key="i">{{ formatInterestLabel(i) }}</span>
                  </div>
              </div>

              <hr class="mc-divider" />

              <div class="mc-footer">
                  <div class="mc-members">
                      <Users :size="18" /> {{ group.memberCount }} Members
                  </div>
                  <div class="mc-matched-row" v-if="group.matchedOn.length">
                      <span class="mc-matched-lbl">MATCHED ON</span>
                      <span v-for="tag in group.matchedOn" :key="tag.label" class="match-tag" :class="tag.tagClass">
                          <span class="dot"></span> {{ tag.label }}
                      </span>
                  </div>
              </div>

              <div class="mc-action">
                  <button class="btn-request" @click="assignLeader(group.leaderName)">Assign to Group</button>
              </div>
            </div>
            <!-- END ADMIN NEW UI CARD -->

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
.matches-content { flex: 1; background: #FAFAFA; border-radius: 16px; padding-bottom: 24px;}
.empty-selection { height: 100%; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #90A4AE; border: 2px dashed #E0E0E0; border-radius: 16px; background: #fff; }
.empty-icon-circle { width: 64px; height: 64px; background: #F5F5F5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.matches-list { display: flex; flex-direction: column; gap: 16px; padding: 16px; }

.no-matches-warning { padding: 20px; text-align: center; background: #FFF3E0; color: #E65100; border-radius: 12px; font-size: 14px; }
.empty-state-small { text-align: center; color: #90A4AE; font-size: 13px; padding: 20px; }

/* ========================================================
   NEW MATCH CARD V2 (Mockup Match) for Admin Panel
   ======================================================== */
.match-card-v2 {
  background: white;
  border: 1px solid #F1F5F9;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03);
  margin-bottom: 8px;
}
.mc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.mc-avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #6366F1;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}
.mc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mc-title-col {
  flex: 1;
}
.mc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #EEF2FF;
  color: #6366F1;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.mc-title-col h3 {
  margin: 0 0 2px 0;
  font-size: 18px;
  font-weight: 900;
  color: #111827;
}
.mc-title-col p {
  margin: 0;
  font-size: 13px;
  color: #6B7280;
}
.mc-title-col p span {
  font-weight: 600;
  color: #4B5563;
}
.mc-ring-col {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}
.circular-chart { display: block; max-width: 100%; max-height: 100%; }
.circle-bg { fill: none; stroke: #EEF2FF; stroke-width: 3.5; }
.circle { fill: none; stroke: #4F46E5; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 1s ease-out; }
.mc-ring-col .percentage {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.mc-ring-col .num { font-size: 15px; font-weight: 900; color: #4F46E5; line-height: 1.1; }
.mc-ring-col .lbl { font-size: 7px; font-weight: 800; color: #818CF8; letter-spacing: 0.05em; }

.mc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.mc-info-box {
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.mc-info-box.full { grid-column: span 2; margin-bottom: 20px; }
.mc-icon {
  background: #FFFFFF;
  padding: 6px;
  border-radius: 10px;
  color: #6366F1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mc-info-text { display: flex; flex-direction: column; gap: 2px; }
.mc-info-text .lbl { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
.mc-info-text .val { font-size: 14px; font-weight: 700; color: #1E293B; }
.mc-info-text .sub { font-size: 11px; font-weight: 500; color: #64748B; margin-top: 2px; }

.mc-interests { margin-bottom: 24px; }
.mc-interests .lbl { display: block; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
.mc-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
.mc-interest-pill { background: #F8FAFC; border: 1px solid #E2E8F0; color: #475569; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 20px; }

.mc-divider { border: 0; height: 1px; background: #F1F5F9; margin: 0 0 20px 0; }

.mc-footer { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.mc-members { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #64748B; }
.mc-matched-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mc-matched-lbl { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px; }

.match-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.match-tag .dot { width: 6px; height: 6px; border-radius: 50%; }
.tag-age { background: #FEF3C7; color: #92400E; } .tag-age .dot { background: #F59E0B; }
.tag-lifestage { background: #F3E8FF; color: #6B21A8; } .tag-lifestage .dot { background: #A855F7; }
.tag-schedule { background: #DCFCE7; color: #166534; } .tag-schedule .dot { background: #22C55E; }
.tag-interests { background: #FCE7F3; color: #9D174D; } .tag-interests .dot { background: #EC4899; }

.mc-action .btn-request {
  background: #0F172A;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}
.mc-action .btn-request:hover { background: #1E293B; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
</style>