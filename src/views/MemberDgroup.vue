<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import DgroupAttendanceModal from '../components/memberComponents/DgroupAttendanceModal.vue'
import DgroupAbsenceMonitoring from '../components/memberComponents/DgroupAbsenceMonitoring.vue'
import { 
  User, Users, ChevronRight, X, UserMinus, HelpCircle, 
  Pencil, ClipboardCheck, Copy, Calendar as CalendarIcon, ArrowLeft,
  Music, BookOpen, Heart, Activity, Palette, Clock, CheckCircle
} from 'lucide-vue-next'
import DgroupOverview from '../components/memberComponents/DgroupOverview.vue' 

const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()

const activeTab = ref('upline') 
const showCreateModal = ref(false)
const showPersonModal = ref(false)
const showJoinByIdModal = ref(false)
const showEditGroupModal = ref(false)
const showSeekerFlowModal = ref(false)

// Join by ID logic
const dgroupIdInput = ref('')
const joinStatus = ref({ type: '', msg: '' })

// Attendance modal visibility
const showAttendanceModal = ref(false)

// Constants for Preferences
const INTEREST_OPTIONS = [
  { id: 'music', label: 'Music & Worship', icon: Music },
  { id: 'arts', label: 'Arts & Crafts', icon: Palette },
  { id: 'dancing', label: 'Dancing', icon: Activity },
  { id: 'sports', label: 'Sports', icon: Activity },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'devotionals', label: 'Devotionals', icon: Heart },
  { id: 'journaling', label: 'Journaling', icon: BookOpen }
]

const TIME_OPTIONS = [
  '8:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '1:00 PM - 3:00 PM',
  '3:00 PM - 5:00 PM',
  '5:00 PM - 7:00 PM',
  'Anytime'
]

// Edit Group Logic (Leader)
const editGroupForm = reactive({
  dgroupName: '',
  capacity: 12,
  dgroupId: '',
  interests: [],
  meetingTime: 'Anytime'
})

// Seeker Flow Logic
const seekerStep = ref(1) // 1: Preferences, 2: Recommendations
const seekerPrefs = reactive({
  interests: [],
  meetingTime: []
})

// Added missing reactive form state
const attendanceForm = reactive({
  attendees: {},
  conversations: 0,
  evangelized: 0,
  guests: 0,
  date: new Date().toISOString().split('T')[0]
})

const selectedPerson = ref(null) 
const mockGroups = ref([])

onMounted(() => {
  membersStore.fetchMembers()
})

const myProfile = computed(() => authStore.userProfile)
const isLeader = computed(() => myProfile.value?.finalTags?.isDgroupLeader)
const rawLeaderName = computed(() => myProfile.value?.dgroupLeader)

// return NULL if the leader is N/A, ensuring these users are NOT grouped together
const myLeaderName = computed(() => {
  const leader = rawLeaderName.value
  if (!leader || leader === 'N/A (D-Lead)' || leader === 'N/A (First Timer)') return null
  return leader
})

const myName = computed(() => myProfile.value ? `${myProfile.value.firstName} ${myProfile.value.lastName}` : '')

// Pending Join Requests for ME (as a leader)
const myPendingRequests = computed(() => {
  if (!isLeader.value || !myProfile.value) return []
  return membersStore.activeMembers.filter(m => 
    m.joinRequest && 
    m.joinRequest.leaderId === myProfile.value.id && 
    m.joinRequest.status === 'pending'
  )
})

// Check if *I* have a pending request sent out
const mySentRequest = computed(() => {
  if (!myProfile.value?.joinRequest) return null;
  if (myProfile.value.joinRequest.status !== 'pending') return null;
  return myProfile.value.joinRequest;
})

const showSeekerQuestionnaire = computed(() => {
  if (!myProfile.value) return false
  const p = myProfile.value
  // Hide if leader, assigned to a leader, or pending request
  if (p.finalTags.isDgroupLeader || p.dgroupLeader || mySentRequest.value) return false
  // Show if seeker or first timer
  return true
})

const myLeaderObject = computed(() => {
  if (!myLeaderName.value) return null
  return membersStore.activeMembers.find(m => 
    `${m.firstName} ${m.lastName}` === myLeaderName.value
  )
})

// isolating UplineDgroups like from the "N/A" group.
const myUplineGroup = computed(() => {
  if (!myLeaderName.value) return []
  return membersStore.activeMembers.filter(m => 
    m.dgroupLeader === myLeaderName.value && m.id !== myProfile.value?.id
  )
})

