<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { User, Users, ChevronRight, Plus, X } from 'lucide-vue-next'

const authStore = useAuthStore()
const membersStore = useMembersStore()

const activeTab = ref('upline') 
const showCreateModal = ref(false)
const showGroupDetailModal = ref(false)
const showPersonModal = ref(false) 

const selectedGroup = ref(null)
const selectedPerson = ref(null) 

// Local state to store created groups for Frontend Demo purposes
const mockGroups = ref([])

// Form state with defaults
const newGroupForm = ref({ 
  name: '', 
  capacity: 12, 
  lifeStage: 'Elevate' 
})

onMounted(() => {
  membersStore.fetchMembers()
})

const myProfile = computed(() => authStore.userProfile)
const isLeader = computed(() => myProfile.value?.finalTags?.isDgroupLeader)

// UPLINE: My Leader & Co-members
const myLeaderName = computed(() => myProfile.value?.dgroupLeader)

const myLeaderObject = computed(() => {
  if (!myLeaderName.value) return null
  return membersStore.activeMembers.find(m => 
    `${m.firstName} ${m.lastName}` === myLeaderName.value
  )
})

const myUplineGroup = computed(() => {
  if (!myLeaderName.value) return []
  return membersStore.activeMembers.filter(m => 
    m.dgroupLeader === myLeaderName.value && m.id !== myProfile.value?.id
  )
})

// DOWNLINE: Members I lead (Combines real data + Mock data)
const myDownlineGroups = computed(() => {
  const groups = []

  // 1. Existing default group from Profile/Store data
  if (isLeader.value) {
    const myName = `${myProfile.value?.firstName} ${myProfile.value?.lastName}`
    const members = membersStore.activeMembers.filter(m => m.dgroupLeader === myName)
    
    groups.push({
      id: 'g-default',
      name: `${myProfile.value?.firstName}'s Dgroup`,
      members: members,
      lifeStage: myProfile.value?.finalTags?.ageCategory || 'Mixed',
      capacity: myProfile.value?.dgroupCapacity || 12
    })
  }
  
  // 2. Add locally created groups (Frontend Demo)
  return [...groups, ...mockGroups.value]
})

function openGroupDetails(group) {
  selectedGroup.value = group
  showGroupDetailModal.value = true
}

function viewPerson(person) {
  if(!person) return
  selectedPerson.value = person
  showPersonModal.value = true
}

function createDgroup() {
  if(!newGroupForm.value.name) return alert("Please enter a group name")
  
  // Create a new group object locally to simulate the backend creation
  const newGroup = {
    id: `new-${Date.now()}`,
    name: newGroupForm.value.name,
    capacity: newGroupForm.value.capacity,
    lifeStage: newGroupForm.value.lifeStage,
    members: [] // Start with 0 members
  }

  // Push to local list so it appears in the UI
  mockGroups.value.push(newGroup)
  
  showCreateModal.value = false
  // Reset form
  newGroupForm.value = { name: '', capacity: 12, lifeStage: 'Elevate' }
}
</script>

