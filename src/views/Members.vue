<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search, Archive, Filter } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { useEventsStore } from '../stores/events' 
import MemberCard from '../components/dgmComponents/MemberCard.vue'
import MemberDetailsModal from '../components/dgmComponents/MemberDetailsModal.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import AbsenceMonitoring from '../components/dgmComponents/AbsenceMonitoring.vue' 
import FilterModal from '../components/dgmComponents/FilterModal.vue' 

// --- Store Setup ---
const membersStore = useMembersStore()
const { activeMembers, archivedMembers } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore()
const { currentEventAttendees } = storeToRefs(attendanceStore)

// --- Lifecycle Hook: Enforce Archive Policy ---
onMounted(() => {
  // Check for old archives whenever the admin visits the members page
  membersStore.purgeOldArchives();
})

// --- Page State ---
const showArchived = ref(false) 
const showMemberModal = ref(false)
const showFilterModal = ref(false) 
const selectedMember = ref(null)
const searchQuery = ref('') 
const showAbsenceMonitoringModal = ref(false)

// --- Filters State ---
const currentFilters = ref({
  age: [],
  type: { included: [], excluded: [] },
  ministries: []
})

// --- Computed Properties ---
const presentMemberIds = computed(() => {
  return new Set(currentEventAttendees.value.map(att => att.memberId))
})

// --- Main Filter Logic ---
const filteredMembers = computed(() => {
  let list = showArchived.value ? archivedMembers.value : activeMembers.value

  // 1. Text Search
  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(member => 
      member.firstName.toLowerCase().includes(query) ||
      member.lastName.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    )
  }

  const f = currentFilters.value;

  // 2. Age Filter
  if (f.age.length > 0) {
    list = list.filter(m => f.age.includes(m.finalTags.ageCategory));
  }

  // 3. Type Filter (Inclusion)
  if (f.type.included.length > 0) {
    list = list.filter(m => {
      if (f.type.included.includes('First Timer') && m.finalTags.isFirstTimer) return true;
      if (f.type.included.includes('Seeker') && m.finalTags.isSeeker) return true;
      if (f.type.included.includes('Regular') && m.finalTags.isRegular) return true;
      if (f.type.included.includes('Dgroup Leader') && m.finalTags.isDgroupLeader) return true;
      if (f.type.included.includes('Volunteer') && m.finalTags.isVolunteer) return true;
      return false;
    });
  }

  // 4. Type Filter (Exclusion)
  if (f.type.excluded.length > 0) {
    list = list.filter(m => {
      if (f.type.excluded.includes('First Timer') && m.finalTags.isFirstTimer) return false;
      if (f.type.excluded.includes('Seeker') && m.finalTags.isSeeker) return false;
      if (f.type.excluded.includes('Regular') && m.finalTags.isRegular) return false;
      if (f.type.excluded.includes('Dgroup Leader') && m.finalTags.isDgroupLeader) return false;
      if (f.type.excluded.includes('Volunteer') && m.finalTags.isVolunteer) return false;
      return true;
    });
  }

  // 5. Ministry Filters
  if (f.ministries.length > 0) {
    list = list.filter(m => 
      m.finalTags.isVolunteer &&
      m.finalTags.volunteerMinistry.some(v => f.ministries.includes(v))
    )
  }
  
  // Sort Alphabetically by FIRST Name
  list.sort((a, b) => a.firstName.localeCompare(b.firstName))
  
  return list
})

// Split filtered list into Present and Absent for the columns (Only used for Active View)
const presentList = computed(() => filteredMembers.value.filter(m => presentMemberIds.value.has(m.id)))
const absentList = computed(() => filteredMembers.value.filter(m => !presentMemberIds.value.has(m.id)))

// --- Functions ---
function openMemberDetails(member) { selectedMember.value = member; showMemberModal.value = true; }
function handleSaveChanges(updatedMember) { membersStore.updateMember(updatedMember); showMemberModal.value = false; }
function handleArchiveMember(memberId) { membersStore.archiveMember(memberId); showMemberModal.value = false; }
function handleRestoreMember(memberId) { membersStore.restoreMember(memberId); showMemberModal.value = false; }
function handleModalClose() { showMemberModal.value = false; }
function openAbsenceMonitoring() { showAbsenceMonitoringModal.value = true; }

