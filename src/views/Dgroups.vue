<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { 
  LayoutGrid, 
  Calendar, 
  Sparkles, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Edit3,
  Copy
} from 'lucide-vue-next'

// Components
import DgroupWeeklyLogs from '../components/dgmComponents/DgroupWeeklyLogs.vue'
import DgroupMatchingSection from '../components/dgmComponents/DgroupMatchingSection.vue'
import DGroupEditModal from '../components/dgmComponents/DGroupEditModal.vue'
import MemberDetailsModal from '../components/dgmComponents/MemberDetailsModal.vue' // Added import
import Modal from '../components/dgmComponents/Modal.vue'
import MemberCard from '../components/dgmComponents/MemberCard.vue'

// --- Stores ---
const membersStore = useMembersStore()
const { activeMembers, leaders, seekers } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore()
const { currentEventAttendees } = storeToRefs(attendanceStore)

// --- State ---
const currentTab = ref('directory') // 'directory', 'attendance', 'matching'
const searchQuery = ref('')
const expandedDgroups = ref([])
const showEditModal = ref(false)
const selectedDgroupForEdit = ref(null)

// Member Details Modal State
const showMemberModal = ref(false)
const selectedMember = ref(null)

// --- Computed: Present Members Set ---
const presentMemberIds = computed(() => {
  return new Set(currentEventAttendees.value.map(att => att.memberId))
})

// --- Computed: Filtered Members for Directory ---
const filteredMembers = computed(() => {
  let list = activeMembers.value
  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(member => 
      member.firstName.toLowerCase().includes(query) ||
      member.lastName.toLowerCase().includes(query)
    )
  }
  return list
})

// --- Computed: Grouping Logic ---
const sortedDgroups = computed(() => {
  const groups = {}
  
  leaders.value.forEach(leader => {
    const leaderFullName = `${leader.firstName} ${leader.lastName}`
    groups[leaderFullName] = {
      leaderId: leader.id,
      leaderName: leaderFullName,
      dgroupName: leader.dgroupName || `${leader.firstName}'s Dgroup`,
      dgroupId: leader.dgroupId || 'No ID',
      leaderGender: leader.gender,
      capacity: leader.dgroupCapacity || 12,
      members: [],
      isLeaderPresent: presentMemberIds.value.has(leader.id)
    }
  })

  filteredMembers.value.forEach(member => {
    const leaderName = member.dgroupLeader
    if (leaderName && groups.hasOwnProperty(leaderName)) {
      groups[leaderName].members.push(member)
    }
  })

  return Object.values(groups)
})

const maleGroups = computed(() => sortedDgroups.value.filter(g => g.leaderGender === 'Male'))
const femaleGroups = computed(() => sortedDgroups.value.filter(g => g.leaderGender === 'Female'))

// --- Computed: Unmatched Seekers Count for Badge ---
const unmatchedSeekersCount = computed(() => seekers.value.length)

// --- Functions ---
function toggleDgroup(leaderName) {
  const index = expandedDgroups.value.indexOf(leaderName)
  if (index > -1) expandedDgroups.value.splice(index, 1)
  else expandedDgroups.value.push(leaderName)
}

function openEditModal(group) {
  selectedDgroupForEdit.value = group
  showEditModal.value = true
}

