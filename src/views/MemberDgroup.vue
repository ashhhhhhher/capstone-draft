<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { useRoute } from 'vue-router'
import DgroupAbsenceMonitoring from '../components/memberComponents/DgroupAbsenceMonitoring.vue'
import FindADgroup from '../components/memberComponents/FindADgroup.vue'
import { 
  User, Users, ChevronRight, X, UserMinus, HelpCircle, 
  Pencil, ClipboardCheck, Copy, Calendar as CalendarIcon, ArrowLeft,
  Music, BookOpen, Heart, Activity, Palette, Clock, CheckCircle,
  Trophy, Laptop, Camera, Dumbbell, Sparkles, School, GraduationCap, Briefcase
} from 'lucide-vue-next'
import DgroupOverview from '../components/memberComponents/DgroupOverview.vue' 

const authStore = useAuthStore()
const membersStore = useMembersStore()
const attendanceStore = useAttendanceStore()
const route = useRoute()

const activeTab = ref('upline') 
const showPersonModal = ref(false)
const showJoinByIdModal = ref(false)
const showEditGroupModal = ref(false)
const showSeekerFlowModal = ref(false)

// Constants shared with FindADgroup
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

const LIFE_STAGE_OPTIONS = [
  { id: 'high-school', label: 'High School', icon: School, color: '#F59E0B' },
  { id: 'college', label: 'College/University', icon: GraduationCap, color: '#3B82F6' },
  { id: 'professional', label: 'Young Professional', icon: Briefcase, color: '#10B981' }
]

const TIME_OPTIONS = [
  '8:00 AM - 10:00 AM', '10:00 AM - 12:00 PM', '1:00 PM - 3:00 PM', 
  '3:00 PM - 5:00 PM', '5:00 PM - 7:00 PM', 'Anytime'
]

const DAY_OPTIONS = ['Weekdays', 'Weekends', 'Flexible']

// Edit Group Logic
const editGroupForm = reactive({
  dgroupName: '',
  capacity: 12,
  interests: [],
  meetingTime: 'Anytime',
  meetingDays: 'Flexible',
  lifeStage: ''
})

const dgroupIdInput = ref('')
const joinStatus = ref({ type: '', msg: '' })
const selectedPerson = ref(null) 

onMounted(() => {
  membersStore.fetchMembers()
  checkTabQuery()
})

watch(() => route.query.tab, () => {
  checkTabQuery()
})

function checkTabQuery() {
  if (route.query.tab === 'downline') activeTab.value = 'downline'
  else if (route.query.tab === 'upline') activeTab.value = 'upline'
}

const myProfile = computed(() => authStore.userProfile)
const isLeader = computed(() => myProfile.value?.finalTags?.isDgroupLeader)
const rawLeaderName = computed(() => myProfile.value?.dgroupLeader)

const myLeaderName = computed(() => {
  const leader = rawLeaderName.value
  if (!leader || leader === 'N/A (D-Lead)' || leader === 'N/A (First Timer)') return null
  return leader
})

const myName = computed(() => myProfile.value ? `${myProfile.value.firstName} ${myProfile.value.lastName}` : '')

const myPendingRequests = computed(() => {
  if (!isLeader.value || !myProfile.value) return []
  return membersStore.activeMembers.filter(m => 
    m.joinRequest && m.joinRequest.leaderId === myProfile.value.id && m.joinRequest.status === 'pending'
  )
})

const mySentRequest = computed(() => {
  if (myProfile.value?.joinRequest?.status === 'pending') return myProfile.value.joinRequest
  return null
})

const showSeekerQuestionnaire = computed(() => {
  if (!myProfile.value) return false
  const p = myProfile.value
  if (p.finalTags.isDgroupLeader || p.dgroupLeader || mySentRequest.value) return false
  return true
})

const myLeaderObject = computed(() => {
  if (!myLeaderName.value) return null
  return membersStore.activeMembers.find(m => `${m.firstName} ${m.lastName}` === myLeaderName.value)
})

// MODIFIED: Now includes the current user
const myUplineGroup = computed(() => {
  if (!myLeaderName.value) return []
  // removed the check !== myProfile.id so user sees themselves in the list
  return membersStore.activeMembers.filter(m => m.dgroupLeader === myLeaderName.value)
})

