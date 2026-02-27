<script setup>
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useMembersStore } from '../../stores/members'
import { 
  Music, BookOpen, Heart, Activity, Palette, Clock, CheckCircle, X, 
  Gamepad2, Trophy, Laptop, UtensilsCrossed, Plane, Dumbbell, 
  Film, Camera, Leaf, Sparkles, ArrowRight, ChevronLeft, Calendar,
  Users, Target, Info, GraduationCap, School, Briefcase
} from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const membersStore = useMembersStore()

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
  { id: 'anytime', label: 'Anytime', icon: Sparkles }
]

const DAY_OPTIONS = [
  { id: 'weekdays', label: 'Weekdays', icon: Calendar },
  { id: 'weekends', label: 'Weekends', icon: Calendar },
  { id: 'flexible', label: 'Flexible', icon: Sparkles }
]

  function formatLifeStage(value) {
    if (!value) return ''
    if (value === 'high-school') return 'High School'
    if (value === 'college') return 'College/University'
    if (value === 'professional') return 'Young Professionals'
    return value
  }

// Matching Logic
const recommendedDgroups = computed(() => {
  if (seekerStep.value !== 3) return []

  const seekerLifeStage =
    myProfile.value?.finalTags?.lifeStage ||
    myProfile.value?.lifeStage ||
    null

  const leaders = membersStore.leaders.filter(l => {
    if (l.gender && myProfile.value?.gender && l.gender !== myProfile.value.gender) return false

    const currentCount = membersStore.activeMembers
      .filter(m => m.dgroupLeader === `${l.firstName} ${l.lastName}`).length

    const capacity = l.dgroupCapacity || 12
    return currentCount < capacity
  })

  return leaders.map(l => {
    let score = 0
    let reasons = []

    const groupMembers = membersStore.activeMembers
      .filter(m => m.dgroupLeader === `${l.firstName} ${l.lastName}`)

    // 🔥 LIFE STAGE SCORING BASED ON MEMBERS (NOT LEADER)
      let sameLifeStageCount = 0

      if (seekerLifeStage) {
        sameLifeStageCount = groupMembers.filter(m =>
          m.finalTags?.lifeStage === seekerLifeStage ||
          m.lifeStage === seekerLifeStage
        ).length

        if (groupMembers.length > 0) {
          const ratio = sameLifeStageCount / groupMembers.length
          const lifeStageScore = Math.round(ratio * 40)

          score += lifeStageScore

          if (sameLifeStageCount > 0) {
            reasons.push(`${sameLifeStageCount} members share your life stage`)
          }
        }
      }

    // INTEREST MATCHING
    const groupInterests = l.dgroupDetails?.interests || []
    const myInterests = seekerPrefs.interests || []

    if (myInterests.length > 0 && groupInterests.length > 0) {
      const intersection = groupInterests.filter(i => myInterests.includes(i))
      if (intersection.length > 0) {
        const interestScore = Math.min(
          30,
          (intersection.length / myInterests.length) * 30 + 10
        )
        score += interestScore
        reasons.push(`${intersection.length} Shared Interests`)
      }
    }

    // SCHEDULE MATCHING
    const groupTime = l.dgroupDetails?.meetingTime || 'Anytime'

    if (seekerPrefs.meetingTime.includes('Anytime') || groupTime === 'Anytime') {
      score += 30
      reasons.push('Schedule Match')
    } else if (seekerPrefs.meetingTime.includes(groupTime)) {
      score += 30
      reasons.push('Exact Time Match')
    }

    return {
      leaderId: l.id,
      leaderName: `${l.firstName} ${l.lastName}`,
      dgroupName: l.dgroupName || `${l.firstName}'s Dgroup`,
      dgroupId: l.dgroupId || 'N/A',
      description: l.dgroupDescription || "A group of individuals growing together in faith and community.",
      score: Math.min(100, Math.round(score)),
      reasons,
      interests: groupInterests,
      capacity: l.dgroupCapacity || 12,
      memberCount: groupMembers.length,
      avgAge: l.age || 25,
      meetingTime: groupTime,
      meetingDays: l.dgroupDetails?.meetingDays || 'Flexible',
      sameLifeStageCount,
      seekerLifeStage
    }
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 5)
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
  if (label === 'Anytime') {
      seekerPrefs.meetingTime = ['Anytime']
  } else {
      if (seekerPrefs.meetingTime.includes('Anytime')) seekerPrefs.meetingTime = []
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
          <div v-for="(group, index) in recommendedDgroups" :key="group.leaderId" class="match-rank-card">
            <div v-if="index === 0" class="best-match-badge">BEST MATCH</div>
            
            <div class="rank-card-main">
              <div class="rank-left">
                <div class="group-icon-lg">
                  <component :is="INTEREST_OPTIONS.find(i => group.interests.includes(i.id))?.icon || Users" :size="32" color="#3B82F6" />
                </div>
                <div class="group-details-col">
                  <div class="group-name-row">
                    <h3>{{ group.dgroupName }}</h3>
                    <span class="match-pill">{{ group.score }}% match</span>
                  </div>
                  <p class="group-desc">{{ group.description }}</p>
                  
                  <div class="tag-row">
                    <span v-for="tag in group.interests.slice(0, 4)" :key="tag" class="interest-tag-pill">
                      <component :is="INTEREST_OPTIONS.find(i => i.id === tag)?.icon" :size="12" />
                      {{ INTEREST_OPTIONS.find(i => i.id === tag)?.label || tag }}
                    </span>
                  </div>

                  <div class="stats-row">
                  <div class="stat-item">
                    <Users :size="14" />
                    {{ group.memberCount }} members
                  </div>

                  <div 
                    v-if="group.sameLifeStageCount > 0"
                    class="stat-item"
                  >
                    {{ group.sameLifeStageCount }}
                    in the same life stage
                    
                  </div>

                  <div class="stat-item">
                    Avg age: {{ group.avgAge }} <span>👍</span>
                  </div>
                </div>
                  
                  <div class="schedule-info-row">
                    <Clock :size="14" /> {{ group.meetingTime }} • {{ group.meetingDays }}
                  </div>
                </div>
              </div>

              <div class="rank-right">
                <div class="score-circle">
                  <svg class="progress-ring" width="64" height="64">
                    <circle class="progress-ring__background" stroke="#F1F5F9" stroke-width="5" fill="transparent" r="26" cx="32" cy="32"/>
                    <circle class="progress-ring__circle" stroke="#3B82F6" stroke-width="5" fill="transparent" r="26" cx="32" cy="32" :stroke-dasharray="2 * Math.PI * 26" :stroke-dashoffset="2 * Math.PI * 26 * (1 - group.score / 100)"/>
                  </svg>
                  <span class="score-number">{{ group.score }}</span>
                </div>
                <button class="btn-join-match" @click="handleRequestJoin(group)">Join</button>
              </div>
            </div>

            <div class="progress-bar-bottom">
              <div class="progress-fill" :style="{ width: group.score + '%' }"></div>
            </div>
          </div>
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
  overflow-y: auto;
  color: #0F172A;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  border: 1px solid #F1F5F9;
}

/* Stepper */
.stepper-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
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

/* Life Stage Layout */
.lifestage-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 30px;
}

.lifestage-card {
  background: #FFFFFF;
  border: 2px solid #F1F5F9;
  border-radius: 24px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.lifestage-card:hover { border-color: #3B82F6; transform: translateX(8px); }
.lifestage-card.selected { background: #EFF6FF; border-color: #3B82F6; }

.icon-wrapper-lg {
  width: 64px; height: 64px;
  border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
}

.card-label-lg { font-size: 20px; font-weight: 800; color: #0F172A; }

.section-title {
  font-size: 12px; font-weight: 800; color: #3B82F6;
  text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.1em;
}

/* Schedule */
.interest-card.compact { padding: 16px 8px; border-radius: 20px; }
.card-label.sm { font-size: 11px; }

/* Matches */
.match-rank-card {
  background: #FFFFFF;
  border: 2px solid #F1F5F9;
  border-radius: 28px;
  overflow: hidden;
  position: relative;
  transition: all 0.3s;
  margin-bottom: 20px;
}
.match-rank-card:hover { border-color: #3B82F6; box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.05); }

.best-match-badge {
  position: absolute; top: 0; right: 0;
  background: #3B82F6; color: white;
  font-size: 11px; font-weight: 900;
  padding: 6px 16px; border-bottom-left-radius: 20px; z-index: 5;
}

.rank-card-main { padding: 32px; display: flex; justify-content: space-between; align-items: center; }
.rank-left { display: flex; gap: 24px; flex: 1; }

.group-icon-lg {
  width: 72px; height: 72px;
  background: #F8FAFC;
  border-radius: 24px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  border: 2px solid #F1F5F9;
}

.group-name-row h3 { margin: 0; font-size: 22px; font-weight: 900; color: #0F172A; }
.match-pill { background: #EFF6FF; color: #3B82F6; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 10px; }

.group-desc { font-size: 14px; color: #64748B; margin: 8px 0 16px; line-height: 1.6; font-weight: 500; }

.tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.interest-tag-pill { background: #F8FAFC; color: #475569; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 12px; display: flex; align-items: center; gap: 6px; border: 1px solid #F1F5F9; }

.stats-row { display: flex; gap: 20px; font-size: 13px; color: #64748B; margin-bottom: 8px; font-weight: 600; }
.stat-item { display: flex; align-items: center; gap: 6px; }

.rank-right { display: flex; flex-direction: column; align-items: center; gap: 20px; padding-left: 28px; border-left: 2px solid #F1F5F9; }

.score-circle { position: relative; display: flex; align-items: center; justify-content: center; }
.score-number { position: absolute; font-size: 18px; font-weight: 900; color: #0F172A; }
.progress-ring__circle { transition: stroke-dashoffset 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: rotate(-90deg); transform-origin: 50% 50%; }

.btn-join-match {
  background: #0F172A; color: white; border: none; padding: 10px 32px; border-radius: 14px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s;
}
.btn-join-match:hover { background: #3B82F6; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

.progress-bar-bottom { height: 6px; background: #F1F5F9; width: 100%; }
.progress-fill { height: 100%; background: linear-gradient(to right, #3B82F6, #60A5FA); border-radius: 0 10px 10px 0; }

/* Actions */
.btn-next-step {
  width: 100%; background: linear-gradient(135deg, #2563EB, #3B82F6);
  color: white; border: none; padding: 20px; border-radius: 24px;
  font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2); transition: all 0.3s;
}
.btn-next-step:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.3); }
.btn-next-step:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; box-shadow: none; }

.btn-secondary-light {
  width: 100%; background: #F8FAFC; border: 5px solid #509fee; color: #64748B; padding: 18px; border-radius: 20px; font-weight: 700; cursor: pointer; transition: all 0.2s;
}
.btn-secondary-light:hover { background: #89bbed; color: #0F172A; }

.fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>