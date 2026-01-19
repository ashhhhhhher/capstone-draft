<script setup>
import { ref, computed } from 'vue'
import { Search, List, LayoutGrid, SlidersHorizontal, Archive, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { useEventsStore } from '../stores/events' 
import MemberCard from '../components/dgmComponents/MemberCard.vue'
import MemberDetailsModal from '../components/dgmComponents/MemberDetailsModal.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import FilterModal from '../components/dgmComponents/FilterModal.vue'
import AbsenceMonitoring from '../components/dgmComponents/AbsenceMonitoring.vue' 

// --- Store Setup ---
const membersStore = useMembersStore()
const { activeMembers, archivedMembers, leaders } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore()
const { currentEventAttendees, allAttendance } = storeToRefs(attendanceStore)
const eventsStore = useEventsStore()
const { allEvents } = storeToRefs(eventsStore)

// --- Page State ---
const viewMode = ref('list')
const showArchived = ref(false) 
const showMemberModal = ref(false)
const selectedMember = ref(null)
const expandedDgroups = ref([])
const searchQuery = ref('') 
const showFilterModal = ref(false)
const showAbsenceMonitoringModal = ref(false)

const filters = ref({
  attendance: [],
  age: [],
  type: [],
  ministries: []
})

// --- Computed Properties ---
const activeFilterCount = computed(() => {
  return filters.value.attendance.length +
         filters.value.age.length +
         filters.value.type.length +
         filters.value.ministries.length
})

const presentMemberIds = computed(() => {
  return new Set(currentEventAttendees.value.map(att => att.memberId))
})

// --- Main Filter Logic ---
const filteredMembers = computed(() => {
  let list = showArchived.value ? archivedMembers.value : activeMembers.value

  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(member => 
      member.firstName.toLowerCase().includes(query) ||
      member.lastName.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    )
  }

  // Note: Attendance filter removed from here because we split by column now, 
  // but if user explicitly filters "Present Only" in modal, we should respect it.
  if (filters.value.attendance.length > 0) {
    list = list.filter(m => {
      const isPresent = presentMemberIds.value.has(m.id)
      return (filters.value.attendance.includes('present') && isPresent) ||
             (filters.value.attendance.includes('absent') && !isPresent)
    })
  }
  if (filters.value.age.length > 0) {
    list = list.filter(m => filters.value.age.includes(m.finalTags.ageCategory))
  }
  if (filters.value.type.includes('leader')) {
    list = list.filter(m => m.finalTags.isDgroupLeader)
  }
  if (filters.value.type.includes('regular')) {
    list = list.filter(m => m.finalTags.isRegular)
  }
  if (filters.value.type.includes('firstTimer')) {
    list = list.filter(m => m.finalTags.isFirstTimer)
  }
  if (filters.value.type.includes('volunteer')) {
    list = list.filter(m => m.finalTags.isVolunteer)
  }
  if (filters.value.ministries.length > 0) {
    list = list.filter(m => 
      m.finalTags.isVolunteer &&
      m.finalTags.volunteerMinistry.some(v => filters.value.ministries.includes(v))
    )
  }
  
  // Sort Alphabetically by FIRST Name
  list.sort((a, b) => a.firstName.localeCompare(b.firstName))
  
  return list
})

// Split filtered list into Present and Absent for the columns
const presentList = computed(() => {
  return filteredMembers.value.filter(m => presentMemberIds.value.has(m.id))
})

const absentList = computed(() => {
  return filteredMembers.value.filter(m => !presentMemberIds.value.has(m.id))
})

