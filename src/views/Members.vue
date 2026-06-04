<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Archive, Filter, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { useEventsStore } from '../stores/events' 
import { useAuthStore } from '../stores/auth'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import MemberCard from '../components/dgmComponents/MemberCard.vue'
import MemberDetailsModal from '../components/dgmComponents/MemberDetailsModal.vue'
import Modal from '../components/dgmComponents/Modal.vue'
import AbsenceMonitoring from '../components/dgmComponents/AbsenceMonitoring.vue' 
import FilterModal from '../components/dgmComponents/FilterModal.vue' 

// --- Store Setup ---
const membersStore = useMembersStore()
const { activeMembers, archivedMembers, pendingMembers } = storeToRefs(membersStore)
const attendanceStore = useAttendanceStore()
const { currentEventAttendees } = storeToRefs(attendanceStore)
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

// --- Lifecycle Hook: Enforce Archive Policy ---
onMounted(() => {
  // Check for old archives whenever the admin visits the members page
  membersStore.purgeOldArchives();
  // Start listening for pending registrations
  membersStore.fetchPendingRegistrations();
})

// --- Page State ---
const showArchived = ref(false) 
const showMemberModal = ref(false)
const showFilterModal = ref(false) 
const selectedMember = ref(null)
const searchQuery = ref('') 
const showAbsenceMonitoringModal = ref(false)
const showPendingModal = ref(false)
const selectedPending = ref(null)
const showHeaderMenu = ref(false)
const PAGE_SIZE = 10
const presentPage = ref(1)
const absentPage = ref(1)
const archivedPage = ref(1)

// --- Filters State ---
const currentFilters = ref({
  age: [],
  gender: [],
  type: { included: [], excluded: [] },
  ministries: [],
  sort: { key: 'joinDate', order: 'desc' }
})

const sortOption = ref('joinDate-desc')

watch(sortOption, (newVal) => {
  const [key, order] = newVal.split('-')
  currentFilters.value.sort = { key, order }
})

// --- Computed Properties ---
const presentMemberIds = computed(() => {
  return new Set(currentEventAttendees.value.map(att => att.memberId))
})

function applyMemberFilters(sourceMembers = []) {
  // copy to avoid mutating store arrays
  let list = sourceMembers.slice()

  // 1. Text Search (Now Handles Full Names with Spaces)
  if (searchQuery.value.trim() !== '') {
    const searchTerms = searchQuery.value.toLowerCase().split(' ').filter(Boolean)

    list = list.filter(member => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase()
      const email = (member.email || '').toLowerCase()

      // Member must match ALL typed words (e.g. "Jake" AND "Pan")
      return searchTerms.every(term =>
        fullName.includes(term) || email.includes(term)
      )
    })
  }

  const f = currentFilters.value

  // 2. Age Filter
  if (f.age.length > 0) {
    list = list.filter(m => f.age.includes(m.finalTags.ageCategory))
  }

  // 3. Type Filter (Inclusion)
  if (f.type.included.length > 0) {
    list = list.filter(m => {
      if (f.type.included.includes('First Timer') && m.finalTags.isFirstTimer) return true
      if (f.type.included.includes('Seeker') && m.finalTags.isSeeker) return true
      if (f.type.included.includes('Regular') && m.finalTags.isRegular) return true
      if (f.type.included.includes('Dgroup Leader') && m.finalTags.isDgroupLeader) return true
      if (f.type.included.includes('Volunteer') && m.finalTags.isVolunteer) return true
      return false
    })
  }

  // 4. Type Filter (Exclusion)
  if (f.type.excluded.length > 0) {
    list = list.filter(m => {
      if (f.type.excluded.includes('First Timer') && m.finalTags.isFirstTimer) return false
      if (f.type.excluded.includes('Seeker') && m.finalTags.isSeeker) return false
      if (f.type.excluded.includes('Regular') && m.finalTags.isRegular) return false
      if (f.type.excluded.includes('Dgroup Leader') && m.finalTags.isDgroupLeader) return false
      if (f.type.excluded.includes('Volunteer') && m.finalTags.isVolunteer) return false
      return true
    })
  }

  // 5. Ministry Filters
  if (f.ministries.length > 0) {
    list = list.filter(m =>
      m.finalTags.isVolunteer &&
      m.finalTags.volunteerMinistry.some(v => f.ministries.includes(v))
    )
  }

  // 6. Gender Filter
  if (f.gender && f.gender.length > 0) {
    list = list.filter(m => f.gender.includes(m.gender))
  }

  // Sorting based on currentFilters.sort
  const sort = f.sort || { key: 'joinDate', order: 'desc' }
  const dir = sort.order === 'asc' ? 1 : -1
  if (sort.key === 'joinDate') {
    list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return (ta - tb) * dir
    })
  } else {
    // alphabetical by firstName then lastName
    list.sort((a, b) => {
      const cmp = a.firstName.localeCompare(b.firstName)
      return (cmp !== 0 ? cmp : a.lastName.localeCompare(b.lastName)) * dir
    })
  }

  return list
}

