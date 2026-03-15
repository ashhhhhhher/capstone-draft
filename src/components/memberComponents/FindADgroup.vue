<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useMembersStore } from '../../stores/members'
import { calculateDgroupMatches } from '../../utils/DgroupMatcher'
import { 
  Music, BookOpen, Heart, Activity, Palette, Clock, CheckCircle, X, 
  Gamepad2, Trophy, Laptop, UtensilsCrossed, Plane, Dumbbell, 
  Film, Camera, Leaf, Sparkles, ArrowRight, ChevronLeft, Calendar,
  Users, Target, Info, GraduationCap, School, Briefcase, Star, Cake
} from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const membersStore = useMembersStore()

// Hides global chatbox when this modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    document.body.classList.add('find-dgroup-open');
  } else {
    document.body.classList.remove('find-dgroup-open');
  }
});

onMounted(() => {
  if (props.isOpen) {
    document.body.classList.add('find-dgroup-open');
  }
});

onUnmounted(() => {
  document.body.classList.remove('find-dgroup-open');
});

const seekerStep = ref(1) 
// 1: Interests, 2: Schedule, 3: Recommendations
const seekerPrefs = reactive({
  interests: [],
  meetingTime: [],
  daysAvailable: []
})

const myProfile = computed(() => authStore.userProfile)

// Updated Interests List
const INTEREST_OPTIONS = [
  { id: 'music', label: 'Music', icon: Music, color: '#3B82F6' },
  { id: 'arts', label: 'Arts and Crafts', icon: Palette, color: '#EC4899' },
  { id: 'sports', label: 'Sports', icon: Trophy, color: '#F59E0B' },
  { id: 'tech', label: 'Tech', icon: Laptop, color: '#06B6D4' },
  { id: 'photography', label: 'Photography', icon: Camera, color: '#EF4444' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: '#10B981' },
  { id: 'reading', label: 'Books/Reading', icon: BookOpen, color: '#8B5CF6' },
  { id: 'dancing', label: 'Dancing', icon: Activity, color: '#F43F5E' }
]

const TIME_OPTIONS = [
  { id: 'morning', label: '8:00 AM - 10:00 AM', icon: Clock },
  { id: 'mid-day', label: '10:00 AM - 12:00 PM', icon: Clock },
  { id: 'afternoon', label: '1:00 PM - 3:00 PM', icon: Clock },
  { id: 'late-afternoon', label: '3:00 PM - 5:00 PM', icon: Clock },
  { id: 'evening', label: '5:00 PM - 7:00 PM', icon: Clock },
  { id: 'flexible', label: 'Flexible', icon: Sparkles }
]

const DAY_OPTIONS = [
  { id: 'weekdays', label: 'Weekdays', icon: Calendar },
  { id: 'weekends', label: 'Weekends', icon: Calendar },
  { id: 'flexible', label: 'Flexible', icon: Sparkles }
]

