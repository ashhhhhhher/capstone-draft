<script setup>
import { ref, computed } from 'vue'
import { Search, List, LayoutGrid, SlidersHorizontal, Archive } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import MemberCard from '../components/MemberCard.vue'
import MemberDetailsModal from '../components/MemberDetailsModal.vue'
import Modal from '../components/Modal.vue'
import FilterModal from '../components/FilterModal.vue'

// --- Store Setup ---
const membersStore = useMembersStore()
const { activeMembers, archivedMembers, leaders } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore() 
const { currentEventAttendees } = storeToRefs(attendanceStore)

// --- Page State ---
const viewMode = ref('list')
const showArchived = ref(false) 
const showMemberModal = ref(false)
const selectedMember = ref(null)
const expandedDgroups = ref([])
const searchQuery = ref('') 
const showFilterModal = ref(false)

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
  // 1. Select Source: Active vs Archived
  let list = showArchived.value ? archivedMembers.value : activeMembers.value

  // 2. Text Search
  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(member => 
      member.firstName.toLowerCase().includes(query) ||
      member.lastName.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    )
  }

  // 3. Checkbox Filters
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
  
  // 4. Sorting
  list.sort((a, b) => {
    const aIsPresent = presentMemberIds.value.has(a.id)
    const bIsPresent = presentMemberIds.value.has(b.id)
    
    if (aIsPresent && !bIsPresent) return -1
    if (!aIsPresent && bIsPresent) return 1
    
    return a.lastName.localeCompare(b.lastName)
  })
  
  return list
})

const sortedDgroups = computed(() => {
  // If showArchived is true, we show groups of archived members.
  const sourceList = showArchived.value ? archivedMembers.value : activeMembers.value;

  const groups = {}
  leaders.value.forEach(leader => {
    groups[`${leader.firstName} ${leader.lastName}`] = []
  })
  groups['Unassigned'] = []

  sourceList.forEach(member => {
    const leaderName = member.dgroupLeader
    if (leaderName && groups.hasOwnProperty(leaderName)) {
      groups[leaderName].push(member)
    } else if (!leaderName) {
      if (!member.finalTags.isDgroupLeader || member.dgroupLeader) {
         groups['Unassigned'].push(member)
      }
    }
  })
  if(groups['Unassigned'].length === 0) {
    delete groups['Unassigned']
  }
  
  return Object.entries(groups).map(([leaderName, members]) => {
    const leaderObj = leaders.value.find(l => `${l.firstName} ${l.lastName}` === leaderName)
    const isLeaderPresent = leaderObj ? presentMemberIds.value.has(leaderObj.id) : false
    
    return { leaderName, members, isLeaderPresent }
  }).sort((a, b) => {
    if (a.isLeaderPresent && !b.isLeaderPresent) return -1
    if (!a.isLeaderPresent && b.isLeaderPresent) return 1
    return a.leaderName.localeCompare(b.leaderName)
  })
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

// Handle Archive
function handleArchiveMember(memberId) {
  membersStore.archiveMember(memberId)
  showMemberModal.value = false 
  searchQuery.value = ''
}

// Handle Restore
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

</script>

<template>
  <div class="members-container">
    <div class="members-header">
      <h1>{{ showArchived ? 'Archived Members' : 'Members Directory' }}</h1>
      
      <!-- Archive Toggle -->
      <button class="archive-toggle-btn" @click="showArchived = !showArchived">
        <Archive :size="18" />
        <span>{{ showArchived ? 'View Active' : 'View Archived' }}</span>
      </button>
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
    
    <div class="member-list" v-if="viewMode === 'list'">
      <MemberCard 
        v-for="member in filteredMembers" 
        :key="member.id"
        :member="member"
        :isPresent="presentMemberIds.has(member.id)"
        @click="openMemberDetails(member)"
      />
      <div v-if="filteredMembers.length === 0" class="no-results">
        <p>No {{ showArchived ? 'archived' : 'active' }} members match your criteria.</p>
      </div>
    </div>

    <div class="dgroup-view" v-if="viewMode === 'dgroup'">
      <div v-if="sortedDgroups.length === 0" class="no-results">
        <p>No members found to group.</p>
      </div>
      
      <div 
        v-for="group in sortedDgroups" 
        :key="group.leaderName" 
        class="dgroup-card"
        :class="{
          'is-present': group.isLeaderPresent && group.leaderName !== 'Unassigned',
          'is-absent': !group.isLeaderPresent && group.leaderName !== 'Unassigned'
        }"
      >
        <div class="dgroup-header" @click="toggleDgroup(group.leaderName)">
          <div class="header-info">
            <h3 class="dgroup-leader-name">{{ group.leaderName }}</h3>
            <span class="dgroup-stats">
              {{ group.members.length }} Members | {{ getDgroupAttendance(group.members) }}
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
          <p v-if="group.members.length === 0" class="no-members-text">
            This leader has no members assigned yet.
          </p>
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

.member-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.no-results {
  padding: 40px;
  text-align: center;
  background-color: #fff;
  border-radius: 12px;
  color: #78909C;
}
.no-results p {
  margin: 0;
  font-size: 16px;
}
.dgroup-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
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

.dgroup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
}
.dgroup-header:hover {
  background-color: #f9f9f9;
}
.dgroup-leader-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0D47A1;
}
.dgroup-stats {
  font-size: 14px;
  color: #546E7A;
  margin-top: 4px;
}
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
}
</style>