// --- Main Filter Logic ---
const filteredMembers = computed(() => {
  return applyMemberFilters(showArchived.value ? archivedMembers.value : activeMembers.value)
})

const filteredActiveMembers = computed(() => applyMemberFilters(activeMembers.value))
const filteredArchivedMembers = computed(() => applyMemberFilters(archivedMembers.value))

const presentMembers = computed(() => filteredActiveMembers.value.filter(m => presentMemberIds.value.has(m.id)))
const absentMembers = computed(() => filteredActiveMembers.value.filter(m => !presentMemberIds.value.has(m.id)))

const presentPageCount = computed(() => Math.max(1, Math.ceil(presentMembers.value.length / PAGE_SIZE)))
const absentPageCount = computed(() => Math.max(1, Math.ceil(absentMembers.value.length / PAGE_SIZE)))
const archivedPageCount = computed(() => Math.max(1, Math.ceil(filteredArchivedMembers.value.length / PAGE_SIZE)))

const paginatedPresentMembers = computed(() => {
  const start = (presentPage.value - 1) * PAGE_SIZE
  return presentMembers.value.slice(start, start + PAGE_SIZE)
})

const paginatedAbsentMembers = computed(() => {
  const start = (absentPage.value - 1) * PAGE_SIZE
  return absentMembers.value.slice(start, start + PAGE_SIZE)
})

const paginatedArchivedMembers = computed(() => {
  const start = (archivedPage.value - 1) * PAGE_SIZE
  return filteredArchivedMembers.value.slice(start, start + PAGE_SIZE)
})

const presentTotal = computed(() => presentMembers.value.length)
const absentTotal = computed(() => absentMembers.value.length)

function clampPage(page, pageCount) {
  return Math.min(Math.max(page, 1), pageCount)
}

function goToPresentPage(page) {
  presentPage.value = clampPage(page, presentPageCount.value)
}

function goToAbsentPage(page) {
  absentPage.value = clampPage(page, absentPageCount.value)
}

function goToArchivedPage(page) {
  archivedPage.value = clampPage(page, archivedPageCount.value)
}

// --- Functions ---
function openMemberDetails(member) { selectedMember.value = member; showMemberModal.value = true; }
function handleSaveChanges(updatedMember) { membersStore.updateMember(updatedMember); showMemberModal.value = false; }
function handleArchiveMember(memberId) { membersStore.archiveMember(memberId); showMemberModal.value = false; }
function handleRestoreMember(memberId) { membersStore.restoreMember(memberId); showMemberModal.value = false; }
function handleModalClose() { showMemberModal.value = false; }
function openAbsenceMonitoring() { showAbsenceMonitoringModal.value = true; }
function openPendingList() { showPendingModal.value = true; }
function openPendingDetails(p) { selectedPending.value = p; }
function toggleHeaderMenu() { showHeaderMenu.value = !showHeaderMenu.value }

function formatArchiveDate(dateString) {
  if (!dateString) return 'Unknown';
  // handle Firestore Timestamp (.toDate), {seconds}, Date, number, or string
  let d;
  if (dateString && typeof dateString.toDate === 'function') d = dateString.toDate();
  else if (dateString && dateString.seconds) d = new Date(dateString.seconds * 1000);
  else d = new Date(typeof dateString === 'string' && /^\d+$/.test(dateString) ? Number(dateString) : dateString);
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
}