// --- Grouping Logic for Dgroup View ---
const sortedDgroups = computed(() => {
  const sourceList = showArchived.value ? archivedMembers.value : activeMembers.value;

  const groups = {}
  
  // Initialize groups from known Leaders
  leaders.value.forEach(leader => {
    const leaderFullName = `${leader.firstName} ${leader.lastName}`;
    groups[leaderFullName] = {
      leaderName: leaderFullName,
      dgroupName: leader.dgroupName || `${leader.firstName}'s Dgroup`,
      dgroupId: leader.dgroupId || 'No ID',
      leaderGender: leader.gender,
      capacity: leader.dgroupCapacity || 12,
      members: [],
      isLeaderPresent: presentMemberIds.value.has(leader.id)
    }
  })
  
  // Handle Unassigned
  groups['Unassigned'] = {
    leaderName: 'Unassigned',
    dgroupName: 'No Dgroup',
    dgroupId: null,
    leaderGender: 'Mixed',
    capacity: 0,
    members: [],
    isLeaderPresent: false
  }

  // Distribute members
  sourceList.forEach(member => {
    const leaderName = member.dgroupLeader
    if (leaderName && groups.hasOwnProperty(leaderName)) {
      groups[leaderName].members.push(member)
    } else if (!leaderName) {
      // Don't put leaders in unassigned if they lead their own group
      if (!member.finalTags.isDgroupLeader) {
         groups['Unassigned'].members.push(member)
      }
    }
  })
  
  if(groups['Unassigned'].members.length === 0) {
    delete groups['Unassigned']
  }
  
  return Object.values(groups);
})

// Split groups into two columns based on Leader Gender
const maleGroups = computed(() => {
  return sortedDgroups.value.filter(g => g.leaderGender === 'Male' && g.leaderName !== 'Unassigned')
})

const femaleGroups = computed(() => {
  return sortedDgroups.value.filter(g => g.leaderGender === 'Female' && g.leaderName !== 'Unassigned')
})

const unassignedGroups = computed(() => {
  return sortedDgroups.value.filter(g => g.leaderName === 'Unassigned')
})

// --- Functions ---
function openMemberDetails(member) {
  selectedMember.value = member
  showMemberModal.value = true
}

function handleSaveChanges(updatedMember) {
  membersStore.updateMember(updatedMember)
  showMemberModal.value = false
  searchQuery.value = '' 
}

function handleArchiveMember(memberId) {
  membersStore.archiveMember(memberId)
  showMemberModal.value = false 
  searchQuery.value = ''
}

function handleRestoreMember(memberId) {
  membersStore.restoreMember(memberId)
  showMemberModal.value = false
  searchQuery.value = ''
}

function handleModalClose() {
    showMemberModal.value = false;
    searchQuery.value = ''; 
}

function toggleDgroup(leaderName) {
  const index = expandedDgroups.value.indexOf(leaderName)
  if (index > -1) {
    expandedDgroups.value.splice(index, 1)
  } else {
    expandedDgroups.value.push(leaderName)
  }
}

function getDgroupAttendance(leaderMembers) {
  let presentCount = 0
  for (const member of leaderMembers) {
    if (presentMemberIds.value.has(member.id)) {
      presentCount++
    }
  }
  const totalCount = leaderMembers.length
  return `${presentCount}/${totalCount} Present`
}

function openAbsenceMonitoring() {
  showAbsenceMonitoringModal.value = true
}