const myDownlineGroups = computed(() => {
  const groups = []
  if (isLeader.value) {
    const myNameVal = myName.value
    const members = membersStore.activeMembers.filter(m => m.dgroupLeader === myNameVal)
    
    groups.push({
      id: myProfile.value.dgroupId || 'g-default',
      dgroupId: myProfile.value.dgroupId || 'No ID',
      name: myProfile.value.dgroupName || `${myProfile.value?.firstName}'s Dgroup`,
      members: members,
      lifeStage: myProfile.value?.finalTags?.ageCategory || 'Mixed',
      capacity: myProfile.value?.dgroupCapacity || 12,
      interests: myProfile.value?.dgroupDetails?.interests || [],
      meetingTime: myProfile.value?.dgroupDetails?.meetingTime || 'Anytime'
    })
  }
  return [...groups, ...mockGroups.value]
})

const primaryDownlineGroup = computed(() => {
  return myDownlineGroups.value.length > 0 ? myDownlineGroups.value[0] : null
})

// --- PRESCRIPTIVE ANALYTICS LOGIC ---
const recommendedDgroups = computed(() => {
  if (seekerStep.value !== 2) return []
  
  const leaders = membersStore.leaders.filter(l => {
    // Basic filter: gender match (strict)
    if (l.gender && myProfile.value?.gender && l.gender !== myProfile.value.gender) return false
    // Capacity check
    const currentCount = membersStore.activeMembers.filter(m => m.dgroupLeader === `${l.firstName} ${l.lastName}`).length
    const capacity = l.dgroupCapacity || 12
    return currentCount < capacity
  })

  // Calculate Matches
  const matches = leaders.map(l => {
    let score = 0
    let reasons = []

    // 1. Age (40%)
    const myAge = myProfile.value?.age || 20
    const leaderAge = l.age || 25 // fallback
    const diff = Math.abs(myAge - leaderAge)
    
    let ageScore = 0
    if (diff <= 3) ageScore = 40
    else if (diff <= 5) ageScore = 30
    else if (diff <= 10) ageScore = 15
    score += ageScore
    if (ageScore > 20) reasons.push('Age Match')

    // 2. Interests (30%)
    const groupInterests = l.dgroupDetails?.interests || []
    const myInterests = seekerPrefs.interests || []
    if (myInterests.length > 0 && groupInterests.length > 0) {
      const intersection = groupInterests.filter(i => myInterests.includes(i))
      if (intersection.length > 0) {
        const intScore = Math.min(30, (intersection.length / myInterests.length) * 30 + 10) // Bonus for any match
        score += intScore
        reasons.push(`${intersection.length} Shared Interests`)
      }
    } else if (groupInterests.length === 0) {
       // Neutral score for groups without tags yet
       score += 10
    }

    // 3. Time (30%)
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
      score: Math.min(100, Math.round(score)),
      reasons,
      details: l.dgroupDetails,
      capacity: l.dgroupCapacity || 12,
      currentCount: membersStore.activeMembers.filter(m => m.dgroupLeader === `${l.firstName} ${l.lastName}`).length
    }
  })

  return matches.sort((a, b) => b.score - a.score).slice(0, 5)
})

function viewPerson(person) {
  if(!person) return
  selectedPerson.value = person
  showPersonModal.value = true
}

function removeMember(member) {
  if(confirm(`Are you sure you want to remove ${member.firstName} from this Dgroup?`)) {
    try {
      membersStore.removeDgroupMember(member.id);
    } catch (e) {
      alert("Failed to remove member. Please try again.");
    }
  }
}

function calculateAge(birthday) {
  if (!birthday) return 0
  const birthDate = new Date(birthday)
  const difference = Date.now() - birthDate.getTime()
  const ageDate = new Date(difference)
  return Math.abs(ageDate.getUTCFullYear() - 1970)
}

const groupAverageAge = computed(() => {
  const group = primaryDownlineGroup.value
  if (!group || !group.members || group.members.length === 0) return null
  
  const validAges = group.members
    .map(m => m.birthday ? calculateAge(m.birthday) : null)
    .filter(a => a !== null && a > 0)
    
  if (validAges.length === 0) return null
  
  const sum = validAges.reduce((a, b) => a + b, 0)
  return Math.round(sum / validAges.length)
})

const canSeeBirthday = computed(() => {
  if (!selectedPerson.value || !myProfile.value) return false
  const p = selectedPerson.value
  const targetName = `${p.firstName} ${p.lastName}`
  if (myLeaderName.value && targetName === myLeaderName.value) return true
  if (isLeader.value && p.dgroupLeader === myName.value) return true
  return false
})

function copyId(id) {
  if(!id || id === 'No ID') return
  navigator.clipboard.writeText(id).then(() => {
    alert('Dgroup ID copied!')
  }).catch(() => {})
}

// Seeker Flow Functions
function startSeekerFlow() {
  seekerStep.value = 1
  seekerPrefs.interests = []
  seekerPrefs.meetingTime = []
  showSeekerFlowModal.value = true
}

function toggleInterest(id) {
  const idx = seekerPrefs.interests.indexOf(id)
  if (idx === -1) seekerPrefs.interests.push(id)
  else seekerPrefs.interests.splice(idx, 1)
}