async function quickRestoreMember(member) {
  if (!member?.id) return
  if (!confirm(`Restore ${member.firstName} ${member.lastName}?`)) return
  await membersStore.restoreMember(member.id)
}

async function quickApprovePending(p) {
  if (!p?.id) return
  if (!confirm(`Approve ${p.firstName} ${p.lastName}?`)) return
  await membersStore.approvePending(p.id)
  if (selectedPending.value?.id === p.id) selectedPending.value = null
}

async function quickRejectPending(p) {
  if (!p?.id) return
  if (!confirm(`Reject ${p.firstName} ${p.lastName} and delete this registration?`)) return
  await membersStore.rejectPending(p.id)
  if (selectedPending.value?.id === p.id) selectedPending.value = null
}

async function approveAllPending() {
  const allPending = pendingMembers.value || []
  if (!allPending.length) return
  const ok = confirm(`Approve all ${allPending.length} pending members?`)
  if (!ok) return

  for (const p of allPending) {
    if (p?.id) {
      await membersStore.approvePending(p.id)
    }
  }
  selectedPending.value = null
}

async function approveSelected() {
  if (!selectedPending.value) return;
  if (!confirm('Approve this registration?')) return;
  await membersStore.approvePending(selectedPending.value.id);
  selectedPending.value = null;
}
async function rejectSelected() {
  if (!selectedPending.value) return;
  if (!confirm('Reject and delete this registration?')) return;
  await membersStore.rejectPending(selectedPending.value.id);
  selectedPending.value = null;
}

function handleFocusQuery(focusKey) {
  if (focusKey === 'pending') {
    showPendingModal.value = true
    showArchived.value = false
  } else if (focusKey === 'absenceReports' || focusKey === 'members') {
    showAbsenceMonitoringModal.value = true
    showArchived.value = false
  }
}

// --- Reports count (admin) ---
const reportsCount = ref(0)
let _unsubReports = null
onMounted(() => {
  if (!authStore.branchId) return
  const colRef = collection(db, 'branches', authStore.branchId, 'notifications')
  const q = query(colRef, orderBy('createdAt', 'desc'))
  _unsubReports = onSnapshot(q, (snap) => {
    let count = 0
    snap.docs.forEach(d => {
      const data = d.data()
      if (data.recipientId === 'admin' && typeof data.title === 'string' && data.title.startsWith('Absence Report')) {
        count++
      }
    })
    reportsCount.value = count
  })
})
onUnmounted(() => { if (_unsubReports) _unsubReports() })

onMounted(() => {
  handleFocusQuery(route.query?.focus)
})

watch(() => route.query?.focus, (newFocus) => {
  handleFocusQuery(newFocus)
})

watch(showPendingModal, (isOpen) => {
  // clear handled focus query once modal is closed
  if (!isOpen && route.query?.focus === 'pending') {
    const { focus, ...rest } = route.query
    router.replace({ query: rest })
  }
})

watch(showAbsenceMonitoringModal, (isOpen) => {
  // clear handled focus query once modal is closed
  if (!isOpen && (route.query?.focus === 'absenceReports' || route.query?.focus === 'members')) {
    const { focus, ...rest } = route.query
    router.replace({ query: rest })
  }
})

watch(
  [searchQuery, showArchived, () => currentFilters.value],
  () => {
    presentPage.value = 1
    absentPage.value = 1
    archivedPage.value = 1
  },
  { deep: true }
)

watch(presentPageCount, (nextCount) => {
  if (presentPage.value > nextCount) presentPage.value = nextCount
})

watch(absentPageCount, (nextCount) => {
  if (absentPage.value > nextCount) absentPage.value = nextCount
})

watch(archivedPageCount, (nextCount) => {
  if (archivedPage.value > nextCount) archivedPage.value = nextCount
})

</script>