function handleEditClose() {
  showEditModal.value = false
  selectedDgroupForEdit.value = null
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

// Member Details Functions
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
          <input type="text" placeholder="Search members or leaders..." v-model="searchQuery">
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
              <div class="header-content" @click="toggleDgroup(group.leaderName)">
                <div class="group-title">
                  <h4>{{ group.leaderName }}</h4>
                </div>
                
                <div class="id-row">
                  <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                  <button class="icon-btn-small" @click.stop="copyId(group.dgroupId)" title="Copy ID">
                    <Copy :size="12" />
                  </button>
                </div>
                
                <div class="group-meta">
                  Members: {{ group.members.length }} / {{ group.capacity }}
                </div>
              </div>
              
              <div class="header-actions">
                 <button class="icon-btn edit-btn" @click.stop="openEditModal(group)" title="Manage Group">
                    <Edit3 :size="16" />
                 </button>
                 <button class="icon-btn toggle-btn" @click.stop="toggleDgroup(group.leaderName)">
                    <ChevronDown v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
                    <ChevronRight v-else :size="20" />
                 </button>
              </div>
            </div>

            <div v-if="expandedDgroups.includes(group.leaderName)" class="card-body">
               <div v-if="group.members.length === 0" class="no-members">No members assigned.</div>
               <div class="members-list" v-else>
                  <MemberCard 
                    v-for="member in group.members" 
                    :key="member.id" 
                    :member="member" 
                    :isPresent="presentMemberIds.has(member.id)"
                    :hideDetails="true"
                    @click="openMemberDetails(member)"
                  />
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
              <div class="header-content" @click="toggleDgroup(group.leaderName)">
                <div class="group-title">
                  <h4>{{ group.leaderName }}</h4>
                </div>
                
                <div class="id-row">
                  <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                  <button class="icon-btn-small" @click.stop="copyId(group.dgroupId)" title="Copy ID">
                    <Copy :size="12" />
                  </button>
                </div>
                
                <div class="group-meta">
                  Members: {{ group.members.length }} / {{ group.capacity }}
                </div>
              </div>
              
              <div class="header-actions">
                 <button class="icon-btn edit-btn" @click.stop="openEditModal(group)" title="Manage Group">
                    <Edit3 :size="16" />
                 </button>
                 <button class="icon-btn toggle-btn" @click.stop="toggleDgroup(group.leaderName)">
                    <ChevronDown v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
                    <ChevronRight v-else :size="20" />
                 </button>
              </div>
            </div>

            <div v-if="expandedDgroups.includes(group.leaderName)" class="card-body">
               <div v-if="group.members.length === 0" class="no-members">No members assigned.</div>
               <div class="members-list" v-else>
                  <MemberCard 
                    v-for="member in group.members" 
                    :key="member.id" 
                    :member="member" 
                    :isPresent="presentMemberIds.has(member.id)"
                    :hideDetails="true"
                    @click="openMemberDetails(member)"
                  />
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

    <!-- Manage DGroup Modal -->
    <Modal v-if="showEditModal" @close="handleEditClose">
       <DGroupEditModal 
          v-if="selectedDgroupForEdit" 
          :group="selectedDgroupForEdit" 
          @close="handleEditClose" 
       />
    </Modal>

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

  </div>
</template>

<style scoped>
/* Same styles as previous */
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
  max-width: 400px;
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
  border-left: 4px solid #B0BEC5; /* Default Neutral */
}

/* ATTENDANCE INDICATORS */
.dgroup-card.is-present { border-left-color: #4CAF50; } /* Green */
.dgroup-card.is-absent { border-left-color: #F44336; }  /* Red */


.dgroup-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-top-color: #B0BEC5;
  border-right-color: #B0BEC5;
  border-bottom-color: #B0BEC5;
}

.card-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
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
  color: #78909C;
  font-family: monospace;
  background: #F5F7F9;
  padding: 2px 6px;
  border-radius: 4px;
}

.icon-btn-small {
  background: none;
  border: none;
  cursor: pointer;
  color: #90A4AE;
  padding: 2px;
  display: flex;
  align-items: center;
}
.icon-btn-small:hover { color: #1976D2; }


.group-meta {
  margin-top: 4px;
  font-size: 13px;
  color: #546E7A;
  font-weight: 500;
}

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
  color: #78909C;
  cursor: pointer;
  transition: background 0.2s;
}

.icon-btn:hover { background-color: #ECEFF1; color: #455A64; }
.edit-btn:hover { background-color: #E3F2FD; color: #1565C0; }

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
  color: #90A4AE;
  font-size: 13px;
  padding: 12px;
}
</style>