<template>
  <div class="dgroup-view">
    
    <!-- Tab Switcher -->
    <div class="tabs">
      <button :class="{ active: activeTab === 'upline' }" @click="activeTab = 'upline'">
        My Dgroup (Upline)
      </button>
      <button v-if="isLeader" :class="{ active: activeTab === 'downline' }" @click="activeTab = 'downline'">
        My Groups (Downline)
      </button>
    </div>

    <!-- UPLINE VIEW -->
    <div v-if="activeTab === 'upline'" class="tab-content">
      
      <div 
        class="leader-card" 
        v-if="myLeaderName"
        @click="viewPerson(myLeaderObject)"
        :class="{ 'clickable': !!myLeaderObject }"
      >
        <div class="avatar-ring">
          <User :size="32" color="#1565C0" />
        </div>
        <div class="leader-info">
          <span class="label">Your Leader</span>
          <h3>{{ myLeaderName }}</h3>
          <span v-if="!myLeaderObject" class="missing-info-text">(Profile not found)</span>
        </div>
        <ChevronRight v-if="myLeaderObject" :size="20" color="#B0BEC5" style="margin-left: auto;" />
      </div>

      <div v-else class="empty-state">
        <p>You are not assigned to a Dgroup yet.</p>
      </div>

      <div class="members-list" v-if="myLeaderName">
        <h4>Co-Members ({{ myUplineGroup.length }})</h4>
        <div 
          v-for="member in myUplineGroup" 
          :key="member.id" 
          class="member-row clickable"
          @click="viewPerson(member)"
        >
          <div class="member-avatar">{{ member.firstName.charAt(0) }}</div>
          <div class="member-name">{{ member.firstName }} {{ member.lastName }}</div>
          <ChevronRight :size="16" color="#CFD8DC" style="margin-left: auto;" />
        </div>
      </div>
    </div>

    <!-- DOWNLINE VIEW (Leader Only) -->
    <div v-if="activeTab === 'downline'" class="tab-content">
      <div class="groups-header">
        <h3>Your Groups</h3>
        <button class="create-btn" @click="showCreateModal = true"><Plus :size="16" /> New</button>
      </div>

      <div class="groups-grid">
        <div v-for="group in myDownlineGroups" :key="group.id" class="group-card" @click="openGroupDetails(group)">
          <div class="group-icon"><Users :size="24" color="white"/></div>
          <div class="group-info">
            <h4>{{ group.name }}</h4>
            <p>{{ group.members.length }} / {{ group.capacity }} Members • {{ group.lifeStage }}</p>
          </div>
          <ChevronRight :size="20" color="#B0BEC5" />
        </div>
        <div v-if="myDownlineGroups.length === 0" class="empty-state">
          <p>You don't have any members yet.</p>
        </div>
      </div>
    </div>

    <!-- Person Profile Modal -->
    <div v-if="showPersonModal && selectedPerson" class="modal-overlay" @click.self="showPersonModal = false">
      <div class="modal profile-modal">
        <button class="close-icon-btn" @click="showPersonModal = false"><X :size="24" /></button>
        
        <div class="profile-header">
          <div class="profile-avatar-lg">{{ selectedPerson.firstName.charAt(0) }}</div>
          <h3>{{ selectedPerson.firstName }} {{ selectedPerson.lastName }}</h3>
          <span class="role-badge">{{ selectedPerson.finalTags?.isDgroupLeader ? 'Leader' : 'Member' }}</span>
        </div>

        <div class="profile-details">
          <div class="detail-row">
            <span class="label">Age</span>
            <span class="value">{{ selectedPerson.age || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Gender</span>
            <span class="value">{{ selectedPerson.gender }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Life Stage</span>
            <span class="value">{{ selectedPerson.finalTags?.ageCategory || 'N/A' }}</span>
          </div>
          <div class="detail-row" v-if="!selectedPerson.finalTags?.isDgroupLeader">
            <span class="label">School</span>
            <span class="value">{{ selectedPerson.school || 'Not Indicated' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Detail Modal -->
    <div v-if="showGroupDetailModal && selectedGroup" class="modal-overlay" @click.self="showGroupDetailModal = false">
      <div class="modal full-height">
        <div class="modal-header">
          <h3>{{ selectedGroup.name }}</h3>
          <button class="close-btn" @click="showGroupDetailModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p class="stat">Total Members: {{ selectedGroup.members.length }}</p>
          <div class="member-list-full">
            <div 
              v-for="m in selectedGroup.members" 
              :key="m.id" 
              class="member-item clickable"
              @click="viewPerson(m)"
            >
              <span>{{ m.firstName }} {{ m.lastName }}</span>
              <span class="status-tag">{{ m.status }}</span>
            </div>
            <div v-if="selectedGroup.members.length === 0" class="empty-members">
              No members in this group yet.
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- CREATE NEW DGROUP MODAL -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal create-modal">
        <h3>New Dgroup</h3>
        
        <!-- Live Preview Section -->
        <div class="preview-section">
          <span class="preview-label">Preview</span>
          <div class="group-card preview-card">
            <div class="group-icon"><Users :size="24" color="white"/></div>
            <div class="group-info">
              <h4>{{ newGroupForm.name || 'Dgroup Name' }}</h4>
              <p>0 / {{ newGroupForm.capacity }} Members • {{ newGroupForm.lifeStage }}</p>
            </div>
            <ChevronRight :size="20" color="#B0BEC5" />
          </div>
        </div>

        <!-- Form Inputs -->
        <div class="form-group">
          <label>Dgroup Name</label>
          <input v-model="newGroupForm.name" placeholder="Ex. Elevate Baguio Boys" />
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Capacity</label>
            <input type="number" v-model="newGroupForm.capacity" min="1" />
          </div>
          <div class="form-group half">
            <label>Life Stage</label>
            <select v-model="newGroupForm.lifeStage">
              <option>Elevate</option>
              <option>B1G</option>
              <option>Mixed</option>
            </select>
          </div>
        </div>

        <div class="actions">
          <button @click="showCreateModal = false" class="cancel">Cancel</button>
          <button @click="createDgroup" class="confirm">Create</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dgroup-view { padding-top: 10px; }

.tabs { display: flex; background: #E3F2FD; padding: 4px; border-radius: 12px; margin-bottom: 20px; }
.tabs button { flex: 1; padding: 10px; border: none; background: transparent; border-radius: 8px; font-weight: 600; color: #546E7A; cursor: pointer; transition: all 0.2s; }
.tabs button.active { background: white; color: #1976D2; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

/* Leader Card */
.leader-card { background: white; padding: 20px; border-radius: 16px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 24px; transition: transform 0.2s; }
.leader-card.clickable { cursor: pointer; }
.leader-card.clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.missing-info-text { font-size: 11px; color: #B0BEC5; font-style: italic; }

.avatar-ring { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #1976D2; display: flex; align-items: center; justify-content: center; background: #E3F2FD; }
.leader-info .label { font-size: 11px; text-transform: uppercase; color: #78909C; font-weight: 700; }
.leader-info h3 { margin: 4px 0 0 0; font-size: 18px; color: #263238; }

/* Member List */
.members-list h4 { color: #546E7A; margin-bottom: 12px; }
.member-row { background: white; padding: 12px; border-bottom: 1px solid #ECEFF1; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
.member-row:first-of-type { border-radius: 12px 12px 0 0; }
.member-row:last-of-type { border-radius: 0 0 12px 12px; border-bottom: none; }
.member-row.clickable { cursor: pointer; }
.member-row.clickable:hover { background: #F5F5F5; }
.member-avatar { width: 32px; height: 32px; background: #ECEFF1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #546E7A; }

/* Group Card */
.groups-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.create-btn { background: #1976D2; color: white; border: none; padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; }

.group-card { background: white; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 12px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
.group-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #42A5F5, #1976D2); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.group-info { flex: 1; }
.group-info h4 { margin: 0 0 4px 0; color: #263238; font-size: 15px; }
.group-info p { margin: 0; font-size: 12px; color: #78909C; }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal { background: white; width: 90%; max-width: 400px; padding: 24px; border-radius: 16px; position: relative; }

/* Create Modal Specifics */
.create-modal { padding-top: 20px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: #546E7A; margin-bottom: 6px; }
.form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #CFD8DC; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.form-row { display: flex; gap: 12px; }
.form-group.half { flex: 1; }

.preview-section { margin-bottom: 20px; background: #F5F7FA; padding: 16px; border-radius: 12px; }
.preview-label { font-size: 11px; text-transform: uppercase; color: #90A4AE; font-weight: 700; display: block; margin-bottom: 8px; }
.preview-card { margin-bottom: 0; border: 1px solid #E0E0E0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); pointer-events: none; }

.actions { display: flex; gap: 10px; margin-top: 24px; }
.actions button { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
.confirm { background: #1976D2; color: white; }
.cancel { background: #ECEFF1; color: #333; }

.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; }
.modal-header { display: flex; justify-content: space-between; align-items: center; }
.member-item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
.member-item.clickable { cursor: pointer; transition: background 0.1s; }
.member-item.clickable:hover { background: #F5F5F5; }
.empty-members { text-align: center; color: #B0BEC5; padding: 20px; font-style: italic; font-size: 13px; }

/* Profile Modal */
.profile-modal { text-align: center; padding-top: 40px; }
.close-icon-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; color: #90A4AE; }
.profile-header { margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; }
.profile-avatar-lg { width: 80px; height: 80px; background: #E3F2FD; color: #1565C0; font-size: 32px; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.role-badge { background: #FFF3E0; color: #F57C00; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; margin-top: 8px; }

.profile-details { text-align: left; background: #FAFAFA; border-radius: 12px; padding: 16px; }
.detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #EEE; }
.detail-row:last-child { border-bottom: none; }
.detail-row .label { color: #78909C; font-size: 13px; font-weight: 500; }
.detail-row .value { color: #37474F; font-size: 14px; font-weight: 600; }
</style>