function toggleTime(t) {
  const idx = seekerPrefs.meetingTime.indexOf(t)
  if (t === 'Anytime') {
     seekerPrefs.meetingTime = ['Anytime']
  } else {
     if (seekerPrefs.meetingTime.includes('Anytime')) seekerPrefs.meetingTime = []
     if (idx === -1) seekerPrefs.meetingTime.push(t)
     else seekerPrefs.meetingTime.splice(idx, 1)
  }
}

async function handleRequestJoin(group) {
  if (!confirm(`Request to join ${group.dgroupName}? The leader will be notified.`)) return;
  
  try {
    await membersStore.requestJoinDgroup(myProfile.value.id, group, seekerPrefs)
    showSeekerFlowModal.value = false
    alert("Request Sent! Waiting for leader approval.")
  } catch (e) {
    alert("Failed to send request.")
  }
}

async function handleAssignMe() {
  // Traditional Seeker Flow
  try {
    await authStore.updateExtendedProfile({
      finalTags: { ...myProfile.value.finalTags, isSeeker: true, isFirstTimer: false },
      seekerPreferences: seekerPrefs // Save prefs anyway
    })
    showSeekerFlowModal.value = false
    alert("You have been marked as a Seeker! An Admin will assign you soon.")
  } catch (e) { console.error(e) }
}

async function joinDgroupById() {
  joinStatus.value = { type: '', msg: '' }
  const idToFind = dgroupIdInput.value.trim();
  if (!idToFind) return;
  const leader = membersStore.leaders.find(l => l.dgroupId === idToFind);
  if (!leader) {
    joinStatus.value = { type: 'error', msg: 'Dgroup ID not found.' }
    return;
  }
  const leaderName = `${leader.firstName} ${leader.lastName}`;
  try {
    await authStore.updateExtendedProfile({
      dgroupLeader: leaderName,
      finalTags: { ...myProfile.value.finalTags, isSeeker: false, isRegular: true }
    })
    joinStatus.value = { type: 'success', msg: `Joined ${leaderName}'s group!` }
    setTimeout(() => { showJoinByIdModal.value = false }, 1500);
  } catch (e) {
    joinStatus.value = { type: 'error', msg: 'Failed to join group.' }
  }
}

function openEditGroupModal() {
  if (!myProfile.value) return
  editGroupForm.dgroupName = myProfile.value.dgroupName || ''
  editGroupForm.capacity = myProfile.value.dgroupCapacity || 12
  editGroupForm.dgroupId = myProfile.value.dgroupId || 'N/A'
  // Populate new fields
  editGroupForm.interests = myProfile.value.dgroupDetails?.interests || []
  editGroupForm.meetingTime = myProfile.value.dgroupDetails?.meetingTime || 'Anytime'
  showEditGroupModal.value = true
}

function toggleEditInterest(id) {
  const idx = editGroupForm.interests.indexOf(id)
  if (idx === -1) editGroupForm.interests.push(id)
  else editGroupForm.interests.splice(idx, 1)
}

async function saveGroupDetails() {
  try {
    await authStore.updateExtendedProfile({
      dgroupName: editGroupForm.dgroupName,
      dgroupCapacity: editGroupForm.capacity,
      dgroupDetails: {
        interests: editGroupForm.interests,
        meetingTime: editGroupForm.meetingTime
      }
    })
    showEditGroupModal.value = false
    alert("Group details updated!")
  } catch (e) {
    alert("Failed to save changes.")
  }
}

async function handleLeaderResponse(req, action) {
  if (!confirm(`Are you sure you want to ${action} ${req.firstName}?`)) return
  try {
    await membersStore.respondToJoinRequest(req.id, action)
    alert(`Request ${action}ed`)
  } catch (e) {
    alert("Error processing request")
  }
}
</script>