<template>
  <div class="members-container">
    <div class="members-header">
      <h1>{{ showArchived ? 'Archived Members' : 'Members Directory' }}</h1>
      <!-- Desktop header actions -->
      <div class="header-actions desktop-only">
        <button class="archive-toggle-btn" @click="showArchived = !showArchived">
          <Archive :size="18" />
          <span>{{ showArchived ? 'View Active' : 'View Archived' }}</span>
        </button>
        <button class="absence-btn" @click="openAbsenceMonitoring" title="Open Absence Monitoring">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Absence Monitoring</span>
          <span v-if="reportsCount > 0" class="absence-notif">{{ reportsCount }}</span>
        </button>
        <button class="pending-btn" @click="openPendingList" title="Pending Approvals">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Pending Approval</span>
          <span v-if="pendingMembers && pendingMembers.length > 0" class="pending-notif">{{ pendingMembers.length }}</span>
        </button>
      </div>

      <!-- Mobile header: hamburger menu -->
      <div class="mobile-actions">
        <button class="hamburger-btn" @click="toggleHeaderMenu" aria-label="Open menu">
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none"><rect y="1" width="20" height="2" rx="1" fill="currentColor"/><rect y="6" width="20" height="2" rx="1" fill="currentColor"/><rect y="11" width="20" height="2" rx="1" fill="currentColor"/></svg>
        </button>
        <div v-if="showHeaderMenu" class="mobile-menu">
          <button class="mobile-item" @click="showArchived = !showArchived; showHeaderMenu = false">
            <Archive :size="14" />
            <span>{{ showArchived ? 'View Active' : 'View Archived' }}</span>
          </button>
          <button class="mobile-item" @click="openAbsenceMonitoring(); showHeaderMenu = false">
            <span>Absence Monitoring</span>
            <span v-if="reportsCount > 0" class="abs-mobile-notif">{{ reportsCount }}</span>
          </button>
          <button class="mobile-item" @click="openPendingList(); showHeaderMenu = false">
            <span>Pending Approval</span>
            <span v-if="pendingMembers && pendingMembers.length > 0" class="pending-mobile-notif">{{ pendingMembers.length }}</span>
          </button>
        </div>
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
        <button 
          v-if="searchQuery.length > 0" 
          @click="searchQuery = ''" 
          class="clear-search-btn"
          aria-label="Clear search"
        >
          <X :size="16" />
        </button>
      </div>
      
      <div class="sort-control">
        <label for="sort-select" class="sort-label">Sort by:</label>
        <select id="sort-select" v-model="sortOption" class="sort-select">
          <option value="joinDate-desc">Join Date (Newest)</option>
          <option value="joinDate-asc">Join Date (Oldest)</option>
          <option value="alphabetical-asc">A-Z</option>
          <option value="alphabetical-desc">Z-A</option>
        </select>
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
        <div v-for="member in paginatedArchivedMembers" :key="member.id" class="member-action-row archived-row">
          
          <MemberCard 
            :member="member" 
            :hideStatus="true" 
            class="member-card-item is-archived"
            @click="openMemberDetails(member)" 
          />
          
          <div class="row-actions">
            <div class="archive-date-info">
              <span class="archive-label">Archived on</span>
              <span class="archive-date">{{ formatArchiveDate(member.archivedAt) }}</span>
            </div>
            <button class="row-btn restore" @click.stop="quickRestoreMember(member)">Restore</button>
          </div>
        </div>
        <div v-if="filteredArchivedMembers.length === 0" class="no-results">No archived members found.</div>
        <div v-if="archivedPageCount > 1" class="pagination-bar archive-pagination">
          <button class="pagination-btn" @click="goToArchivedPage(archivedPage - 1)" :disabled="archivedPage === 1">Previous</button>
          <div class="pagination-info">
            <span>Page {{ archivedPage }} of {{ archivedPageCount }}</span>
            <span>{{ filteredArchivedMembers.length }} members total</span>
          </div>
          <button class="pagination-btn" @click="goToArchivedPage(archivedPage + 1)" :disabled="archivedPage === archivedPageCount">Next</button>
        </div>
      </div>
      <div v-else class="columns-grid">
        <div class="column-block">
          <h3 class="column-title present-header">Present ({{ presentTotal }})</h3>
          <div v-if="presentPageCount > 1" class="column-page-nav">
            <button
              class="page-chevron-btn"
              @click="goToPresentPage(presentPage - 1)"
              :disabled="presentPage === 1"
              aria-label="Previous page"
            >
              <ChevronLeft :size="16" />
            </button>
            <span class="page-number">{{ presentPage }}</span>
            <button
              class="page-chevron-btn"
              @click="goToPresentPage(presentPage + 1)"
              :disabled="presentPage === presentPageCount"
              aria-label="Next page"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
          <div class="list-content">
            <MemberCard 
              v-for="member in paginatedPresentMembers" 
              :key="member.id" 
              :member="member" 
              :isPresent="true" 
              :hideStatus="true"
              class="member-card-item is-present"
              @click="openMemberDetails(member)" 
            />
            <div v-if="presentTotal === 0" class="empty-col">No present members found.</div>
          </div>
        </div>
        <div class="column-block">
          <h3 class="column-title absent-header">Absent ({{ absentTotal }})</h3>
          <div v-if="absentPageCount > 1" class="column-page-nav">
            <button
              class="page-chevron-btn"
              @click="goToAbsentPage(absentPage - 1)"
              :disabled="absentPage === 1"
              aria-label="Previous page"
            >
              <ChevronLeft :size="16" />
            </button>
            <span class="page-number">{{ absentPage }}</span>
            <button
              class="page-chevron-btn"
              @click="goToAbsentPage(absentPage + 1)"
              :disabled="absentPage === absentPageCount"
              aria-label="Next page"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
          <div class="list-content">
            <!-- Added is-absent class and hideStatus prop to remove label -->
            <MemberCard 
              v-for="member in paginatedAbsentMembers" 
              :key="member.id" 
              :member="member" 
              :isPresent="false"
              :hideStatus="true"
              class="member-card-item is-absent"
              @click="openMemberDetails(member)" 
            />
            <div v-if="absentTotal === 0" class="empty-col">No absent members found.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <Modal v-if="showMemberModal" @close="handleModalClose"> 
    <MemberDetailsModal v-if="selectedMember" :member="selectedMember" @close="handleModalClose" @saveChanges="handleSaveChanges" @archiveMember="handleArchiveMember" @restoreMember="handleRestoreMember" />
  </Modal>

  <Modal v-if="showAbsenceMonitoringModal" @close="showAbsenceMonitoringModal = false" size="xl">
    <div class="absence-modal-wrapper"><div class="absence-modal-body"><AbsenceMonitoring /></div></div>
  </Modal>

  <Modal v-if="showFilterModal" @close="showFilterModal = false">
      <FilterModal 
        v-model="currentFilters" 
        @apply="showFilterModal = false" 
      />
  </Modal>

  <!-- PENDING APPROVALS MODAL -->
  <Modal v-if="showPendingModal" @close="showPendingModal = false" size="lg">
    <div class="pending-modal">
      <header class="pending-header">
        <h3>Pending Registrations</h3>
        <button class="approve-all-btn" @click="approveAllPending" :disabled="!pendingMembers.length">Approve All</button>
      </header>
      <div class="pending-body">
        <div class="pending-list">
          <div v-if="pendingMembers.length === 0" class="empty-text">No pending registrations.</div>
          <div v-for="p in pendingMembers" :key="p.id" :class="['pending-item', { selected: selectedPending && selectedPending.id === p.id }]">
            <MemberCard :member="p" :hideStatus="true" :hideDetails="false" @click="openPendingDetails(p)" />
            <div class="pending-item-actions">
              <button class="pending-quick-btn approve" @click.stop="quickApprovePending(p)">Approve</button>
              <button class="pending-quick-btn reject" @click.stop="quickRejectPending(p)">Reject</button>
            </div>
          </div>
        </div>
        <div class="pending-details" v-if="selectedPending">
          <div class="details">
            <div class="details-top">
              <div class="details-title">
                <h4>{{ selectedPending.firstName }} {{ selectedPending.lastName }}</h4>
              </div>
              <button class="minimize-btn" @click="selectedPending = null" title="Minimize">
                <span class="minimize-line"></span>
              </button>
            </div>
            <p><strong>ID:</strong> {{ selectedPending.id }}</p>
            <p><strong>Email:</strong> {{ selectedPending.email }}</p>
            <p><strong>Birthday:</strong> {{ selectedPending.birthday }}</p>
            <p><strong>Gender:</strong> {{ selectedPending.gender }}</p>
            <div class="tag-list"><span class="tag" v-for="t in selectedPending.finalTags ? [selectedPending.finalTags.ageCategory] : []" :key="t">{{ t }}</span></div>
          </div>
          <div class="actions">
            <button class="btn-approve" @click="approveSelected">Approve</button>
            <button class="btn-reject" @click="rejectSelected">Reject</button>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
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