// Updated Matching Logic using the Unified Utility and formatting for new UI
const recommendedDgroups = computed(() => {
  if (seekerStep.value !== 3) return []

  const seeker = {
    age: myProfile.value?.age,
    gender: myProfile.value?.gender,
    lifeStage: myProfile.value?.finalTags?.lifeStage || myProfile.value?.lifeStage,
    prefs: seekerPrefs
  }

  // Calculate scores and take the top matches
  const rawMatches = calculateDgroupMatches(
    seeker, 
    membersStore.leaders, 
    membersStore.activeMembers
  ).slice(0, 5)

  // Format data specifically for the new clean UI structure
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

function toggleInterest(id) {
  const idx = seekerPrefs.interests.indexOf(id)
  if (idx === -1) seekerPrefs.interests.push(id)
   if (idx !== -1) {
    seekerPrefs.interests.splice(idx, 1)
    return
  }
  if (seekerPrefs.interests.length >= 2) {
    return
  }
}

function toggleTime(label) {
  const idx = seekerPrefs.meetingTime.indexOf(label)
  if (label === 'Flexible') {
      seekerPrefs.meetingTime = ['Flexible']
  } else {
      if (seekerPrefs.meetingTime.includes('Flexible')) seekerPrefs.meetingTime = []
      if (idx === -1) seekerPrefs.meetingTime.push(label)
      else seekerPrefs.meetingTime.splice(idx, 1)
  }
}

function toggleDay(label) {
  const idx = seekerPrefs.daysAvailable.indexOf(label)
  if (label === 'Flexible') {
      seekerPrefs.daysAvailable = ['Flexible']
  } else {
      if (seekerPrefs.daysAvailable.includes('Flexible')) seekerPrefs.daysAvailable = []
      if (idx === -1) seekerPrefs.daysAvailable.push(label)
      else seekerPrefs.daysAvailable.splice(idx, 1)
  }
}

function formatInterestLabel(id) {
  const opt = INTEREST_OPTIONS.find(o => o.id === id);
  return opt ? opt.label : id;
}

async function handleRequestJoin(group) {
  if (!confirm(`Request to join ${group.dgroupName}?`)) return;
  try {
    await membersStore.requestJoinDgroup(myProfile.value.id, group, seekerPrefs)
    emit('close')
    alert("Request Sent!")
  } catch (e) { alert("Failed to send request.") }
}

async function handleAssignMe() {
  try {
    await authStore.updateExtendedProfile({
      finalTags: { ...myProfile.value.finalTags, isSeeker: true, isFirstTimer: false },
      seekerPreferences: seekerPrefs 
    })
    emit('close')
    alert("You've been marked as a Seeker!")
  } catch (e) { console.error(e) }
}

const isNextDisabled = computed(() => {
  if (seekerStep.value === 1) return seekerPrefs.interests.length !== 2
  if (seekerStep.value === 2) return seekerPrefs.meetingTime.length === 0 || seekerPrefs.daysAvailable.length === 0
  return false
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal seeker-modal-light wide-layout fade-in">
      
      <!-- Progress Bar -->
      <div class="stepper-container">
        <span class="stepper-label">Dgroup Discovery</span>
        <div class="steps-indicators">
          <div class="step-dot" :class="{ active: seekerStep >= 1 }"></div>
          <div class="step-dot" :class="{ active: seekerStep >= 2 }"></div>
          <div class="step-dot" :class="{ active: seekerStep >= 3 }"></div>
          <div class="step-dot" :class="{ active: seekerStep >= 4 }"></div>
        </div>
      </div>

      <button class="close-btn-light" @click="emit('close')"><X :size="20" /></button>

      <!-- STEP 1: INTERESTS -->
      <div v-if="seekerStep === 1" class="step-content">
        <div class="step-header">
          <div class="sparkle-icon">
            <Sparkles :size="40" class="sparkle-blue" />
          </div>
          <h1>What are you into?</h1>
          <p>Pick 2 interests to find your vibe</p>
        </div>
        
        <div class="interest-grid-four">
          <button 
            v-for="opt in INTEREST_OPTIONS" 
            :key="opt.id"
            class="interest-card" 
            :class="{
              selected: seekerPrefs.interests.includes(opt.id),
              disabled: seekerPrefs.interests.length >= 2 && !seekerPrefs.interests.includes(opt.id)
            }"
            @click="toggleInterest(opt.id)"
          >
            <div class="icon-wrapper" :style="{ background: opt.color + '15', color: opt.color }">
              <component :is="opt.icon" :size="22" />
            </div>
            <span class="card-label">{{ opt.label }}</span>
          </button>
        </div>

        <div class="footer-actions">
          <button 
            @click="seekerStep = 2" 
            class="btn-next-step" 
            :disabled="isNextDisabled"
          >
            Next step <ArrowRight :size="18" />
          </button>
        </div>
      </div>

      <!-- STEP 2: SCHEDULE -->
      <div v-if="seekerStep === 2" class="step-content">
        <div class="step-header">
           <button class="back-link" @click="seekerStep = 1">
             <ChevronLeft :size="16" /> Back
           </button>
           <div class="sparkle-icon">
            <Clock :size="40" class="sparkle-blue" />
          </div>
          <h1>When are you free?</h1>
          <p>Select your preferred meeting schedules and days</p>
        </div>

        <div class="schedule-sections">
           <div class="section">
             <h3 class="section-title">Preferred Times</h3>
             <div class="interest-grid-four small-gap">
               <button 
                 v-for="t in TIME_OPTIONS" 
                 :key="t.id"
                 class="interest-card compact"
                 :class="{ selected: seekerPrefs.meetingTime.includes(t.label) }"
                 @click="toggleTime(t.label)"
               >
                 <div class="icon-wrapper sm" style="color: #3B82F6; background: #3B82F615;">
                   <component :is="t.icon" :size="18" />
                 </div>
                 <span class="card-label sm">{{ t.label }}</span>
               </button>
             </div>
           </div>

           <div class="section mt-24">
             <h3 class="section-title">Available Days</h3>
             <div class="interest-grid-four small-gap">
               <button 
                 v-for="d in DAY_OPTIONS" 
                 :key="d.id"
                 class="interest-card compact"
                 :class="{ selected: seekerPrefs.daysAvailable.includes(d.label) }"
                 @click="toggleDay(d.label)"
               >
                 <div class="icon-wrapper sm" style="color: #F59E0B; background: #F59E0B15;">
                   <component :is="d.icon" :size="18" />
                 </div>
                 <span class="card-label sm">{{ d.label }}</span>
               </button>
             </div>
           </div>
        </div>

        <div class="footer-actions">
          <button 
            @click="seekerStep = 3" 
            class="btn-next-step" 
            :disabled="isNextDisabled"
          >
            See Matches <ArrowRight :size="18" />
          </button>
        </div>
      </div>

      <!-- STEP 3: RECOMMENDATIONS -->
      <div v-if="seekerStep === 3" class="step-content">
        <div class="step-header">
          <button class="back-link" @click="seekerStep = 2">
             <ChevronLeft :size="16" /> Back
           </button>
          <div class="sparkle-icon">
            <Target :size="40" color="#3B82F6" />
          </div>
          <h1>Your matches, {{ myProfile?.firstName }}!</h1>
          <p>Groups ranked by how well they fit you</p>
        </div>

        <div class="recommendation-scroller ranked-list">
          
          <!-- NEW CARD UI (More Compact & Colored Borders) -->
          <div v-for="(group, index) in recommendedDgroups" :key="group.leaderId" class="match-card-v2" :class="{'best-match-border': index === 0}">
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
                    <div class="mc-icon"><Cake :size="16" /></div>
                    <div class="mc-info-text">
                        <span class="lbl">DMEMBERS AGE RANGE</span>
                        <span class="val">{{ group.ageRange }}</span>
                        <span class="sub" v-if="group.matchBreakdown.roundedAverageAge">Typical age: {{ group.matchBreakdown.roundedAverageAge }}</span>
                    </div>
                </div>
                <div class="mc-info-box">
                    <div class="mc-icon"><GraduationCap :size="16" /></div>
                    <div class="mc-info-text">
                        <span class="lbl">LIFE STAGE</span>
                        <span class="val">{{ group.lifeStageMode }}</span>
                    </div>
                </div>
                <div class="mc-info-box full">
                    <div class="mc-icon"><Calendar :size="16" /></div>
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
                    <Users :size="16" /> {{ group.memberCount }} Members
                </div>
                <div class="mc-matched-row" v-if="group.matchedOn.length">
                    <span class="mc-matched-lbl">MATCHED ON</span>
                    <span v-for="tag in group.matchedOn" :key="tag.label" class="match-tag" :class="tag.tagClass">
                        <span class="dot"></span> {{ tag.label }}
                    </span>
                </div>
            </div>

            <div class="mc-action">
                <button class="btn-request" @click="handleRequestJoin(group)">Request to Join</button>
            </div>
          </div>
          <!-- END NEW CARD UI -->

        </div>

        <div class="footer-actions-column">
          <button @click="handleAssignMe" class="btn-secondary-light">
            Assign a Dgroup for me
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex; align-items: center; justify-content: center;
}

.seeker-modal-light.wide-layout {
  background: #FFFFFF;
  width: 95%;
  max-width: 800px;
  height: auto;
  max-height: 95vh;
  padding: 40px 32px;
  position: relative;
  overflow: hidden; 
  color: #0F172A;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  border: 1px solid #F1F5F9;
}

.step-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Stepper */
.stepper-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
  flex-shrink: 0;
}

.stepper-label {
  font-size: 13px;
  font-weight: 800;
  color: #3B82F6;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.steps-indicators {
  display: flex;
  gap: 8px;
}

.step-dot {
  width: 12px;
  height: 6px;
  background: #E2E8F0;
  border-radius: 10px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.step-dot.active {
  width: 40px;
  background: #3B82F6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.close-btn-light {
  position: absolute; top: 24px; right: 24px;
  background: #F8FAFC;
  border: none; border-radius: 50%;
  width: 36px; height: 36px; cursor: pointer; color: #64748B;
  transition: all 0.2s;
}
.close-btn-light:hover { background: #F1F5F9; color: #0F172A; transform: rotate(90deg); }

.step-header {
  text-align: center;
  margin-bottom: 32px;
  position: relative;
  flex-shrink: 0; 
}

.back-link {
  position: absolute; left: 0; top: 0;
  background: none; border: none; color: #64748B;
  font-size: 14px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  transition: color 0.2s;
}
.back-link:hover { color: #3B82F6; }

.sparkle-icon { margin-bottom: 16px; display: flex; justify-content: center; }
.sparkle-blue { color: #3B82F6; filter: drop-shadow(0 4px 6px rgba(59, 130, 246, 0.2)); }

h1 { font-size: 32px; font-weight: 900; margin: 0 0 10px; color: #0F172A; letter-spacing: -0.02em; }
.step-header p { color: #64748B; font-size: 16px; margin: 0; font-weight: 500; }

/* Grid for Interests */
.interest-grid-four {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 30px;
  overflow-y: auto;
  min-height: 0;
  padding-right: 8px;
}

.schedule-sections {
  overflow-y: auto;
  min-height: 0;
  padding-right: 8px;
  margin-bottom: 20px;
}

.recommendation-scroller {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 8px;
  margin-bottom: 16px;
}

.interest-card {
  background: #FFFFFF;
  border: 2px solid #F1F5F9;
  border-radius: 24px;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.interest-card:hover {
  border-color: #3B82F660;
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}

.interest-card.selected {
  background: #EFF6FF;
  border-color: #3B82F6;
  box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.15);
}

.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.icon-wrapper {
  width: 48px; height: 48px;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.3s;
}
.interest-card:hover .icon-wrapper { transform: scale(1.1); }

.card-label { font-size: 13px; font-weight: 800; color: #1E293B; text-align: center; }

/* Schedule */
.interest-card.compact { padding: 16px 8px; border-radius: 20px; }
.card-label.sm { font-size: 11px; }

/* ========================================================
   NEW MATCH CARD V2
   ======================================================== */
.match-card-v2 {
  background: white;
  border: 2px solid #E0E7FF; 
  border-radius: 20px;
  padding: 20px 24px; 
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.05), 0 10px 15px -3px rgba(99, 102, 241, 0.05);
  margin-bottom: 16px; 
  transition: all 0.3s;
}
.match-card-v2.best-match-border {
  border: 2px solid #6366F1; 
  background: #FAFAFF; 
}
.mc-header {
  display: flex;
  align-items: center;
  gap: 16px; 
  margin-bottom: 16px; 
}
.mc-avatar {
  width: 56px; 
  height: 56px; 
  border-radius: 14px;
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
  background: #FFFFFF; 
  border: 1px solid #F1F5F9;
  border-radius: 12px; 
  padding: 12px; 
  display: flex;
  gap: 10px; 
  align-items: flex-start;
}
.mc-info-box.full { grid-column: span 2; margin-bottom: 16px; }
.mc-icon {
  background: #F8FAFC;
  padding: 6px; 
  border-radius: 8px;
  color: #6366F1;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mc-info-text { display: flex; flex-direction: column; gap: 2px; }
.mc-info-text .lbl { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
.mc-info-text .val { font-size: 14px; font-weight: 700; color: #1E293B; }
.mc-info-text .sub { font-size: 11px; font-weight: 500; color: #64748B; margin-top: 2px; }

.mc-interests { margin-bottom: 16px;  }
.mc-interests .lbl { display: block; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.mc-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
.mc-interest-pill { background: #F8FAFC; border: 1px solid #E2E8F0; color: #475569; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 16px; }

.mc-divider { border: 0; height: 1px; background: #F1F5F9; margin: 0 0 16px 0; }

.mc-footer { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
.mc-members { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #64748B; }
.mc-matched-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mc-matched-lbl { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px; }

.match-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
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
  width: auto;
}
.mc-action .btn-request:hover { background: #1E293B; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

/* Actions */
.footer-actions, .footer-actions-column {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 10px;
}

.btn-next-step {
  width: 100%; background: linear-gradient(135deg, #2563EB, #3B82F6);
  color: white; border: none; padding: 20px; border-radius: 24px;
  font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2); transition: all 0.3s;
}
.btn-next-step:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.3); }
.btn-next-step:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; box-shadow: none; }

.btn-secondary-light {
  width: 100%; background: #F8FAFC; border: 2px solid #E2E8F0; color: #64748B; padding: 18px; border-radius: 20px; font-weight: 700; cursor: pointer; transition: all 0.2s;
}
.btn-secondary-light:hover { background: #E2E8F0; color: #0F172A; }

.fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* RESPONSIVE DESIGN - FIXING OVERLAP ON MOBILE */
@media (max-width: 768px) {
  .seeker-modal-light.wide-layout {
    padding: 24px 16px; /* Tighter padding for phones */
    border-radius: 20px; /* Slight relaxation on the curve */
    height: 95vh;
  }
  
  .interest-grid-four {
    grid-template-columns: repeat(2, 1fr); /* 2 columns on phone */
  }

  .mc-grid {
    grid-template-columns: 1fr; /* CRUCIAL FIX: Stacks the boxes so text never overlaps */
    gap: 8px;
  }

  .mc-info-box.full {
    grid-column: 1; /* Reset the span to fit perfectly in 1 column */
    margin-bottom: 8px;
  }
  
  /* Allow the text to wrap just in case it is super long */
  .mc-info-text .val {
    white-space: normal;
    word-wrap: break-word;
  }
  
  .mc-action .btn-request {
    width: 100%; /* Full width button on mobile */
  }
}
</style>

<!-- Hide chat system when this modal is open -->
<style>
body.find-dgroup-open .chat-system {
  display: none !important;
}
</style>