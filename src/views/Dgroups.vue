<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { 
  LayoutGrid, 
  Calendar, 
  Sparkles, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Copy,
  MoveRight
} from 'lucide-vue-next'

// Components
import DgroupWeeklyLogs from '../components/dgmComponents/DgroupWeeklyLogs.vue'
import DgroupMatchingSection from '../components/dgmComponents/DgroupMatchingSection.vue'
import MemberDetailsModal from '../components/dgmComponents/MemberDetailsModal.vue' 
import Modal from '../components/dgmComponents/Modal.vue'
import MemberCard from '../components/dgmComponents/MemberCard.vue'

import { useRoute } from 'vue-router'

// --- Stores ---
const membersStore = useMembersStore()
const { activeMembers, leaders, seekers } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore()
const { currentEventAttendees } = storeToRefs(attendanceStore)

// --- State ---
const currentTab = ref('directory') // 'directory', 'attendance', 'matching'
const searchQuery = ref('')
const expandedDgroups = ref([])

// Member Details Modal State
const showMemberModal = ref(false)
const selectedMember = ref(null)

// Move Member Modal State
const showMoveModal = ref(false)
const memberToMove = ref(null)
const newLeaderIdSelection = ref('')

// --- Computed: Present Members Set ---
const presentMemberIds = computed(() => {
  return new Set(currentEventAttendees.value.map(att => att.memberId))
})

// --- Computed: Grouping Logic ---
const sortedDgroups = computed(() => {
  const groups = {}
  
  leaders.value.forEach(leader => {
    const leaderFullName = `${leader.firstName} ${leader.lastName}`
    groups[leaderFullName] = {
      leaderId: leader.id,
      leaderName: leaderFullName,
      leaderFirstName: leader.firstName,
      leaderLastName: leader.lastName,
      leaderProfilePic: leader.profilePicture || leader.photoURL,
      dgroupName: leader.dgroupName || `${leader.firstName}'s Dgroup`,
      dgroupId: leader.dgroupId || 'No ID',
      leaderGender: leader.gender,
      capacity: leader.dgroupCapacity || 12,
      // Pulling prescriptive data for display
      meetingTime: leader.dgroupDetails?.meetingTime || 'Flexible',
      meetingDays: leader.dgroupDetails?.meetingDays || 'Flexible',
      interests: leader.dgroupDetails?.interests || [],
      members: [],
      isLeaderPresent: presentMemberIds.value.has(leader.id)
    }
  })

  // Add all active members to their respective groups
  activeMembers.value.forEach(member => {
    const leaderName = member.dgroupLeader
    if (leaderName && groups.hasOwnProperty(leaderName)) {
      groups[leaderName].members.push(member)
    }
  })

  return Object.values(groups)
})

// --- Computed: Functional Search ---
const searchedGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  
  // If no search query, return all groups
  if (!query) return sortedDgroups.value

  return sortedDgroups.value.filter(g => {
    // Check if group details match
    const matchLeader = g.leaderName.toLowerCase().includes(query) || 
                        g.dgroupName.toLowerCase().includes(query) ||
                        (g.dgroupId && g.dgroupId.toLowerCase().includes(query))
                        
    // Check if any member in the group matches
    const matchingMembers = g.members.filter(m => 
      m.firstName.toLowerCase().includes(query) || 
      m.lastName.toLowerCase().includes(query)
    )
    
    // If a member matched, auto-expand the group so the admin can see them
    if (matchLeader || matchingMembers.length > 0) {
      if (matchingMembers.length > 0 && !expandedDgroups.value.includes(g.leaderName)) {
        expandedDgroups.value.push(g.leaderName)
      }
      return true
    }
    
    return false
  })
})

const maleGroups = computed(() => searchedGroups.value.filter(g => g.leaderGender === 'Male'))
const femaleGroups = computed(() => searchedGroups.value.filter(g => g.leaderGender === 'Female'))

// --- Computed: Unmatched Seekers Count for Badge ---
const unmatchedSeekersCount = computed(() => seekers.value.length)

// --- Helper Data Maps & Colors ---
const INTEREST_MAP = {
  'music': 'Music', 'arts': 'Arts & Crafts', 'sports': 'Sports',
  'tech': 'Tech', 'photography': 'Photography', 'fitness': 'Fitness',
  'reading': 'Books/Reading', 'dancing': 'Dancing'
}