<template>
  <div class="dgroup-view">
    
    <!-- PENDING REQUEST BANNER (Seeker Side) -->
    <div v-if="mySentRequest" class="pending-banner">
       <Clock :size="20" />
       <div>
         <strong>Request Pending</strong>
         <p>Waiting for {{ mySentRequest.leaderName }} to approve your request.</p>
       </div>
    </div>

    <div v-if="showSeekerQuestionnaire" class="seeker-prompt">
      <DgroupOverview />
      <div class="icon-circle">
        <HelpCircle :size="32" color="#1976D2" />
      </div>
      <h3>Want to join a Dgroup?</h3>
      <p>It looks like you aren't part of a Discipleship Group yet.</p>
      
      <div class="question-box">
        <p class="question">How would you like to proceed?</p>
        <div class="seeker-actions">
          <button class="btn-action primary" @click="startSeekerFlow">
            I want to be part of a Dgroup
          </button>
          <button class="btn-action secondary" @click="showJoinByIdModal = true">
            Join by Dgroup ID
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <!-- MODERN TABS -->
      <div class="tabs-container">
        <div class="tabs-segment">
            <button :class="{ active: activeTab === 'upline' }" @click="activeTab = 'upline'">
                UPLINE
            </button>
            <button v-if="isLeader" :class="{ active: activeTab === 'downline' }" @click="activeTab = 'downline'">
                DOWNLINE
                <span v-if="myPendingRequests.length" class="badge-dot"></span>
            </button>
        </div>
      </div>

      <!-- TAB 1: UPLINE -->
      <div v-if="activeTab === 'upline'" class="tab-content fade-in">
        
        <!-- Only show Leader Card if myLeaderName is a valid person -->
        <div class="leader-card-modern" v-if="myLeaderName" @click="viewPerson(myLeaderObject)">
          <div class="leader-bg-accent"></div>
          <div class="leader-content-row">
             <div class="avatar-ring-large">
                <User :size="36" color="#1565C0" />
             </div>
             <div class="leader-info-modern">
                <span class="label-modern">DGroup Leader</span>
                <h3>{{ myLeaderName }}</h3>
                <span v-if="!myLeaderObject" class="missing-text">(Profile not found)</span>
             </div>
             <ChevronRight v-if="myLeaderObject" :size="24" color="#90A4AE" class="chevron" />
          </div>
        </div>

        <!-- Empty / Special States -->
        <div v-else class="empty-state-modern">
          <div class="empty-icon"><UserMinus :size="32" /></div>
          
          <p v-if="myProfile?.finalTags.isSeeker || mySentRequest">
             You are listed as a <strong>Seeker</strong>. <br>Waiting for a leader to add you.
          </p>
          
          <p v-else-if="rawLeaderName === 'N/A (D-Lead)'">
            Your Dgroup Leader is part of the main church and not under ELEVATE/B1G WKND <br>
            <span style="font-size: 0.9em; opacity: 0.8">(No Upline Assigned)</span>
          </p>

          <p v-else-if="rawLeaderName === 'N/A (First Timer)'">
            Welcome! Please connect with a leader to join a group.
          </p>

          <p v-else>You are not assigned to a Dgroup yet.</p>
        </div>

        <!-- Only show Co-Members list if there is a valid leader -->
        <div class="common-list-card" v-if="myLeaderName">
          <div class="list-header row">
              <h4>Co-Members</h4>
              <span class="count-badge">{{ myUplineGroup.length }}</span>
          </div>
          <div>
              <div v-for="member in myUplineGroup" :key="member.id" class="list-item" @click="viewPerson(member)">
                <div class="avatar sm">{{ member.firstName.charAt(0) }}</div>
                <div class="info-col">
                    <span class="name">{{ member.firstName }} {{ member.lastName }}</span>
                </div>
              </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: DOWNLINE -->
      <div v-if="activeTab === 'downline'" class="tab-content fade-in">
        
        <!-- REQUEST INBOX (Leader) -->
        <div v-if="myPendingRequests.length > 0" class="requests-card">
           <div class="list-header alert-header">
              <h4>Waitlist & Requests</h4>
              <span class="count-badge red">{{ myPendingRequests.length }}</span>
           </div>
           <div class="requests-list">
              <div v-for="req in myPendingRequests" :key="req.id" class="request-item">
                 <div class="req-info">
                    <span class="req-name">{{ req.firstName }} {{ req.lastName }}</span>
                    <span class="req-sub">Requested: {{ new Date(req.joinRequest.requestedAt).toLocaleDateString() }}</span>
                 </div>
                 <div class="req-actions">
                    <button class="btn-approve" @click="handleLeaderResponse(req, 'approve')"><CheckCircle :size="16" /></button>
                    <button class="btn-reject" @click="handleLeaderResponse(req, 'reject')"><X :size="16" /></button>
                 </div>
              </div>
           </div>
        </div>

        <div v-if="!primaryDownlineGroup" class="empty-state-modern">
           <div class="empty-icon"><Users :size="32" /></div>
           <p>You don't have any groups yet.</p>
        </div>

        <div v-else class="drill-down-view">
          <div class="drill-header-enhanced">
             <div class="header-top-row">
                <div class="group-title-label">Your Group</div>
             </div>
            
            <div class="group-hero">
                <div class="hero-icon">
                     <Users :size="32" color="white" />
                </div>
                <div class="hero-content">
                    <h2>{{ primaryDownlineGroup.name }}</h2>
                    <div class="hero-badges">
                         <div class="info-badge id-badge" @click="copyId(primaryDownlineGroup.dgroupId)" title="Click to copy ID">
                             ID: {{ primaryDownlineGroup.dgroupId }}
                             <Copy :size="12" class="copy-icon" />
                         </div>
                         <div class="info-badge age-badge" v-if="groupAverageAge">
                             AVG AGE: {{ groupAverageAge }}
                         </div>
                    </div>
                    <!-- New Details Display -->
                    <div class="hero-details">
                       <div class="detail-tag time" v-if="primaryDownlineGroup.meetingTime">
                          <Clock :size="10" /> {{ primaryDownlineGroup.meetingTime }}
                       </div>
                       <div class="detail-tag interest" v-for="tag in primaryDownlineGroup.interests" :key="tag">
                          #{{ tag }}
                       </div>
                    </div>

                    <p class="capacity-sub">
                        <Users :size="12" /> {{ primaryDownlineGroup.members.length }} / {{ primaryDownlineGroup.capacity }} Active Members
                    </p>
                </div>
                <button class="edit-icon-btn" @click="openEditGroupModal" title="Edit Group">
                    <Pencil :size="16" />
                </button>
            </div>
          </div>

          <div class="common-list-card">
            <div class="list-header label-only">Members List</div>
            <div v-for="m in primaryDownlineGroup.members" :key="m.id" class="list-item" @click="viewPerson(m)">
              <div class="avatar md">{{ m.firstName.charAt(0) }}</div>
              <div class="info-col">
                <span class="name">{{ m.firstName }} {{ m.lastName }}</span>
                <span class="status">{{ m.status || 'Active' }}</span>
              </div>
              <button class="btn-icon-danger" @click.stop="removeMember(m)" title="Remove Member">
                <UserMinus :size="18" />
              </button>
            </div>
             <div v-if="primaryDownlineGroup.members.length === 0" class="empty-list-msg">
                No members in this group yet.
             </div>
          </div>
          <!-- Absence monitoring for downline members -->
          <div style="margin-top:16px">
            <DgroupAbsenceMonitoring />
          </div>
        </div>
      </div>
    </div>
    
    <!-- MODALS -->
    
    <!-- Seeker Preferences & Matching Modal -->
    <div v-if="showSeekerFlowModal" class="modal-overlay">
       <div class="modal seeker-modal">
          <!-- STEP 1: PREFERENCES -->
          <div v-if="seekerStep === 1">
             <div class="modal-header">
                <h3>Let's get to know you</h3>
                <p>Help us find a Dgroup that fits your vibe.</p>
             </div>
             
             <div class="pref-section">
                <label>Interests (Select all that apply)</label>
                <div class="chip-grid">
                   <button 
                     v-for="opt in INTEREST_OPTIONS" 
                     :key="opt.id"
                     class="chip-btn" 
                     :class="{ selected: seekerPrefs.interests.includes(opt.id) }"
                     @click="toggleInterest(opt.id)"
                   >
                     <component :is="opt.icon" :size="14" />
                     {{ opt.label }}
                   </button>
                </div>
             </div>

             <div class="pref-section">
                <label>Preferred Meeting Time</label>
                <div class="chip-grid">
                   <button 
                     v-for="t in TIME_OPTIONS" 
                     :key="t"
                     class="chip-btn"
                     :class="{ selected: seekerPrefs.meetingTime.includes(t) }"
                     @click="toggleTime(t)"
                   >
                     {{ t }}
                   </button>
                </div>
             </div>
             
             <div class="actions">
                <button @click="showSeekerFlowModal = false" class="cancel">Cancel</button>
                <button @click="seekerStep = 2" class="confirm">Find Groups</button>
             </div>
          </div>

          <!-- STEP 2: RECOMMENDATIONS -->
          <div v-if="seekerStep === 2">
             <div class="modal-header">
                <h3>Recommended for you</h3>
                <p>Based on your age, interests, and availability.</p>
             </div>

             <div class="rec-list">
                <div v-for="group in recommendedDgroups" :key="group.leaderId" class="rec-card">
                   <div class="rec-score">{{ group.score }}% Match</div>
                   <div class="rec-info">
                      <h4>{{ group.dgroupName }}</h4>
                      <p class="rec-leader">Led by {{ group.leaderName }}</p>
                      <div class="rec-tags">
                         <span v-for="r in group.reasons" :key="r" class="rec-tag-sm">{{ r }}</span>
                      </div>
                      <div class="rec-meta">
                        {{ group.details?.meetingTime || 'Anytime' }} • {{ group.currentCount }}/{{ group.capacity }} filled
                      </div>
                   </div>
                   <button class="btn-join-sm" @click="handleRequestJoin(group)">Request</button>
                </div>

                <div v-if="recommendedDgroups.length === 0" class="empty-rec">
                   No high matches found right now.
                </div>
             </div>

             <div class="actions column">
                <button @click="handleAssignMe" class="btn-text">
                   Skip & Assign a Dgroup for me
                </button>
                <button @click="seekerStep = 1" class="cancel">Back</button>
             </div>
          </div>
       </div>
    </div>

    <!-- Edit Group Modal -->
    <div v-if="showEditGroupModal" class="modal-overlay">
      <div class="modal create-modal scrollable-modal">
        <h3>Edit Group Details</h3>
        <div class="form-group"><label>Group Name</label><input v-model="editGroupForm.dgroupName" /></div>
        <div class="form-group"><label>Capacity</label><input type="number" v-model="editGroupForm.capacity" /></div>
        
        <!-- New Leader Fields -->
        <div class="form-group">
           <label>Meeting Schedule</label>
           <select v-model="editGroupForm.meetingTime" class="form-select">
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
           </select>
        </div>

        <div class="form-group">
           <label>Group Interests</label>
           <div class="chip-grid small">
              <button 
                 v-for="opt in INTEREST_OPTIONS" 
                 :key="opt.id"
                 class="chip-btn" 
                 :class="{ selected: editGroupForm.interests.includes(opt.id) }"
                 @click="toggleEditInterest(opt.id)"
               >
                 {{ opt.label }}
               </button>
           </div>
        </div>

        <div class="actions">
          <button @click="showEditGroupModal = false" class="cancel">Cancel</button>
          <button @click="saveGroupDetails" class="confirm">Save Changes</button>
        </div>
      </div>
    </div>
    
    <!-- Other Modals (Attendance, JoinById, Person) -->
    <div v-if="showAttendanceModal" class="modal-overlay">
       <div class="modal create-modal attendance-scroll-modal">
        <h3>Weekly Dgroup Report</h3>
        <label class="section-label">Members & Status</label>
        <div class="attendance-checklist-updated">
          <div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
            <input type="checkbox" v-model="data.isPresent" />
            <div class="member-info-stack" style="flex: 1; margin-left: 8px;">
              <span class="member-name" :style="{ fontWeight: data.scanned ? '800' : '500' }">{{ data.name }}</span>
            </div>
            <select v-model="data.tag" class="status-select" :disabled="!data.isPresent">
              <option value="DL">DL</option>
              <option value="DM">DM</option>
              <option value="NW">NW</option>
              <option value="NEW">NEW</option>
            </select>
          </div>
        </div>
        <div class="group-stats">
          <div class="stat-input"><label>Conv. (C)</label><input type="number" v-model="attendanceForm.conversations" min="0" /></div>
          <div class="stat-input"><label>Evang. (E)</label><input type="number" v-model="attendanceForm.evangelized" min="0" /></div>
          <div class="stat-input"><label>Guests (G)</label><input type="number" v-model="attendanceForm.guests" min="0" /></div>
        </div>
        <div class="actions">
          <button @click="showAttendanceModal = false" class="cancel">Cancel</button>
          <button @click="submitAttendance" class="confirm">Submit Report</button>
        </div>
      </div>
    </div>

    <div v-if="showJoinByIdModal" class="modal-overlay" @click.self="showJoinByIdModal = false">
      <div class="modal create-modal">
        <h3>Join by Dgroup ID</h3>
        <p class="modal-desc">Ask your leader for their Dgroup ID code.</p>
        <div class="form-group">
          <label>Dgroup ID</label>
          <input v-model="dgroupIdInput" placeholder="e.g. DG-26-1234" />
        </div>
        <div v-if="joinStatus.msg" class="status-msg" :class="joinStatus.type">{{ joinStatus.msg }}</div>
        <div class="actions">
          <button @click="showJoinByIdModal = false" class="cancel">Cancel</button>
          <button @click="joinDgroupById" class="confirm">Join Group</button>
        </div>
      </div>
    </div>

    <div v-if="showPersonModal && selectedPerson" class="modal-overlay person-overlay" @click.self="showPersonModal = false">
      <div class="modal profile-modal">
        <button class="close-icon-btn" @click="showPersonModal = false"><X :size="24" /></button>
        <div class="profile-header">
          <div class="profile-avatar-lg">{{ selectedPerson.firstName.charAt(0) }}</div>
          <h3>{{ selectedPerson.firstName }} {{ selectedPerson.lastName }}</h3>
          <span class="role-badge">{{ selectedPerson.finalTags?.isDgroupLeader ? 'Leader' : 'Member' }}</span>
        </div>
        <div class="profile-details">
          <div class="detail-row"><span class="label">Life Stage</span><span class="value">{{ selectedPerson.finalTags?.ageCategory || 'N/A' }}</span></div>
          <div class="detail-row"><span class="label">Facebook</span><span class="value link-color">{{ selectedPerson.fbAccount || 'Not Linked' }}</span></div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dgroup-view { padding-top: 10px; font-family: 'Inter', sans-serif; }