// ADDED: Computed property for Upline Group Details (Member View)
const myMemberGroupDetails = computed(() => {
  if (!myLeaderObject.value) return null
  const leader = myLeaderObject.value
  return {
    dgroupId: leader.dgroupId || 'No ID',
    name: leader.dgroupName || `${leader.firstName}'s Dgroup`,
    leaderName: `${leader.firstName} ${leader.lastName}`,
    capacity: leader.dgroupCapacity || 12,
    interests: leader.dgroupDetails?.interests || [],
    meetingTime: leader.dgroupDetails?.meetingTime || 'Anytime',
    meetingDays: leader.dgroupDetails?.meetingDays || 'Flexible',
    lifeStage: leader.finalTags?.ageCategory || 'professional'
  }
})

const primaryDownlineGroup = computed(() => {
  if (!isLeader.value) return null
  const members = membersStore.activeMembers.filter(m => m.dgroupLeader === myName.value)
  return {
    id: myProfile.value.dgroupId || 'g-default',
    dgroupId: myProfile.value.dgroupId || 'No ID',
    name: myProfile.value.dgroupName || `${myProfile.value?.firstName}'s Dgroup`,
    members: members,
    capacity: myProfile.value?.dgroupCapacity || 12,
    interests: myProfile.value?.dgroupDetails?.interests || [],
    meetingTime: myProfile.value?.dgroupDetails?.meetingTime || 'Anytime',
    meetingDays: myProfile.value?.dgroupDetails?.meetingDays || 'Flexible',
    lifeStage: myProfile.value?.finalTags?.ageCategory || 'professional'
  }
})

function viewPerson(person) {
  if(!person) return
  selectedPerson.value = person
  showPersonModal.value = true
}

function removeMember(member) {
  if(confirm(`Are you sure you want to remove ${member.firstName}?`)) {
    membersStore.removeDgroupMember(member.id).catch(() => alert("Error removing member"))
  }
}

function copyId(id) {
  if(!id || id === 'No ID') return
  navigator.clipboard.writeText(id).then(() => alert('Dgroup ID copied!'))
}

function openEditGroupModal() {
  if (!myProfile.value) return
  editGroupForm.dgroupName = myProfile.value.dgroupName || ''
  editGroupForm.capacity = myProfile.value.dgroupCapacity || 12
  editGroupForm.interests = myProfile.value.dgroupDetails?.interests || []
  editGroupForm.meetingTime = myProfile.value.dgroupDetails?.meetingTime || 'Anytime'
  editGroupForm.meetingDays = myProfile.value.dgroupDetails?.meetingDays || 'Flexible'
  editGroupForm.lifeStage = myProfile.value.finalTags?.ageCategory || 'professional'
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
      finalTags: { ...myProfile.value.finalTags, ageCategory: editGroupForm.lifeStage },
      dgroupDetails: {
        interests: editGroupForm.interests,
        meetingTime: editGroupForm.meetingTime,
        meetingDays: editGroupForm.meetingDays
      }
    })
    showEditGroupModal.value = false
    alert("Group details updated!")
  } catch (e) { alert("Failed to save.") }
}

async function handleLeaderResponse(req, action) {
  if (confirm(`Are you sure you want to ${action} ${req.firstName}?`)) {
    await membersStore.respondToJoinRequest(req.id, action)
  }
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

// Helpers for Profile Modal
function getMinistry(person) {
  if (!person || !person.finalTags) return 'Unknown'
  const ageCat = person.finalTags.ageCategory
  if (ageCat === 'professional') return 'B1G'
  if (ageCat === 'college' || ageCat === 'high-school') return 'ELEVATE'
  return 'B1G' // Default fallback
}

function formatBirthday(dateString) {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    // Month Day only (e.g. February 17)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  } catch (e) {
    return dateString
  }
}