const INTEREST_COLORS = {
  'music': { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },       // Blue
  'arts': { color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },        // Pink
  'sports': { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },      // Amber
  'tech': { color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },        // Cyan
  'photography': { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }, // Red
  'fitness': { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },     // Emerald
  'reading': { color: '#7C3AED', bg: '#F5F3FF', border: '#EDE9FE' },     // Violet
  'dancing': { color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' }      // Rose
}

function getInterestLabel(id) {
  return INTEREST_MAP[id] || id;
}

function getInterestStyle(id) {
  const style = INTEREST_COLORS[id] || { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' }; // Default Blue
  return {
    backgroundColor: style.bg,
    color: style.color,
    borderColor: style.border,
    borderWidth: '1px',
    borderStyle: 'solid'
  }
}

// --- Functions ---

const route = useRoute()
onMounted(() => {
  if (route.query && route.query.tab) {
    currentTab.value = route.query.tab
  }
})

watch(() => route.query.tab, (newTab) => {
  if (newTab) currentTab.value = newTab
})

function toggleDgroup(leaderName) {
  const index = expandedDgroups.value.indexOf(leaderName)
  if (index > -1) expandedDgroups.value.splice(index, 1)
  else expandedDgroups.value.push(leaderName)
}

function copyId(id) {
  if (!id || id === 'No ID') return
  navigator.clipboard.writeText(id).then(() => {
    alert('Dgroup ID copied!')
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = id;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('Dgroup ID copied!')
  });
}

// --- Avatar Helper Functions ---
function getLeaderInitials(group) {
  if (!group.leaderFirstName) return '?'
  return group.leaderFirstName[0] + (group.leaderLastName?.[0] || '')
}

function getLeaderColor(group) {
   const colors = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'];
   let hash = 0;
   const str = group.leaderId || group.leaderName; 
   for (let i = 0; i < str.length; i++) {
     hash = str.charCodeAt(i) + ((hash << 5) - hash);
   }
   return colors[Math.abs(hash) % colors.length];
}

// --- Move Member Functions ---
const availableLeadersForMove = computed(() => {
  if (!memberToMove.value) return []
  return leaders.value.filter(l => {
     const lName = `${l.firstName} ${l.lastName}`
     return l.gender === memberToMove.value.gender && lName !== memberToMove.value.dgroupLeader
  })
})

function openMoveModal(member) {
  memberToMove.value = member
  newLeaderIdSelection.value = ''
  showMoveModal.value = true
}

function closeMoveModal() {
  showMoveModal.value = false
  memberToMove.value = null
  newLeaderIdSelection.value = ''
}

async function confirmMove() {
  if (!newLeaderIdSelection.value) {
     alert("Please select a new leader first.")
     return
  }
  try {
     await membersStore.assignDgroupLeader(memberToMove.value.id, newLeaderIdSelection.value)
     alert(`Successfully moved ${memberToMove.value.firstName} to a new Dgroup!`)
     closeMoveModal()
  } catch(e) {
     console.error(e)
     alert("Failed to move member.")
  }
}

// --- Member Details Functions ---
function openMemberDetails(member) {
  selectedMember.value = member
  showMemberModal.value = true
}

function handleMemberModalClose() {
  showMemberModal.value = false
  selectedMember.value = null
}

function handleSaveChanges(updatedMember) {
  membersStore.updateMember(updatedMember)
  showMemberModal.value = false
}

function handleArchiveMember(memberId) {
  membersStore.archiveMember(memberId)
  showMemberModal.value = false
}

function handleRestoreMember(memberId) {
  membersStore.restoreMember(memberId)
  showMemberModal.value = false
}
</script>

<template>
  <div class="dgroups-view-container">
    
    <!-- Top Navigation Tabs -->
    <div class="tabs-header">
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'directory' }"
        @click="currentTab = 'directory'"
      >
        <LayoutGrid :size="18" /> DGroups Directory
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'attendance' }"
        @click="currentTab = 'attendance'"
      >
        <Calendar :size="18" /> Attendance Logs
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'matching' }"
        @click="currentTab = 'matching'"
      >
        <Sparkles :size="18" /> Matching
        <span v-if="unmatchedSeekersCount > 0" class="tab-notification-badge">
          {{ unmatchedSeekersCount }}
        </span>
      </button>
    </div>

    <!-- TAB 1: DIRECTORY -->
    <div v-if="currentTab === 'directory'" class="tab-content">
      <div class="controls-bar">
        <div class="search-bar">
          <Search :size="20" class="search-icon" />
          <input type="text" placeholder="Search groups, leaders, or members..." v-model="searchQuery">
        </div>
      </div>

      <div class="dgroup-grid">
        <!-- Male Column -->
        <div class="grid-column">
          <h3 class="column-header male">Male DGroups ({{ maleGroups.length }})</h3>
          <div v-if="maleGroups.length === 0" class="empty-state">No groups found</div>
          
          <div 
            v-for="group in maleGroups" 
            :key="group.leaderName" 
            class="dgroup-card"
            :class="{ 
              'expanded': expandedDgroups.includes(group.leaderName),
              'is-present': group.isLeaderPresent,
              'is-absent': !group.isLeaderPresent
            }"
          >
            <div class="card-header" @click.self="toggleDgroup(group.leaderName)">
              
              <!-- Leader Avatar Section -->
              <div class="leader-avatar-container" @click="toggleDgroup(group.leaderName)">
                 <img 
                   v-if="group.leaderProfilePic" 
                   :src="group.leaderProfilePic" 
                   class="leader-img" 
                   alt="Leader"
                 />
                 <div v-else class="leader-initials" :style="{ backgroundColor: getLeaderColor(group) }">
                   {{ getLeaderInitials(group) }}
                 </div>
              </div>

              <div class="header-content" @click="toggleDgroup(group.leaderName)">
                <div class="group-title">
                  <h4>{{ group.leaderName }}</h4>
                </div>
                
                <div class="id-row">
                  <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                  <button class="icon-btn-small" @click.stop="copyId(group.dgroupId)" title="Copy ID">
                    <Copy :size="12" />
                  </button>
                  <span class="group-meta" style="margin-left: 8px;">
                    {{ group.members.length }} / {{ group.capacity }} Members
                  </span>
                </div>
                
                <!-- Schedule and Interests Tags -->
                <div class="dgroup-tags-container">
                  <div class="dgroup-tags-row" v-if="group.meetingTime">
                    <span class="d-tag schedule-tag">
                      <Calendar :size="12" /> {{ group.meetingDays }} • {{ group.meetingTime }}
                    </span>
                  </div>
                  <div class="dgroup-tags-row" v-if="group.interests && group.interests.length">
                    <span v-for="interest in group.interests" :key="interest" class="d-tag" :style="getInterestStyle(interest)">
                      #{{ getInterestLabel(interest) }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="header-actions">
                 <button class="icon-btn toggle-btn" @click.stop="toggleDgroup(group.leaderName)">
                    <ChevronUp v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
                    <ChevronDown v-else :size="20" />
                 </button>
              </div>
            </div>

            <div v-if="expandedDgroups.includes(group.leaderName)" class="card-body">
               <div v-if="group.members.length === 0" class="no-members">No members assigned.</div>
               <div class="members-list" v-else>
                  <div class="member-list-item-wrapper" v-for="member in group.members" :key="member.id">
                    <MemberCard 
                      :member="member" 
                      :isPresent="presentMemberIds.has(member.id)"
                      :hideDetails="true"
                      @click="openMemberDetails(member)"
                      style="flex: 1;"
                    />
                    <!-- Move Member Button -->
                    <button class="btn-move-member" @click.stop="openMoveModal(member)" title="Move to another Dgroup">
                      <MoveRight :size="16" />
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <!-- Female Column -->
        <div class="grid-column">
          <h3 class="column-header female">Female DGroups ({{ femaleGroups.length }})</h3>
          <div v-if="femaleGroups.length === 0" class="empty-state">No groups found</div>

          <div 
            v-for="group in femaleGroups" 
            :key="group.leaderName" 
            class="dgroup-card"
            :class="{ 
              'expanded': expandedDgroups.includes(group.leaderName),
              'is-present': group.isLeaderPresent,
              'is-absent': !group.isLeaderPresent
            }"
          >
            <div class="card-header" @click.self="toggleDgroup(group.leaderName)">
              
              <!-- Leader Avatar Section -->
              <div class="leader-avatar-container" @click="toggleDgroup(group.leaderName)">
                 <img 
                   v-if="group.leaderProfilePic" 
                   :src="group.leaderProfilePic" 
                   class="leader-img" 
                   alt="Leader"
                 />
                 <div v-else class="leader-initials" :style="{ backgroundColor: getLeaderColor(group) }">
                   {{ getLeaderInitials(group) }}
                 </div>
              </div>

              <div class="header-content" @click="toggleDgroup(group.leaderName)">
                <div class="group-title">
                  <h4>{{ group.leaderName }}</h4>
                </div>
                
                <div class="id-row">
                  <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                  <button class="icon-btn-small" @click.stop="copyId(group.dgroupId)" title="Copy ID">
                    <Copy :size="12" />
                  </button>
                  <span class="group-meta" style="margin-left: 8px;">
                    {{ group.members.length }} / {{ group.capacity }} Members
                  </span>
                </div>
                
                <!-- Schedule and Interests Tags -->
                <div class="dgroup-tags-container">
                  <div class="dgroup-tags-row" v-if="group.meetingTime">
                    <span class="d-tag schedule-tag">
                      <Calendar :size="12" /> {{ group.meetingDays }} • {{ group.meetingTime }}
                    </span>
                  </div>
                  <div class="dgroup-tags-row" v-if="group.interests && group.interests.length">
                    <span v-for="interest in group.interests" :key="interest" class="d-tag" :style="getInterestStyle(interest)">
                      #{{ getInterestLabel(interest) }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="header-actions">
                 <button class="icon-btn toggle-btn" @click.stop="toggleDgroup(group.leaderName)">
                    <ChevronUp v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
                    <ChevronDown v-else :size="20" />
                 </button>
              </div>
            </div>

            <div v-if="expandedDgroups.includes(group.leaderName)" class="card-body">
               <div v-if="group.members.length === 0" class="no-members">No members assigned.</div>
               <div class="members-list" v-else>
                  <div class="member-list-item-wrapper" v-for="member in group.members" :key="member.id">
                    <MemberCard 
                      :member="member" 
                      :isPresent="presentMemberIds.has(member.id)"
                      :hideDetails="true"
                      @click="openMemberDetails(member)"
                      style="flex: 1;"
                    />
                    <!-- Move Member Button -->
                    <button class="btn-move-member" @click.stop="openMoveModal(member)" title="Move to another Dgroup">
                      <MoveRight :size="16" />
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: ATTENDANCE LOGS -->
    <div v-if="currentTab === 'attendance'" class="tab-content">
      <DgroupWeeklyLogs />
    </div>

    <!-- TAB 3: MATCHING -->
    <div v-if="currentTab === 'matching'" class="tab-content">
       <DgroupMatchingSection />
    </div>

    <!-- Member Details Modal -->
    <Modal v-if="showMemberModal" @close="handleMemberModalClose"> 
      <MemberDetailsModal 
        v-if="selectedMember" 
        :member="selectedMember" 
        @close="handleMemberModalClose" 
        @saveChanges="handleSaveChanges" 
        @archiveMember="handleArchiveMember" 
        @restoreMember="handleRestoreMember" 
      />
    </Modal>

    <!-- Move Member Modal -->
    <Modal v-if="showMoveModal" @close="closeMoveModal">
      <div class="move-modal-container">
        <div class="move-modal-header">
          <h3>Move Member</h3>
          <button class="close-btn" @click="closeMoveModal"><X :size="20" /></button>
        </div>
        <div class="move-modal-body">
          <p class="move-subtitle">
            Select a new Dgroup Leader for <strong>{{ memberToMove?.firstName }} {{ memberToMove?.lastName }}</strong>.
          </p>
          <div class="form-group">
            <label>New Dgroup Leader</label>
            <select v-model="newLeaderIdSelection" class="modern-select">
              <option disabled value="">-- Select a new leader --</option>
              <option v-for="l in availableLeadersForMove" :key="l.id" :value="l.id">
                {{ l.firstName }} {{ l.lastName }} ({{ l.dgroupName || "Dgroup" }}) - {{ l.dgroupCapacity - membersStore.activeMembers.filter(m => m.dgroupLeaderId === l.id).length }} slots left
              </option>
            </select>
          </div>
        </div>
        <div class="move-modal-actions">
           <button class="btn-cancel" @click="closeMoveModal">Cancel</button>
           <button class="btn-save" @click="confirmMove">Confirm Move</button>
        </div>
      </div>
    </Modal>

  </div>