// --- Absence count ---
const todayISO = () => new Date().toISOString().split('T')[0]
function getPastServices() {
  const today = todayISO()
  return allEvents.value
    .filter(e => e.eventType === 'service' && e.date <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}
function computeConsecutiveAbsences(member, past) {
  let count = 0
  for (const ev of past) {
    const attended = allAttendance.value
      ? allAttendance.value.some(a => a.eventId === ev.id && a.memberId === member.id)
      : false
    if (!attended) count++
    else break
  }
  return count
}
const absenceCount = computed(() => {
  const past = getPastServices()
  if (!past || past.length === 0) return 0
  return activeMembers.value
    .map(m => computeConsecutiveAbsences(m, past))
    .filter(c => c >= 3).length
})

</script>

<template>
  <div class="members-container">
    <div class="members-header">
      <h1>{{ showArchived ? 'Archived Members' : 'Members Directory' }}</h1>
      
      <div class="header-actions">
        <button class="archive-toggle-btn" @click="showArchived = !showArchived">
          <Archive :size="18" />
          <span>{{ showArchived ? 'View Active' : 'View Archived' }}</span>
        </button>

        <button class="absence-btn" @click="openAbsenceMonitoring" title="Open Absence Monitoring">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 10h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 14h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Absence Monitoring</span>
          <span v-if="absenceCount > 0" class="absence-notif">{{ absenceCount }}</span>
        </button>
      </div>
    </div>

    <div class="controls-wrapper">
      <div class="search-bar">
        <Search :size="20" class="search-icon" />
        <input 
          type="text" 
          placeholder="Search by name or email..."
          v-model="searchQuery"
          autocomplete="off" 
        >
      </div>
      
      <div class="view-toggle">
        <button 
          :class="{ active: viewMode === 'list' }" 
          @click="viewMode = 'list'"
        >
          <List :size="16" /> List
        </button>
        <button 
          :class="{ active: viewMode === 'dgroup' }"
          @click="viewMode = 'dgroup'"
        >
          <LayoutGrid :size="16" /> Dgroup
        </button>
      </div>
    </div>
    
    <div class="filter-controls" v-if="viewMode === 'list'">
      <button class="filter-btn" @click="showFilterModal = true">
        <SlidersHorizontal :size="16" />
        <span>Filters</span>
        <span v-if="activeFilterCount > 0" class="filter-badge">
          {{ activeFilterCount }}
        </span>
      </button>
    </div>
    
    <!-- LIST VIEW (Split Present / Absent) -->
    <div class="member-list-view" v-if="viewMode === 'list'">
      <div class="columns-grid">
        
        <!-- Present Column -->
        <div class="column-block">
          <h3 class="column-title present-header">
            Present ({{ presentList.length }})
          </h3>
          <div class="list-content">
            <MemberCard 
              v-for="member in presentList" 
              :key="member.id"
              :member="member"
              :isPresent="true"
              @click="openMemberDetails(member)"
            />
            <div v-if="presentList.length === 0" class="empty-col">
              No present members found.
            </div>
          </div>
        </div>

        <!-- Absent Column -->
        <div class="column-block">
          <h3 class="column-title absent-header">
            Absent ({{ absentList.length }})
          </h3>
          <div class="list-content">
            <MemberCard 
              v-for="member in absentList" 
              :key="member.id"
              :member="member"
              :isPresent="false"
              @click="openMemberDetails(member)"
            />
            <div v-if="absentList.length === 0" class="empty-col">
              No absent members found.
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- DGROUP VIEW (Split Columns) -->
    <div class="dgroup-view" v-if="viewMode === 'dgroup'">
      
      <div class="columns-grid">
        <!-- Male Column -->
        <div class="column-block">
          <h3 class="column-title male">Male Dgroups</h3>
          <div v-if="maleGroups.length === 0" class="empty-col">No Male Groups</div>
          <div 
            v-for="group in maleGroups" 
            :key="group.leaderName" 
            class="dgroup-card"
            :class="{
              'is-present': group.isLeaderPresent,
              'is-absent': !group.isLeaderPresent
            }"
          >
            <div class="dgroup-header" @click="toggleDgroup(group.leaderName)">
              <div class="header-info">
                <h3 class="dgroup-name">{{ group.dgroupName }}</h3>
                <span class="leader-sub">Lead: {{ group.leaderName }}</span>
                <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                <div class="dgroup-stats">
                  <span>{{ getDgroupAttendance(group.members) }}</span>
                  <span class="divider-dot">•</span>
                  <span>{{ group.members.length }} / {{ group.capacity }} Members</span>
                </div>
              </div>
              <ChevronDown v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
              <ChevronRight v-else :size="20" />
            </div>
            
            <div v-if="expandedDgroups.includes(group.leaderName)" class="dgroup-member-list">
              <MemberCard 
                v-for="member in group.members" 
                :key="member.id"
                :member="member"
                :isPresent="presentMemberIds.has(member.id)"
                @click="openMemberDetails(member)"
              />
              <p v-if="group.members.length === 0" class="no-members-text">
                No members assigned yet.
              </p>
            </div>
          </div>
        </div>

        <!-- Female Column -->
        <div class="column-block">
          <h3 class="column-title female">Female Dgroups</h3>
          <div v-if="femaleGroups.length === 0" class="empty-col">No Female Groups</div>
          <div 
            v-for="group in femaleGroups" 
            :key="group.leaderName" 
            class="dgroup-card"
            :class="{
              'is-present': group.isLeaderPresent,
              'is-absent': !group.isLeaderPresent
            }"
          >
            <div class="dgroup-header" @click="toggleDgroup(group.leaderName)">
              <div class="header-info">
                <h3 class="dgroup-name">{{ group.dgroupName }}</h3>
                <span class="leader-sub">Lead: {{ group.leaderName }}</span>
                <span class="dgroup-id">ID: {{ group.dgroupId }}</span>
                <div class="dgroup-stats">
                  <span>{{ getDgroupAttendance(group.members) }}</span>
                  <span class="divider-dot">•</span>
                  <span>{{ group.members.length }} / {{ group.capacity }} Members</span>
                </div>
              </div>
              <ChevronDown v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
              <ChevronRight v-else :size="20" />
            </div>
            
            <div v-if="expandedDgroups.includes(group.leaderName)" class="dgroup-member-list">
              <MemberCard 
                v-for="member in group.members" 
                :key="member.id"
                :member="member"
                :isPresent="presentMemberIds.has(member.id)"
                @click="openMemberDetails(member)"
              />
              <p v-if="group.members.length === 0" class="no-members-text">
                No members assigned yet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Unassigned (Full Width) -->
      <div v-if="unassignedGroups.length > 0" class="unassigned-block">
        <h3 class="column-title">Unassigned Members</h3>
        <div 
            v-for="group in unassignedGroups" 
            :key="group.leaderName" 
            class="dgroup-card unassigned-card"
          >
            <div class="dgroup-header" @click="toggleDgroup(group.leaderName)">
              <div class="header-info">
                <h3 class="dgroup-name">Unassigned Members</h3>
                <span class="dgroup-stats">
                  {{ group.members.length }} Members needing a group
                </span>
              </div>
              <ChevronDown v-if="expandedDgroups.includes(group.leaderName)" :size="20" />
              <ChevronRight v-else :size="20" />
            </div>
            
            <div v-if="expandedDgroups.includes(group.leaderName)" class="dgroup-member-list">
              <MemberCard 
                v-for="member in group.members" 
                :key="member.id"
                :member="member"
                :isPresent="presentMemberIds.has(member.id)"
                @click="openMemberDetails(member)"
              />
            </div>
          </div>
      </div>

    </div>

  </div>
  
  <Modal v-if="showMemberModal" @close="handleModalClose"> 
    <MemberDetailsModal 
      v-if="selectedMember"
      :member="selectedMember" 
      @close="handleModalClose" 
      @saveChanges="handleSaveChanges"
      @archiveMember="handleArchiveMember"
      @restoreMember="handleRestoreMember"
    />
  </Modal>

  <Modal v-if="showFilterModal" @close="showFilterModal = false">
    <FilterModal 
      v-model="filters"
      @apply="showFilterModal = false"
      @clear="showFilterModal = false"
    />
  </Modal>

  <Modal v-if="showAbsenceMonitoringModal" @close="showAbsenceMonitoringModal = false" size="xl">
    <div class="absence-modal-wrapper">
      <header class="absence-modal-header">
        <h3>Consecutive Absences</h3>
        <p class="absence-subtext">Monitor members with 3, 4 and 5+ consecutive missed gatherings.</p>
      </header>
      <div class="absence-modal-body">
        <AbsenceMonitoring />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.members-container {
  padding: 20px;
}
.members-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.members-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}
.archive-toggle-btn {
  background-color: #fff;
  border: 1px solid #546E7A;
  color: #546E7A;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}
.archive-toggle-btn:hover {
  background-color: #ECEFF1;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.absence-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(21, 101, 192, 0.08);
  background: #fff;
  color: #0D47A1;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.12s ease, transform 0.12s ease;
}
.absence-btn svg { color: #D32F2F; }
.absence-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.absence-btn { position: relative; }
.absence-notif {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #D32F2F;
  color: #fff;
  font-size: 11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  box-shadow: 0 4px 10px rgba(0,0,0,0.12);
}

.controls-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}
.search-bar {
  flex-grow: 1;
  position: relative;
}
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #90A4AE;
}
.search-bar input {
  width: 100%;
  padding: 12px 12px 12px 44px;
  border-radius: 8px;
  border: 1px solid #B0BEC5;
  font-size: 16px;
  box-sizing: border-box;
}
.view-toggle {
  display: flex;
  background-color: #CFD8DC;
  border-radius: 8px;
  padding: 4px;
}
.view-toggle button {
  background: none;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #546E7A;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.view-toggle button.active {
  background-color: #fff;
  color: #1976D2;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.filter-controls {
  margin-bottom: 24px;
}
.filter-btn {
  background-color: #fff;
  border: 1px solid #B0BEC5;
  color: #37474F;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
}
.filter-badge {
  background-color: #1976D2;
  color: white;
  font-size: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
}