.pending-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(21, 101, 192, 0.08); background: #fff; color: #0D47A1; font-weight: 700; cursor: pointer; transition: box-shadow 0.12s ease, transform 0.12s ease; position: relative; }
.pending-btn svg { color: #1976D2; }
.pending-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06); }
.pending-notif { position: absolute; top: -6px; right: -6px; background: #1976D2; color: #fff; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }

.pending-modal { display:flex; flex-direction:column; gap:12px; }
.pending-body { display:flex; gap:12px; background: #F6FAFC; padding:12px; border-radius:12px; }
.pending-list { flex:1; max-height:60vh; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.pending-item { cursor:pointer; border: 1px solid transparent; transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease; }
.pending-item:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(23,42,69,0.06); border-color: rgba(25,118,210,0.12); }
.pending-item.selected { background: linear-gradient(90deg,#E3F2FD, #FFFFFF); }
.pending-details { width:360px; background:#FFFFFF; padding:16px; border-radius:12px; display:flex; flex-direction:column; justify-content:space-between; box-shadow: 0 10px 30px rgba(16,24,40,0.06); }
.pending-details .details { margin-bottom:14px }
.btn-approve { background:#2E7D32; color:white; border:none; padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer; margin-right: 12px; transition: background 0.12s ease, transform 0.08s ease; }
.btn-approve:hover { background:#246028; transform: translateY(-2px); }
.btn-reject { background:transparent; color:#D32F2F; border:1px solid #D32F2F; padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer; transition: background 0.12s ease, color 0.12s ease; }
.btn-reject:hover { background:#D32F2F; color:white; }

/* Minimize button */
.minimize-btn { background: transparent; border: none; width:36px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:6px; }
.minimize-btn:hover { background: rgba(0,0,0,0.04); }
.minimize-line { display:block; width:18px; height:3px; background:#90A4AE; border-radius:2px; }

.details-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.details-title h4 { margin:0; font-size:16px; }

/* Header separation */
.pending-header { padding-bottom: 10px; border-bottom: 1px solid #bcbbbb; display:flex; align-items:center; justify-content:space-between; gap:10px; }
.pending-header h3 { margin: 0; font-size: 18px; color: #263238; }
.approve-all-btn { background:#2E7D32; color:white; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; }
.approve-all-btn:disabled { background:#CFD8DC; cursor:not-allowed; }

.controls-wrapper { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 16px; }

.search-bar { 
  flex-grow: 1; 
  position: relative; 
  display: flex;
  align-items: center;
}
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #90A4AE; }
.search-bar input { width: 100%; padding: 12px 40px 12px 44px; border-radius: 8px; border: 1px solid #B0BEC5; font-size: 16px; box-sizing: border-box; }

.clear-search-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #90A4AE;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
}
.clear-search-btn:hover { background: #ECEFF1; color: #455A64; }

/* Sort Controls CSS added */
.sort-control { display: flex; align-items: center; gap: 8px; }
.sort-label { font-size: 14px; font-weight: 600; color: #546E7A; }
.sort-select { padding: 10px 14px; border-radius: 8px; border: 1px solid #CFD8DC; font-size: 14px; font-weight: 600; color: #546E7A; background-color: #fff; cursor: pointer; outline: none; transition: all 0.2s ease; }
.sort-select:hover { background: #ECEFF1; }

.filter-btn { background: #fff; border: 1px solid #CFD8DC; padding: 10px 14px; border-radius: 8px; font-weight: 600; color: #546E7A; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.filter-btn:hover { background: #ECEFF1; }

/* Tag display for active filters */
.active-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.exclude-tag { font-size: 11px; background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 4px 8px; border-radius: 12px; font-weight: 600; }

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 0 0 16px;
  padding: 12px 14px;
  background: #F8FBFD;
  border: 1px solid #E3EEF5;
  border-radius: 12px;
}

.column-page-nav {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin: 6px 0 2px;
  color: #546E7A;
}

.page-number {
  min-width: 22px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #546E7A;
}

.page-chevron-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: #546E7A;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.12s ease;
}

.page-chevron-btn:hover:not(:disabled) {
  background: rgba(84, 110, 122, 0.08);
  transform: translateY(-1px);
}

.page-chevron-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.archive-pagination {
  margin-top: 8px;
  margin-bottom: 0;
}

.column-pagination {
  margin-top: 4px;
  margin-bottom: 0;
}

.pagination-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: #546E7A;
}

.pagination-info span:last-child {
  font-size: 12px;
  font-weight: 500;
  color: #90A4AE;
}

.pagination-btn {
  border: 1px solid #CFD8DC;
  background: #fff;
  color: #455A64;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease, opacity 0.12s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #ECEFF1;
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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

/* ROW ACTIONS & ARCHIVE DATE CSS */
.member-action-row { position:relative; width:100%; }
.member-action-row.archived-row :deep(.member-card) { padding-right:190px; }

.row-actions { 
  position:absolute; 
  right:16px; 
  top:50%; 
  transform:translateY(-50%); 
  display:flex; 
  align-items:center; 
  gap: 16px; 
}

.archive-date-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.archive-label {
  font-size: 10px;
  color: #90A4AE;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.archive-date {
  font-size: 12px;
  color: #546E7A;
  font-weight: 600;
}

.row-btn { border:none; border-radius:10px; padding:8px 12px; font-weight:700; cursor:pointer; font-size:12px; }
.row-btn.restore { background:#E8F5E9; color:#2E7D32; border:1px solid #C8E6C9; transition: all 0.2s; }
.row-btn.restore:hover { background: #C8E6C9; }

.pending-item { position:relative; }
.pending-item :deep(.member-card) { width:100%; padding-right:170px; }
.pending-item-actions { position:absolute; right:10px; top:50%; transform:translateY(-50%); display:flex; gap:6px; }
.pending-quick-btn { border:none; border-radius:8px; padding:7px 10px; font-size:12px; font-weight:700; cursor:pointer; }
.pending-quick-btn.approve { background:#E8F5E9; color:#2E7D32; border:1px solid #C8E6C9; }
.pending-quick-btn.reject { background:#FFEBEE; color:#C62828; border:1px solid #FFCDD2; }

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
.member-card-item.is-archived {
  border-left-color: #90A4AE;
  opacity: 0.85; /* Visual cue that it's archived */
}

.absence-modal-wrapper { display:flex; flex-direction:column; gap:12px; height:100%; }
.absence-modal-header { padding: 8px 4px; border-bottom: 1px solid #F1F3F5; }
.absence-modal-header h3 { margin:0; color:#D32F2F; font-size:18px; }
.absence-subtext { margin:6px 0 0 0; color:#546E7A; font-size:13px; }
.absence-modal-body { padding-top:12px; overflow:auto; }

/* Responsive header actions (mobile) */
.mobile-actions { display: none; position: relative; }
.hamburger-btn { background: #fff; border: 1px solid #CFD8DC; padding: 8px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; }
.mobile-menu { position: absolute; right: 0; top: 48px; background: #fff; border: 1px solid #CFD8DC; border-radius: 8px; padding: 8px; box-shadow: 0 10px 30px rgba(16,24,40,0.08); display: flex; flex-direction: column; gap: 8px; z-index: 60; min-width: 200px; }
.mobile-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; background: transparent; border: none; cursor: pointer; font-weight: 700; text-align: left; }
.mobile-item:hover { background: #F6FAFC; }
.abs-mobile-notif, .pending-mobile-notif { margin-left: auto; background: #D32F2F; color: #fff; padding: 4px 8px; border-radius: 12px; font-weight: 800; font-size: 12px; }

@media (max-width: 800px) {
  .header-actions.desktop-only { display: none; }
  .mobile-actions { display: flex; }
  .controls-wrapper { gap: 8px; flex-wrap: wrap; }
  .search-bar { flex-basis: 100%; order: -1; }
  .pagination-bar { flex-direction: column; gap: 8px; }
}

@media (max-width: 500px) {
  .archive-date-info { display: none; } /* Hide the date on very small screens so restore button fits */
  .member-action-row.archived-row :deep(.member-card) { padding-right: 90px; }
}
</style>