.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

/* TABS & BADGES */
.tabs-container { display: flex; justify-content: center; margin-bottom: 24px; }
.tabs-segment { background: #F1F5F9; padding: 4px; border-radius: 12px; display: flex; gap: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); }
.tabs-segment button { border: none; background: transparent; padding: 8px 24px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #64748B; cursor: pointer; transition: all 0.2s ease; position: relative; }
.tabs-segment button.active { background: white; color: #0F172A; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.badge-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; background: #EF4444; border-radius: 50%; border: 2px solid white; }

/* PENDING BANNER */
.pending-banner { background: #FFF3E0; border: 1px solid #FFE0B2; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; color: #E65100; }
.pending-banner strong { display: block; font-size: 14px; }
.pending-banner p { margin: 0; font-size: 13px; opacity: 0.9; }

/* REQUESTS INBOX */
.requests-card { background: white; border-radius: 16px; border: 1px solid #FECACA; overflow: hidden; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.05); }
.alert-header { background: #FEF2F2; border-bottom: 1px solid #FECACA; color: #B91C1C; }
.requests-list { padding: 0; }
.request-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #F3F4F6; }
.req-name { display: block; font-weight: 600; color: #1F2937; }
.req-sub { font-size: 11px; color: #6B7280; }
.req-actions { display: flex; gap: 8px; }
.btn-approve { background: #DCFCE7; color: #166534; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
.btn-approve:hover { background: #BBF7D0; }
.btn-reject { background: #FEE2E2; color: #991B1B; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
.btn-reject:hover { background: #FECACA; }

/* HERO DETAILS */
.hero-details { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.detail-tag { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; text-transform: uppercase; }
.detail-tag.time { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); }
.detail-tag.interest { background: rgba(0,0,0,0.2); color: white; }

/* SEEKER FLOW MODAL */
.seeker-modal { max-width: 500px; width: 95%; max-height: 80vh; overflow-y: auto; }
.modal-header { margin-bottom: 20px; text-align: center; }
.modal-header h3 { margin: 0; color: #1E293B; font-size: 20px; }
.modal-header p { margin: 4px 0 0; color: #64748B; font-size: 14px; }

.pref-section { margin-bottom: 24px; }
.pref-section label { display: block; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 12px; }
.chip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
.chip-grid.small { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
.chip-btn { background: #F1F5F9; border: 1px solid #E2E8F0; padding: 10px; border-radius: 10px; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center; transition: all 0.2s; }
.chip-btn:hover { background: #E2E8F0; }
.chip-btn.selected { background: #E0F2FE; border-color: #0EA5E9; color: #0284C7; }

.rec-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.rec-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; display: flex; gap: 16px; align-items: center; }
.rec-score { background: #22C55E; color: white; font-weight: 800; font-size: 12px; padding: 4px 8px; border-radius: 8px; align-self: flex-start; }
.rec-info { flex: 1; }
.rec-info h4 { margin: 0; font-size: 16px; color: #1E293B; }
.rec-leader { margin: 2px 0 6px; font-size: 13px; color: #64748B; }
.rec-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.rec-tag-sm { background: white; border: 1px solid #E2E8F0; padding: 2px 6px; font-size: 10px; border-radius: 4px; color: #475569; }
.rec-meta { font-size: 11px; color: #94A3B8; margin-top: 4px; font-style: italic; }
.btn-join-sm { background: #0F172A; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
.btn-join-sm:hover { background: #334155; }
.btn-text { background: none; border: none; color: #64748B; font-weight: 600; cursor: pointer; text-decoration: underline; margin-bottom: 8px; font-size: 13px; }
.actions.column { flex-direction: column; gap: 8px; }

/* Existing Styles ... */
/* UPLINE LEADER CARD */
.leader-card-modern { background: #1976D2; border-radius: 16px; position: relative; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid #1565C0; cursor: pointer; transition: transform 0.2s; margin-bottom: 24px; }
.leader-card-modern:hover { transform: translateY(-2px); }
.leader-content-row { padding: 20px; display: flex; align-items: center; gap: 16px; }
.avatar-ring-large { width: 64px; height: 64px; border-radius: 50%; background: white; border: 3px solid #E3F2FD; display: flex; align-items: center; justify-content: center; }
.leader-info-modern { flex: 1; }
.label-modern { font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.8); font-weight: 700; display: block; margin-bottom: 4px; }
.leader-info-modern h3 { margin: 0; font-size: 18px; color: white; }

/* MEMBER LISTS */
.common-list-card { background: white; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
.list-header { padding: 16px 20px; background: #FAFAFA; border-bottom: 1px solid #F1F5F9; }
.list-header.row { display: flex; justify-content: space-between; align-items: center; }
.list-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: #475569; }
.list-header.label-only { font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; padding: 16px 20px; border-bottom: 1px solid #F1F5F9; }
.count-badge { background: #E2E8F0; color: #475569; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.count-badge.red { background: #FEE2E2; color: #DC2626; }
.list-item { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.15s; }
.list-item:hover { background: #F8FAFC; }
.avatar.sm { width: 36px; height: 36px; background: #F1F5F9; color: #64748B; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.avatar.md { width: 40px; height: 40px; background: #E3F2FD; color: #1565C0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.info-col { flex: 1; display: flex; flex-direction: column; }
.info-col .name { font-size: 14px; color: #334155; font-weight: 500; }
.info-col .status { font-size: 12px; color: #94A3B8; }
.btn-icon-danger { background: transparent; border: none; color: #CBD5E1; cursor: pointer; padding: 8px; border-radius: 8px; }
.btn-icon-danger:hover { background: #FEF2F2; color: #EF4444; }

/* DOWNLINE  */
.drill-header-enhanced { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid #E2E8F0; margin-bottom: 24px; position: relative; }
.header-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.group-title-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
.group-hero { display: flex; align-items: flex-start; gap: 20px; }
.hero-icon { width: 72px; height: 72px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #4F46E5, #818CF8); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); flex-shrink: 0; }
.hero-content { flex: 1; }
.hero-content h2 { margin: 0 0 10px 0; font-size: 24px; font-weight: 700; color: #1E293B; }
.hero-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
.info-badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
.id-badge { background: #F1F5F9; color: #475569; display: flex; align-items: center; gap: 6px; border: 1px solid #E2E8F0; cursor: pointer; }
.id-badge:hover { background: #E2E8F0; }
.age-badge { background: #F3E5F5; color: #7B1FA2; }
.capacity-sub { font-size: 12px; color: #94A3B8; margin: 0; display: flex; align-items: center; gap: 6px; }
.edit-icon-btn { position: absolute; top: 60px; right: 24px; background: white; border: 1px solid #E2E8F0; color: #64748B; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.edit-icon-btn:hover { background: #F8FAFC; color: #334155; border-color: #CBD5E1; }

/* MODALS */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal { background: white; width: 90%; max-width: 400px; padding: 24px; border-radius: 16px; position: relative; }
.create-modal { padding-top: 20px; }
.scrollable-modal { max-height: 80vh; overflow-y: auto; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: #546E7A; margin-bottom: 6px; }
.form-group input, .form-select { width: 100%; padding: 12px; border: 1px solid #CFD8DC; border-radius: 10px; box-sizing: border-box; font-size: 14px; background: white; }
.actions { display: flex; gap: 10px; margin-top: 24px; }
.actions button { flex: 1; padding: 12px; border-radius: 10px; font-weight: 600; cursor: pointer; border: none; font-size: 14px; }
.confirm { background: #1976D2; color: white; }
.cancel { background: #ECEFF1; color: #333; }
.empty-state-modern { text-align: center; padding: 48px 24px; background: #FAFAFA; border-radius: 16px; border: 1px dashed #E2E8F0; color: #64748B; }
.empty-icon { margin-bottom: 12px; color: #CBD5E1; }
.empty-list-msg { padding: 48px 20px; text-align: center; color: #94A3B8; font-size: 14px; font-family: 'Inter', sans-serif;font-style: italic;}
.seeker-prompt { background: white; padding: 30px 20px; border-radius: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 20px; }
.icon-circle { width: 60px; height: 60px; background: #E3F2FD; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.seeker-prompt h3 { margin: 0 0 8px; color: #1976D2; font-size: 20px; }
.seeker-prompt p { color: #546E7A; margin: 0 0 24px; font-size: 14px; }
.question-box { background: #F5F7FA; border-radius: 12px; padding: 20px; }
.question { font-weight: 700; font-size: 16px; margin-bottom: 16px; color: #37474F; }
.seeker-actions { display: flex; flex-direction: column; gap: 10px; }
.btn-action { padding: 12px; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; width: 100%; font-size: 14px; }
.btn-action.primary { background: #1976D2; color: white; }
.btn-action.secondary { background: white; border: 1px solid #CFD8DC; color: #37474F; }
.attendance-checklist-updated { flex: 1; overflow-y: auto; margin: 10px 0; padding-right: 4px; max-height: 40vh; }
.attendance-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #ECEFF1; }
.attendance-item .member-name { flex: 1; font-weight: 600; color: #37474F; font-size: 14px; }
.status-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #CFD8DC; font-size: 12px; font-weight: 700; color: #1976D2; background: white; }
.group-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; background: #F5F7FA; padding: 12px; border-radius: 12px; border: 1px solid #ECEFF1; }
.stat-input { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-input label { font-size: 10px; font-weight: 800; color: #78909C; text-transform: uppercase; text-align: center; }
.stat-input input { width: 100%; text-align: center; padding: 8px; border: 1px solid #CFD8DC; border-radius: 8px; font-size: 15px; font-weight: 700; }
.section-label { display: block; font-size: 11px; font-weight: 800; color: #90A4AE; text-transform: uppercase; margin: 15px 0 5px; border-bottom: 1px solid #ECEFF1; padding-bottom: 4px; }
.profile-modal { text-align: center; padding-top: 40px; }
.profile-header { margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; }
.profile-avatar-lg { width: 80px; height: 80px; background: #E3F2FD; color: #1565C0; font-size: 32px; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.role-badge { background: #FFF3E0; color: #F57C00; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; margin-top: 8px; }
.profile-details { text-align: left; background: #FAFAFA; border-radius: 12px; padding: 16px; }
.detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #EEE; }
.detail-row .label { color: #78909C; font-size: 13px; font-weight: 500; }
.detail-row .value { color: #37474F; font-size: 14px; font-weight: 600; }
.close-icon-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; color: #90A4AE; }
.link-color { color: #1976D2; text-decoration: underline; }
</style>