function calculateAge(birthday) {
  if (!birthday) return ''
  const birthDate = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function isPersonLeader(person) {
    return person?.finalTags?.isDgroupLeader === true
}
</script>

<template>
  <div class="dgroup-view">
    
    <!-- PENDING REQUEST STATUS (Modern Design) -->
    <div v-if="mySentRequest" class="pending-status-banner fade-in">
       <div class="banner-glass">
         <div class="icon-ring">
           <Clock :size="28" color="#3B82F6" stroke-width="2.5" />
         </div>
         <div class="banner-text">
           <span class="status-label">Awaiting Approval</span>
           <h3>Waiting for <span class="highlight-blue">{{ mySentRequest.leaderName }}</span></h3>
           <p>Your request to join their Dgroup is being reviewed. Check back later!</p>
         </div>
       </div>
    </div>

    <!-- MAIN DASHBOARD CONTENT -->
    <div v-if="showSeekerQuestionnaire" class="seeker-prompt">
      <DgroupOverview />
      <div class="icon-circle"><HelpCircle :size="32" color="#3B82F6" /></div>
      <h3>Want to join a Dgroup?</h3>
      <p>Connect with a small group of friends to grow together.</p>
      <div class="question-box">
        <div class="seeker-actions">
          <button class="btn-action primary" @click="showSeekerFlowModal = true">Find a Dgroup</button>
          <button class="btn-action secondary" @click="showJoinByIdModal = true">Join by ID</button>
        </div>
      </div>
    </div>

    <div v-else>
      <!-- TABS AT THE TOP -->
      <div class="tabs-container">
        <div class="tabs-segment">
            <button :class="{ active: activeTab === 'upline' }" @click="activeTab = 'upline'">UPLINE</button>
            <button v-if="isLeader" :class="{ active: activeTab === 'downline' }" @click="activeTab = 'downline'">
                DOWNLINE
                <span v-if="myPendingRequests.length" class="badge-dot"></span>
            </button>
        </div>
      </div>

      <!-- TAB: UPLINE -->
      <div v-if="activeTab === 'upline'" class="tab-content fade-in">
        
        <!-- EMPTY STATE -->
        <div v-if="!myLeaderName" class="empty-state-card">
          <div class="empty-icon-ring"><UserMinus :size="40" color="#94A3B8" /></div>
          <h3>Not Assigned Yet</h3>
          <p>You haven't been assigned to a Dgroup yet. Use the "Find a Dgroup" button above if you haven't already.</p>
        </div>

        <!-- UPLINE CONTENT (Mirrored from Downline) -->
        <div v-else-if="myMemberGroupDetails">
          
          <!-- Group Card (Read Only) -->
          <div class="drill-header-enhanced">
            <div class="header-top-row">
              <div class="group-title-label">My Dgroup</div>
            </div>
            <div class="group-hero">
                <div class="hero-icon"><Users :size="32" color="white" /></div>
                <div class="hero-content">
                    <h2>{{ myMemberGroupDetails.name }}</h2>
                    <div class="hero-badges">
                         <div class="info-badge id-badge" @click="copyId(myMemberGroupDetails.dgroupId)">
                             ID: {{ myMemberGroupDetails.dgroupId }} <Copy :size="12" />
                         </div>
                         <div class="info-badge lifestage-badge">
                           {{ LIFE_STAGE_OPTIONS.find(o => o.id === myMemberGroupDetails.lifeStage)?.label || 'Professional' }}
                         </div>
                    </div>
                    <div class="hero-details">
                       <div class="detail-tag time">
                          <Clock :size="10" /> {{ myMemberGroupDetails.meetingTime }} • {{ myMemberGroupDetails.meetingDays }}
                       </div>
                       <!-- Removed Leader Tag Here -->
                       <div class="detail-tag interest" v-for="tag in myMemberGroupDetails.interests" :key="tag">
                         #{{ INTEREST_OPTIONS.find(o => o.id === tag)?.label || tag }}
                       </div>
                    </div>
                    <p class="capacity-sub"><Users :size="12" /> {{ myUplineGroup.length }} / {{ myMemberGroupDetails.capacity }} Members</p>
                </div>
            </div>
          </div>

          <!-- Dgroup Leader Section (Separate List Item) -->
          <div class="common-list-card" style="margin-bottom: 24px;">
            <div class="list-header row">
                <h4>Dgroup Leader</h4>
            </div>
            <div v-if="myLeaderObject" class="list-item" @click="viewPerson(myLeaderObject)">
              <div class="avatar-sm" style="background: #FFF7ED; color: #F97316;">{{ myLeaderObject.firstName.charAt(0) }}</div>
              <div class="info-col">
                 <span class="name">
                   {{ myLeaderObject.firstName }} {{ myLeaderObject.lastName }}
                 </span>
                 <span class="status" style="color: #F97316; font-weight: 700;">LEADER</span>
              </div>
              <ChevronRight :size="20" color="#CBD5E1" />
            </div>
          </div>

          <!-- Members List (Includes Self) -->
          <div class="common-list-card">
            <div class="list-header row">
                <h4>Members List</h4>
                <span class="count-badge">{{ myUplineGroup.length }}</span>
            </div>
            <div v-for="member in myUplineGroup" :key="member.id" class="list-item" @click="viewPerson(member)">
              <div class="avatar-sm">{{ member.firstName.charAt(0) }}</div>
              <div class="info-col">
                 <span class="name">
                   {{ member.firstName }} {{ member.lastName }}
                   <span v-if="member.id === myProfile.id" class="you-tag">(You)</span>
                 </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- TAB: DOWNLINE -->
      <div v-if="activeTab === 'downline'" class="tab-content fade-in">
        
        <!-- Waitlist Section -->
        <div v-if="myPendingRequests.length > 0" class="requests-card-clean">
           <div class="req-header-group">
              <div class="req-header-title">Waitlist & Requests</div>
              <div class="req-header-badge">{{ myPendingRequests.length }}</div>
           </div>
           
           <div class="requests-list-clean">
              <div v-for="(req, index) in myPendingRequests" :key="req.id" class="req-item-clean">
                 <div class="req-main-info">
                    <span class="req-name-clean">{{ req.firstName }} {{ req.lastName }}</span>
                    <span class="req-sub-info">
                      Requested: {{ new Date(req.joinRequest.requestedAt).toLocaleDateString() }}
                      <span class="bullet">•</span>
                      {{ getMinistry(req) }}
                      <span v-if="req.birthday" class="bullet">•</span>
                      <span v-if="req.birthday">{{ calculateAge(req.birthday) }} yrs old</span>
                    </span>
                 </div>
                 <div class="req-actions-clean">
                    <button class="btn-req-action approve" @click="handleLeaderResponse(req, 'approve')">
                        <CheckCircle :size="18" stroke-width="2.5" />
                    </button>
                    <button class="btn-req-action reject" @click="handleLeaderResponse(req, 'reject')">
                        <X :size="18" stroke-width="2.5" />
                    </button>
                 </div>
              </div>
           </div>
        </div>

        <div v-if="primaryDownlineGroup" class="drill-down-view">
          <div class="drill-header-enhanced">
            <div class="header-top-row">
              <div class="group-title-label">Your Group</div>
            </div>
            <div class="group-hero">
                <div class="hero-icon"><Users :size="32" color="white" /></div>
                <div class="hero-content">
                    <h2>{{ primaryDownlineGroup.name }}</h2>
                    <div class="hero-badges">
                         <div class="info-badge id-badge" @click="copyId(primaryDownlineGroup.dgroupId)">
                             ID: {{ primaryDownlineGroup.dgroupId }} <Copy :size="12" />
                         </div>
                         <div class="info-badge lifestage-badge">
                           {{ LIFE_STAGE_OPTIONS.find(o => o.id === primaryDownlineGroup.lifeStage)?.label || 'Professional' }}
                         </div>
                    </div>
                    <div class="hero-details">
                       <div class="detail-tag time">
                          <Clock :size="10" /> {{ primaryDownlineGroup.meetingTime }} • {{ primaryDownlineGroup.meetingDays }}
                       </div>
                       <div class="detail-tag interest" v-for="tag in primaryDownlineGroup.interests" :key="tag">
                         #{{ INTEREST_OPTIONS.find(o => o.id === tag)?.label || tag }}
                       </div>
                    </div>
                    <p class="capacity-sub"><Users :size="12" /> {{ primaryDownlineGroup.members.length }} / {{ primaryDownlineGroup.capacity }} Members</p>
                </div>
                <button class="edit-icon-btn" @click="openEditGroupModal"><Pencil :size="16" /></button>
            </div>
          </div>

          <div class="common-list-card">
            <div class="list-header label-only">Members List</div>
            <div v-for="m in primaryDownlineGroup.members" :key="m.id" class="list-item" @click="viewPerson(m)">
              <div class="avatar-md">{{ m.firstName.charAt(0) }}</div>
              <div class="info-col">
                <span class="name">{{ m.firstName }} {{ m.lastName }}</span>
                <span class="status">{{ m.status || 'Active' }}</span>
              </div>
              <button class="btn-icon-danger" @click.stop="removeMember(m)"><UserMinus :size="18" /></button>
            </div>
            <!-- Empty List Message (Centered) -->
            <div v-if="primaryDownlineGroup.members.length === 0" class="empty-list-msg-centered">
                No members yet.
            </div>
          </div>
          <div style="margin-top:24px"><DgroupAbsenceMonitoring /></div>
        </div>
      </div>
    </div>

    <!-- MODERN EDIT GROUP MODAL -->
    <div v-if="showEditGroupModal" class="modal-overlay" @click.self="showEditGroupModal = false">
      <div class="modal edit-modal fade-in">
        <div class="modal-header-clean">
          <h3>Edit Group Details</h3>
          <button class="close-x" @click="showEditGroupModal = false"><X :size="20" /></button>
        </div>
        
        <div class="edit-scroll-body">
          <div class="form-section">
            <label>Group Name</label>
            <input v-model="editGroupForm.dgroupName" class="modern-input" />
          </div>

          <div class="form-section">
            <label>Capacity</label>
            <input type="number" v-model="editGroupForm.capacity" class="modern-input" />
          </div>

          <div class="form-section">
            <label>Life Stage</label>
            <div class="selector-grid">
              <button v-for="opt in LIFE_STAGE_OPTIONS" :key="opt.id" 
                class="selector-btn" :class="{ selected: editGroupForm.lifeStage === opt.id }"
                @click="editGroupForm.lifeStage = opt.id">
                <component :is="opt.icon" :size="14" /> {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="form-section">
            <label>Meeting Schedule</label>
            <div class="flex-row-gap">
              <select v-model="editGroupForm.meetingTime" class="modern-select">
                <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
              </select>
              <select v-model="editGroupForm.meetingDays" class="modern-select">
                <option v-for="d in DAY_OPTIONS" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </div>

          <div class="form-section">
            <label>Group Interests</label>
            <div class="interest-chips">
              <button v-for="opt in INTEREST_OPTIONS" :key="opt.id" 
                class="interest-chip" :class="{ selected: editGroupForm.interests.includes(opt.id) }"
                @click="toggleEditInterest(opt.id)">
                <component :is="opt.icon" :size="12" /> {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer-sticky">
          <button @click="showEditGroupModal = false" class="btn-cancel">Cancel</button>
          <button @click="saveGroupDetails" class="btn-save">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- MODAL COMPONENTS -->
    <FindADgroup :isOpen="showSeekerFlowModal" @close="showSeekerFlowModal = false" />
    
    <!-- Profile Modal -->
    <div v-if="showPersonModal && selectedPerson" class="modal-overlay" @click.self="showPersonModal = false">
       <div class="modal profile-card-modern">
          <button class="close-x-absolute" @click="showPersonModal = false">
             <X :size="24" />
          </button>

          <div class="profile-main-column">
             <div class="avatar-ring-profile-lg">
                {{ selectedPerson.firstName.charAt(0) }}
             </div>
             <h3>{{ selectedPerson.firstName }} {{ selectedPerson.lastName }}</h3>
             
             <!-- Tag Logic: LEADER or MEMBER -->
             <div class="role-pill" :class="isPersonLeader(selectedPerson) ? 'is-leader' : 'is-member'">
                 {{ isPersonLeader(selectedPerson) ? 'LEADER' : 'MEMBER' }}
             </div>
          </div>

          <div class="profile-details-list">
             <div class="detail-row-clean">
                <span class="d-label">Life Stage</span>
                <span class="d-value">{{ getMinistry(selectedPerson) }}</span>
             </div>
             <div class="detail-row-clean">
                <span class="d-label">Birthday</span>
                <span class="d-value" v-if="selectedPerson.birthday">{{ formatBirthday(selectedPerson.birthday) }}</span>
                <span class="d-value" v-else>--</span>
             </div>
          </div>
       </div>
    </div>

    <!-- Join ID Modal -->
    <div v-if="showJoinByIdModal" class="modal-overlay" @click.self="showJoinByIdModal = false">
      <div class="modal join-id-modal">
        <h3>Join by ID</h3>
        <input v-model="dgroupIdInput" placeholder="Enter Dgroup ID" class="modern-input" />
        <div class="status-msg" v-if="joinStatus.msg" :class="joinStatus.type">{{ joinStatus.msg }}</div>
        <div class="modal-footer">
          <button @click="showJoinByIdModal = false">Cancel</button>
          <button class="btn-primary" @click="joinDgroupById">Join</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dgroup-view { padding: 16px; max-width: 900px; margin: 0 auto; position: relative; }

/* PENDING STATUS BANNER */
.pending-status-banner { margin-bottom: 32px; }
.banner-glass { background: linear-gradient(135deg, #ffffff, #f0f7ff); border: 2px solid #e0f2fe; border-radius: 28px; padding: 32px; display: flex; align-items: center; gap: 28px; box-shadow: 0 15px 35px -5px rgba(59, 130, 246, 0.1); position: relative; overflow: hidden; }
.banner-glass::before { content: ''; position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%); }
.icon-ring { width: 72px; height: 72px; background: #ffffff; border-radius: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12); border: 1.5px solid #f1f5f9; }
.banner-text .status-label { display: inline-block; font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
.banner-text h3 { margin: 0 0 6px; font-size: 22px; font-weight: 900; color: #0f172a; }
.highlight-blue { color: #2563eb; }
.banner-text p { font-size: 14px; color: #64748b; margin: 0; font-weight: 500; line-height: 1.5; }

/* TABS */
.tabs-container { display: flex; justify-content: center; margin-bottom: 24px; }
.tabs-segment { background: #F1F5F9; padding: 4px; border-radius: 14px; display: flex; gap: 4px; border: 1px solid #E2E8F0; }
.tabs-segment button { border: none; background: transparent; padding: 8px 24px; border-radius: 11px; font-size: 13px; font-weight: 800; color: #64748B; cursor: pointer; transition: all 0.2s; }
.tabs-segment button.active { background: white; color: #3B82F6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.badge-dot { position: absolute; width: 8px; height: 8px; background: #EF4444; border-radius: 50%; border: 2px solid white; transform: translate(4px, -4px); }

/* LEADER CARD */
.leader-card-modern { background: white; border: 2px solid #EFF6FF; border-radius: 20px; padding: 20px; cursor: pointer; transition: all 0.2s; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.04); }
.leader-card-modern:hover { transform: translateY(-2px); border-color: #3B82F6; }
.leader-content-row { display: flex; align-items: center; gap: 16px; }
.avatar-ring-large { width: 56px; height: 56px; background: #EFF6FF; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #DBEAFE; }
.leader-info-modern { flex: 1; }
.label-modern { font-size: 11px; font-weight: 800; color: #3B82F6; text-transform: uppercase; margin-bottom: 2px; display: block; }
.leader-info-modern h3 { margin: 0; font-size: 18px; font-weight: 900; color: #0F172A; }

/* EMPTY STATE CARD */
.empty-state-card { background: #FFFFFF; border: 2px dashed #E2E8F0; border-radius: 32px; padding: 56px 32px; text-align: center; color: #64748B; margin-bottom: 24px; }
.empty-icon-ring { width: 88px; height: 88px; background: #F8FAFC; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 2px solid #F1F5F9; }
.empty-state-card h3 { margin: 0 0 10px; font-size: 22px; font-weight: 900; color: #1E293B; }
.empty-state-card p { font-size: 15px; line-height: 1.6; max-width: 360px; margin: 0 auto; font-weight: 500; }

/* DOWNLINE HEADER */
.drill-header-enhanced { background: #FFFFFF; border-radius: 24px; padding: 28px; border: 2px solid #F1F5F9; margin-bottom: 24px; position: relative; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.03); }
.header-top-row { margin-bottom: 12px; }
.group-title-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
.group-hero { display: flex; align-items: flex-start; gap: 24px; }
.hero-icon { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, #3B82F6, #2563EB); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2); }
.hero-content { flex: 1; }
.hero-content h2 { margin: 0 0 8px; font-size: 24px; font-weight: 900; color: #0F172A; }
.hero-badges { display: flex; gap: 8px; margin-bottom: 12px; }
.info-badge { font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 8px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
.id-badge { background: #F8FAFC; border: 1.5px solid #F1F5F9; color: #64748B; cursor: pointer; }
.id-badge:hover { background: #F1F5F9; color: #0F172A; }
.lifestage-badge { background: #EFF6FF; color: #3B82F6; }
.hero-details { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.detail-tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; display: flex; align-items: center; gap: 6px; }
.detail-tag.time { background: #F8FAFC; color: #475569; }
.detail-tag.interest { background: #EC489915; color: #DB2777; }
.detail-tag.leader-tag { background: #F0F9FF; color: #0284C7; } /* Special tag for leader in group card */
.capacity-sub { font-size: 12px; color: #94A3B8; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 6px; }
.edit-icon-btn { position: absolute; top: 28px; right: 28px; width: 40px; height: 40px; border-radius: 12px; border: 1.5px solid #F1F5F9; background: white; color: #64748B; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.edit-icon-btn:hover { border-color: #3B82F6; color: #3B82F6; transform: rotate(15deg); }

/* LIST CARDS */
.common-list-card { background: white; border: 2px solid #F1F5F9; border-radius: 24px; overflow: hidden; }
.list-header { padding: 16px 24px; background: #F8FAFC; border-bottom: 1.5px solid #F1F5F9; font-size: 14px; font-weight: 800; color: #64748B; text-transform: uppercase; }
.list-item { display: flex; align-items: center; padding: 14px 24px; border-bottom: 1px solid #F8FAFC; cursor: pointer; transition: background 0.15s; }
.list-item:hover { background: #F8FAFC; }
.avatar-sm { width: 36px; height: 36px; border-radius: 50%; background: #EFF6FF; color: #3B82F6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
.avatar-md { width: 44px; height: 44px; border-radius: 14px; background: #F1F5F9; color: #64748B; display: flex; align-items: center; justify-content: center; font-weight: 800; }
.info-col { flex: 1; margin-left: 12px; }
.info-col .name { display: block; font-size: 15px; font-weight: 700; color: #0F172A; }
.info-col .status { font-size: 12px; color: #94A3B8; font-weight: 500; }
.you-tag { font-size: 12px; color: #3B82F6; font-weight: 700; margin-left: 4px; }
.btn-icon-danger { width: 32px; height: 32px; border: none; background: transparent; color: #CBD5E1; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
.btn-icon-danger:hover { background: #FEE2E2; color: #EF4444; }

/* === WAITLIST SECTION STYLING === */
.requests-card-clean {
    background: #FFFAFA; /* Very light reddish tint or white */
    border: 1px solid #FECACA; /* Light Red Border */
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
}
.req-header-group {
    margin-bottom: 20px;
}
.req-header-title {
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 6px;
}
.req-header-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #FEE2E2;
    color: #EF4444;
    font-size: 12px;
    font-weight: 700;
    height: 24px;
    min-width: 24px;
    padding: 0 6px;
    border-radius: 12px;
}
.requests-list-clean {
    display: flex;
    flex-direction: column;
    gap: 0;
}
.req-item-clean {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid #FEE2E2;
}
.req-item-clean:first-child {
    border-top: none;
    padding-top: 0;
}
.req-main-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.req-name-clean {
    font-size: 16px;
    font-weight: 700;
    color: #0F172A;
}
.req-sub-info {
    font-size: 13px;
    color: #64748B;
    display: flex;
    align-items: center;
    gap: 6px;
}
.bullet {
    color: #CBD5E1;
    font-size: 10px;
}
.req-actions-clean {
    display: flex;
    gap: 12px;
}
.btn-req-action {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}
.btn-req-action.approve {
    background: #DCFCE7;
    color: #16A34A;
}
.btn-req-action.approve:hover {
    background: #BBF7D0;
}
.btn-req-action.reject {
    background: #FEE2E2;
    color: #DC2626;
}
.btn-req-action.reject:hover {
    background: #FECACA;
}

/* === EMPTY LIST MSG (CENTERED) === */
.empty-list-msg-centered {
    padding: 32px;
    text-align: center;
    color: #94A3B8;
    font-size: 14px;
    font-weight: 500;
    width: 100%;
    display: block;
}

/* SEEKER PROMPT */
.seeker-prompt { background: white; border-radius: 24px; padding: 40px; text-align: center; border: 2px solid #EFF6FF; margin-top: 20px; }
.question-box { background: #F8FAFC; border-radius: 20px; padding: 24px; margin-top: 24px; }
.btn-action { padding: 16px; border-radius: 18px; font-weight: 800; border: none; cursor: pointer; font-size: 15px; width: 100%; transition: all 0.2s; }
.btn-action.primary { background: #3B82F6; color: white; margin-bottom: 12px; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2); }
.btn-action.secondary { background: #FFFFFF; color: #475569; border: 2px solid #E2E8F0; }

/* MODALS */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.modal { background: white; width: 95%; max-width: 500px; border-radius: 28px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); }
.modal-header-clean { padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #F1F5F9; }
.modal-header-clean h3 { margin: 0; font-size: 20px; font-weight: 900; }
.close-x { background: none; border: none; cursor: pointer; color: #94A3B8; }
.edit-scroll-body { padding: 28px; overflow-y: auto; max-height: 60vh; }
.form-section { margin-bottom: 24px; }
.form-section label { display: block; font-size: 12px; font-weight: 800; color: #3B82F6; text-transform: uppercase; margin-bottom: 10px; }
.modern-input { width: 100%; padding: 14px; border: 2px solid #F1F5F9; border-radius: 16px; font-size: 15px; font-weight: 600; outline: none; transition: border-color 0.2s; }
.modern-input:focus { border-color: #3B82F6; }
.modern-select { flex: 1; padding: 14px; border: 2px solid #F1F5F9; border-radius: 16px; font-size: 14px; font-weight: 600; }
.flex-row-gap { display: flex; gap: 10px; }
.selector-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.selector-btn { padding: 12px 8px; border: 2.3px solid #F1F5F9; border-radius: 14px; background: white; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; }
.selector-btn.selected { border-color: #3B82F6; background: #EFF6FF; color: #3B82F6; }
.interest-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.interest-chip { padding: 8px 14px; border: 1.5px solid #F1F5F9; border-radius: 12px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.interest-chip.selected { border-color: #3B82F6; background: #3B82F6; color: white; }
.modal-footer-sticky { padding: 20px 28px; background: #F8FAFC; display: flex; gap: 12px; }
.modal-footer-sticky button { flex: 1; padding: 14px; border-radius: 16px; font-weight: 800; cursor: pointer; border: none; font-size: 14px; }
.btn-save { background: #3B82F6; color: white; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
.btn-cancel { background: white; border: 2px solid #F1F5F9; color: #64748B; }

.fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* JOIN BY ID SPECIFICS */
.join-id-modal { padding: 32px; }
.join-id-modal h3 { margin: 0 0 16px; font-size: 20px; font-weight: 900; }
.status-msg { margin-top: 12px; font-size: 12px; font-weight: 700; padding: 8px; border-radius: 8px; }
.status-msg.error { background: #fee2e2; color: #ef4444; }
.status-msg.success { background: #dcfce7; color: #166534; }
.modal-footer { display: flex; gap: 12px; margin-top: 24px; }
.modal-footer button { flex: 1; padding: 12px; border-radius: 14px; font-weight: 800; border: none; cursor: pointer; font-size: 14px; }
.btn-primary { background: #3B82F6; color: white; }

/* === PROFILE CARD (MODERN) - MATCHING PHOTO === */
.profile-card-modern {
    position: relative;
    padding: 40px 32px 32px;
    background: white;
    max-width: 420px;
    border-radius: 16px;
}
.close-x-absolute {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: #94A3B8;
    cursor: pointer;
}
.profile-main-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
}
.avatar-ring-profile-lg {
    width: 90px;
    height: 90px;
    background: #f0f9ff;
    color: #0284c7;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
    border: 3px solid white;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}
.profile-main-column h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    color: #0F172A;
}
.role-pill {
    font-size: 11px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.role-pill.is-leader {
    background: #FFF7ED;
    color: #F97316; /* Orange like photo */
}
.role-pill.is-member {
    background: #F1F5F9;
    color: #64748B;
}

.profile-details-list {
    background: #F8FAFC;
    border-radius: 12px;
    padding: 8px 16px;
}
.detail-row-clean {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #E2E8F0;
}
.detail-row-clean:last-child {
    border-bottom: none;
}
.d-label {
    font-size: 14px;
    color: #94A3B8;
    font-weight: 500;
}
.d-value {
    font-size: 14px;
    color: #334155;
    font-weight: 700;
}
</style>