// --- Absence count ---
const { allEvents } = storeToRefs(useEventsStore())
const { allAttendance } = storeToRefs(attendanceStore)
const todayISO = () => new Date().toISOString().split('T')[0]
function getPastServices() { const today = todayISO(); return allEvents.value.filter(e => e.eventType === 'service' && e.date <= today).sort((a, b) => new Date(b.date) - new Date(a.date)); }
function computeConsecutiveAbsences(member, past) { let count = 0; for (const ev of past) { const attended = allAttendance.value ? allAttendance.value.some(a => a.eventId === ev.id && a.memberId === member.id) : false; if (!attended) count++; else break; } return count; }
const absenceCount = computed(() => { const past = getPastServices(); if (!past || past.length === 0) return 0; return activeMembers.value.map(m => computeConsecutiveAbsences(m, past)).filter(c => c >= 3).length; })

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Absence Monitoring</span>
          <span v-if="absenceCount > 0" class="absence-notif">{{ absenceCount }}</span>
        </button>
      </div>
    </div>

    <div class="controls-wrapper">
      <div class="search-bar">
        <Search :size="20" class="search-icon" />
        <input type="text" placeholder="Search by name or email..." v-model="searchQuery" autocomplete="off">
      </div>
      
      <button class="filter-btn" @click="showFilterModal = true">
         <Filter :size="16" /> Filters
      </button>
    </div>
    
    <div class="active-filters" v-if="currentFilters.type.excluded.length > 0">
        <span class="exclude-tag" v-for="ex in currentFilters.type.excluded" :key="ex">
            Exclude: {{ ex }}
        </span>
    </div>

    <!-- LIST VIEW -->
    <div class="member-list-view">
      <div v-if="showArchived" class="simple-list">
        <MemberCard v-for="member in filteredMembers" :key="member.id" :member="member" :isPresent="presentMemberIds.has(member.id)" @click="openMemberDetails(member)" />
        <div v-if="filteredMembers.length === 0" class="no-results">No archived members found.</div>
      </div>
      <div v-else class="columns-grid">
        <div class="column-block">
          <h3 class="column-title present-header">Present ({{ presentList.length }})</h3>
          <div class="list-content">
            <MemberCard 
              v-for="member in presentList" 
              :key="member.id" 
              :member="member" 
              :isPresent="true" 
              :hideStatus="true"
              class="member-card-item is-present"
              @click="openMemberDetails(member)" 
            />
            <div v-if="presentList.length === 0" class="empty-col">No present members found.</div>
          </div>
        </div>
        <div class="column-block">
          <h3 class="column-title absent-header">Absent ({{ absentList.length }})</h3>
          <div class="list-content">
            <!-- Added is-absent class and hideStatus prop to remove label -->
            <MemberCard 
              v-for="member in absentList" 
              :key="member.id" 
              :member="member" 
              :isPresent="false"
              :hideStatus="true"
              class="member-card-item is-absent"
              @click="openMemberDetails(member)" 
            />
            <div v-if="absentList.length === 0" class="empty-col">No absent members found.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <Modal v-if="showMemberModal" @close="handleModalClose"> 
    <MemberDetailsModal v-if="selectedMember" :member="selectedMember" @close="handleModalClose" @saveChanges="handleSaveChanges" @archiveMember="handleArchiveMember" @restoreMember="handleRestoreMember" />
  </Modal>

  <Modal v-if="showAbsenceMonitoringModal" @close="showAbsenceMonitoringModal = false" size="xl">
    <div class="absence-modal-wrapper"><header class="absence-modal-header"><h3>Consecutive Absences</h3><p class="absence-subtext">Monitor members with 3, 4 and 5+ consecutive missed gatherings.</p></header><div class="absence-modal-body"><AbsenceMonitoring /></div></div>
  </Modal>

  <Modal v-if="showFilterModal" @close="showFilterModal = false">
      <FilterModal 
        v-model="currentFilters" 
        @apply="showFilterModal = false" 
      />
  </Modal>
</template>

<style scoped>
/* Keeping previous styles + adding filter btn style */
.members-container { padding: 20px; }
.members-header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
.members-header h1 { font-size: 28px; font-weight: 700; margin: 0; }
.archive-toggle-btn { background-color: #fff; border: 1px solid #546E7A; color: #546E7A; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; transition: all 0.2s ease; }
.archive-toggle-btn:hover { background-color: #ECEFF1; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.absence-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(21, 101, 192, 0.08); background: #fff; color: #0D47A1; font-weight: 700; cursor: pointer; transition: box-shadow 0.12s ease, transform 0.12s ease; position: relative; }
.absence-btn svg { color: #D32F2F; }
.absence-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06); }
.absence-notif { position: absolute; top: -6px; right: -6px; background: #D32F2F; color: #fff; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }

.controls-wrapper { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 16px; }
.search-bar { flex-grow: 1; position: relative; }
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #90A4AE; }
.search-bar input { width: 100%; padding: 12px 12px 12px 44px; border-radius: 8px; border: 1px solid #B0BEC5; font-size: 16px; box-sizing: border-box; }
.filter-btn { background: #fff; border: 1px solid #CFD8DC; padding: 10px 14px; border-radius: 8px; font-weight: 600; color: #546E7A; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.filter-btn:hover { background: #ECEFF1; }

/* Tag display for active filters */
.active-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.exclude-tag { font-size: 11px; background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 4px 8px; border-radius: 12px; font-weight: 600; }

.member-list-view { display: flex; flex-direction: column; gap: 24px; }
.columns-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 900px) { .columns-grid { grid-template-columns: 1fr 1fr; align-items: start; } }
.column-block { display: flex; flex-direction: column; gap: 16px; }
.column-title { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 8px; border-bottom: 2px solid #EEE; margin: 0; }
.column-title.present-header { color: #2E7D32; border-color: #2E7D32; }
.column-title.absent-header { color: #C62828; border-color: #C62828; }
.list-content { display: flex; flex-direction: column; gap: 12px; }
.simple-list { display: flex; flex-direction: column; gap: 12px; }
.empty-col { text-align: center; color: #B0BEC5; font-style: italic; padding: 20px; background: #FAFAFA; border-radius: 12px; }

/* NEW MEMBER CARD STYLES FOR ATTENDANCE */
.member-card-item {
  border-left: 4px solid #B0BEC5; /* Default */
  transition: all 0.2s ease;
}
.member-card-item.is-present {
  border-left-color: #4CAF50; /* Green */
}
.member-card-item.is-absent {
  border-left-color: #F44336; /* Red */
}

.absence-modal-wrapper { display:flex; flex-direction:column; gap:12px; height:100%; }
.absence-modal-header { padding: 8px 4px; border-bottom: 1px solid #F1F3F5; }
.absence-modal-header h3 { margin:0; color:#D32F2F; font-size:18px; }
.absence-subtext { margin:6px 0 0 0; color:#546E7A; font-size:13px; }
.absence-modal-body { padding-top:12px; overflow:auto; }
</style>