/* --- Common Grid Layout for Columns --- */
.member-list-view, .dgroup-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.columns-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 900px) {
  .columns-grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.column-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.column-title {
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-bottom: 8px;
  border-bottom: 2px solid #EEE;
  margin: 0;
}
.column-title.male { color: #1565C0; border-color: #1565C0; }
.column-title.female { color: #E91E63; border-color: #E91E63; }
.column-title.present-header { color: #2E7D32; border-color: #2E7D32; }
.column-title.absent-header { color: #C62828; border-color: #C62828; }

.list-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-col {
  text-align: center;
  color: #B0BEC5;
  font-style: italic;
  padding: 20px;
  background: #FAFAFA;
  border-radius: 12px;
}

/* Dgroup Specific Styles */
.dgroup-card {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border-left: 4px solid #CFD8DC;
}
.dgroup-card.is-present {
  border-left-color: #4CAF50;
}
.dgroup-card.is-absent {
  border-left-color: #F44336;
}
.unassigned-card {
  border-left-color: #FFC107;
}

.dgroup-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  cursor: pointer;
}
.dgroup-header:hover {
  background-color: #f9f9f9;
}
.dgroup-name {
  margin: 0 0 4px 0;
  font-size: 17px;
  font-weight: 700;
  color: #37474F;
}
.leader-sub {
  display: block;
  font-size: 13px;
  color: #546E7A;
  margin-bottom: 2px;
}
.dgroup-id {
  display: block;
  font-size: 11px;
  color: #78909C;
  font-family: monospace;
  margin-bottom: 6px;
}
.dgroup-stats {
  font-size: 12px;
  color: #78909C;
  font-weight: 600;
  display: flex;
  gap: 6px;
}
.divider-dot { color: #B0BEC5; }

.dgroup-member-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px 16px;
  border-top: 1px solid #ECEFF1;
}
.no-members-text {
  font-size: 14px;
  color: #78909C;
  text-align: center;
  padding: 12px;
}

.unassigned-block {
  margin-top: 20px;
}

/* Modal header/body inside Members view */
.absence-modal-wrapper { display:flex; flex-direction:column; gap:12px; height:100%; }
.absence-modal-header { padding: 8px 4px; border-bottom: 1px solid #F1F3F5; }
.absence-modal-header h3 { margin:0; color:#D32F2F; font-size:18px; }
.absence-subtext { margin:6px 0 0 0; color:#546E7A; font-size:13px; }
.absence-modal-body { padding-top:12px; overflow:auto; }
</style>