</template>

<style scoped>
.dgroups-view-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* --- TABS --- */
.tabs-header {
  display: flex;
  gap: 12px;
  border-bottom: 2px solid #ECEFF1;
  margin-bottom: 20px;
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 15px;
  font-weight: 600;
  color: #546E7A;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative; /* For badge positioning if needed */
}

.tab-btn:hover {
  color: #1976D2;
  background-color: #F5F7FA;
}

.tab-btn.active {
  color: #1976D2;
  border-bottom-color: #1976D2;
}

/* RED DOT BADGE FOR TABS */
.tab-notification-badge {
  background-color: #D32F2F;
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 0 4px;
}

/* --- TAB CONTENT --- */
.tab-content {
  flex: 1;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- DIRECTORY STYLES --- */
.controls-bar {
  margin-bottom: 20px;
}
.search-bar {
  position: relative;
  width: 100%;
  max-width: 380px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #90A4AE;
}
.search-bar input {
  width: 100%;
  padding: 10px 10px 10px 40px;
  border: 1px solid #CFD8DC;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.dgroup-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 900px) {
  .dgroup-grid { grid-template-columns: 1fr 1fr; align-items: start; }
}

.column-header {
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #eee;
}
.column-header.male { color: #1565C0; border-color: #1565C0; }
.column-header.female { color: #E91E63; border-color: #E91E63; }

.empty-state {
  text-align: center;
  color: #90A4AE;
  font-style: italic;
  padding: 20px;
  background: #FAFAFA;
  border-radius: 8px;
}

/* --- CARD STYLES --- */
.dgroup-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 16px;
  transition: all 0.2s ease;
  border: 1px solid #ECEFF1;
  border-left: 6px solid #B0BEC5; /* Default Neutral */
}

/* ATTENDANCE INDICATORS */
.dgroup-card.is-present { border-left-color: #4CAF50; } /* Green */
.dgroup-card.is-absent { border-left-color: #F44336; }  /* Red */


.dgroup-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.card-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start; /* Changed to start for tags */
  cursor: pointer;
  gap: 12px; /* Gap between avatar and content */
}

/* NEW AVATAR STYLES */
.leader-avatar-container {
  flex-shrink: 0;
}
.leader-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #ECEFF1;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.leader-initials {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #455A64;
  font-size: 16px;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-title h4 {
  margin: 0;
  font-size: 17px;
  color: #263238;
  font-weight: 700;
}

/* ID ROW */
.id-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dgroup-id {
  font-size: 12px;
  color: #455A64;
  font-family: monospace;
  background: #F5F7F9;
  padding: 2px 6px;
  border-radius: 4px;
}

.icon-btn-small {
  background: none;
  border: none;
  cursor: pointer;
  color: #546E7A;
  padding: 2px;
  display: flex;
  align-items: center;
}
.icon-btn-small:hover { color: #1976D2; }

.group-meta {
  font-size: 12px;
  color: #546E7A;
  font-weight: 600;
}

/* TAG STYLES FOR CARD HEADER */
.dgroup-tags-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.dgroup-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.d-tag {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.schedule-tag { background: #F8FAFC; color: #475569; border: 1px solid #E2E8F0; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #546E7A;
  cursor: pointer;
  transition: background 0.2s;
}

.icon-btn:hover { background-color: #ECEFF1; color: #263238; }

.card-body {
  border-top: 1px solid #ECEFF1;
  padding: 12px;
  background: #FAFAFA;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-members {
  text-align: center;
  color: #78909C;
  font-size: 13px;
  padding: 12px;
}

/* MOVE MEMBER BUTTON & WRAPPER */
.member-list-item-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.btn-move-member {
  background: #FFFFFF;
  color: #546E7A;
  border: 1px solid #CFD8DC;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.btn-move-member:hover {
  background: #1976D2;
  color: white;
  border-color: #1976D2;
}

/* MOVE MODAL CSS */
.move-modal-container {
  padding: 24px;
}
.move-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.move-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #263238;
}
.close-btn {
  background: none;
  border: none;
  color: #90A4AE;
  cursor: pointer;
}
.move-subtitle {
  font-size: 14px;
  color: #546E7A;
  margin-bottom: 24px;
}
.form-group {
  margin-bottom: 24px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #455A64;
  font-size: 13px;
}
.modern-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #B0BEC5;
  border-radius: 8px;
  font-size: 14px;
  color: #263238;
  outline: none;
  box-sizing: border-box;
}
.modern-select:focus {
  border-color: #1976D2;
}
.move-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
}
.btn-cancel {
  background: #F5F7FA;
  border: 1px solid #CFD8DC;
  color: #546E7A;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-cancel:hover { background: #ECEFF1; }
.btn-save {
  background: #1976D2;
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-save:hover { background: #1565C0; }
</style>