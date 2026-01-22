<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { User, Users, ChevronRight, Plus, X, AlertCircle, ArrowLeft, UserMinus, HelpCircle, Pencil } from 'lucide-vue-next'

const authStore = useAuthStore()
const membersStore = useMembersStore()

const activeTab = ref('upline') 
const showCreateModal = ref(false)
const showPersonModal = ref(false)
const showJoinByIdModal = ref(false)
const showEditGroupModal = ref(false)

// Join by ID logic
const dgroupIdInput = ref('')
const joinStatus = ref({ type: '', msg: '' })

// Edit Group Logic (Leader)
const editGroupForm = reactive({
  dgroupName: '',
  capacity: 12,
  dgroupId: ''
})

// Drill-down state 
const selectedGroup = ref(null) 
const currentGroupMembers = ref([])

const selectedPerson = ref(null) 
const mockGroups = ref([])

onMounted(() => {
  membersStore.fetchMembers()
})

const myProfile = computed(() => authStore.userProfile)
const isLeader = computed(() => myProfile.value?.finalTags?.isDgroupLeader)
const myLeaderName = computed(() => myProfile.value?.dgroupLeader)

// Seeker Logic: If not a leader, and no leader assigned, and NOT marked seeker yet
const showSeekerQuestionnaire = computed(() => {
  if (!myProfile.value) return false
  const p = myProfile.value
  return !p.finalTags.isDgroupLeader && !p.dgroupLeader && !p.finalTags.isSeeker
})

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

const myDownlineGroups = computed(() => {
  const groups = []
  if (isLeader.value) {
    const myName = `${myProfile.value?.firstName} ${myProfile.value?.lastName}`
    const members = membersStore.activeMembers.filter(m => m.dgroupLeader === myName)
    
    groups.push({
      id: myProfile.value.dgroupId || 'g-default',
      name: myProfile.value.dgroupName || `${myProfile.value?.firstName}'s Dgroup`,
      members: members,
      lifeStage: myProfile.value?.finalTags?.ageCategory || 'Mixed',
      capacity: myProfile.value?.dgroupCapacity || 12
    })
  }
  return [...groups, ...mockGroups.value]
})

function openGroupDetails(group) {
  currentGroupMembers.value = [...group.members]
  selectedGroup.value = group
}

function closeGroupDetails() {
  selectedGroup.value = null
  currentGroupMembers.value = []
}

function viewPerson(person) {
  if(!person) return
  selectedPerson.value = person
  showPersonModal.value = true
}

function removeMember(member) {
  if(confirm(`Are you sure you want to remove ${member.firstName} from this Dgroup?`)) {
    currentGroupMembers.value = currentGroupMembers.value.filter(m => m.id !== member.id)
  }
}

// --- Seeker Actions ---
async function handleSeekerYes() {
  if (!myProfile.value) return
  const updates = {
    finalTags: {
      ...myProfile.value.finalTags,
      isSeeker: true,
      isFirstTimer: false 
    }
  }
  try {
    await authStore.updateExtendedProfile(updates)
    alert("You have been marked as a Seeker. A leader will reach out to you soon!")
  } catch (e) {
    console.error(e)
    alert("Failed to update status.")
  }
}

function handleSeekerNo() {
  alert("No problem! Enjoy the services and events.")
}

// --- Join By ID ---
async function joinDgroupById() {
  joinStatus.value = { type: '', msg: '' }
  const idToFind = dgroupIdInput.value.trim();
  
  if (!idToFind) {
    joinStatus.value = { type: 'error', msg: 'Please enter a Dgroup ID' }
    return;
  }

  // Find the leader who owns this dgroupId
  const leader = membersStore.leaders.find(l => l.dgroupId === idToFind);

  if (!leader) {
    joinStatus.value = { type: 'error', msg: 'Dgroup ID not found.' }
    return;
  }

  // Join Logic
  const leaderName = `${leader.firstName} ${leader.lastName}`;
  const updates = {
    dgroupLeader: leaderName,
    finalTags: {
      ...myProfile.value.finalTags,
      isSeeker: false,
      isFirstTimer: false,
      isRegular: true
    }
  }

  try {
    await authStore.updateExtendedProfile(updates)
    joinStatus.value = { type: 'success', msg: `Successfully joined ${leaderName}'s group!` }
    setTimeout(() => {
        showJoinByIdModal.value = false;
        dgroupIdInput.value = '';
    }, 1500);
  } catch (e) {
    console.error(e)
    joinStatus.value = { type: 'error', msg: 'Failed to join group.' }
  }
}

// --- Edit Group (Leader Only) ---
function openEditGroupModal() {
  if (!myProfile.value) return
  editGroupForm.dgroupName = myProfile.value.dgroupName || ''
  editGroupForm.capacity = myProfile.value.dgroupCapacity || 12
  editGroupForm.dgroupId = myProfile.value.dgroupId || 'N/A'
  showEditGroupModal.value = true
}

async function saveGroupDetails() {
  if (!editGroupForm.dgroupName) return alert("Group name is required")
  
  try {
    await authStore.updateExtendedProfile({
      dgroupName: editGroupForm.dgroupName,
      dgroupCapacity: editGroupForm.capacity
    })
    showEditGroupModal.value = false
    alert("Group details updated!")
  } catch (e) {
    console.error(e)
    alert("Failed to save changes.")
  }
}
</script>

<template>
  <div class="dgroup-view">
    
    <!-- SEEKER QUESTIONNAIRE (First Timers / Unassigned) -->
    <div v-if="showSeekerQuestionnaire" class="seeker-prompt">
      <div class="icon-circle">
        <HelpCircle :size="32" color="#1976D2" />
      </div>
      <h3>Looking for a Dgroup?</h3>
      <p>It looks like you aren't part of a Discipleship Group yet.</p>
      
      <div class="question-box">
        <p class="question">How would you like to proceed?</p>
        <div class="seeker-actions">
          <button class="btn-action primary" @click="handleSeekerYes">
            I'm looking for a group
          </button>
          <button class="btn-action secondary" @click="showJoinByIdModal = true">
            I have a Dgroup ID
          </button>
          <button class="btn-action text-only" @click="handleSeekerNo">
            Not right now
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <!-- Normal Dgroup View -->
      
      <!-- Tab Switcher -->
      <div class="tabs" v-if="!selectedGroup">
        <button :class="{ active: activeTab === 'upline' }" @click="activeTab = 'upline'">
          My Dgroup (Upline)
        </button>
        <button v-if="isLeader" :class="{ active: activeTab === 'downline' }" @click="activeTab = 'downline'">
          My Groups (Downline)
        </button>
      </div>

      <!-- UPLINE VIEW -->
      <div v-if="activeTab === 'upline' && !selectedGroup" class="tab-content">
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
          <p v-if="myProfile?.finalTags.isSeeker">
            You are listed as a <strong>Seeker</strong>. Waiting for a leader to add you.
          </p>
          <p v-else>You are not assigned to a Dgroup yet.</p>
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
        
        <!-- 1. GROUPS GRID -->
        <div v-if="!selectedGroup">
          <div class="groups-header">
            <h3>Your Groups</h3>
            <button class="create-btn" @click="openEditGroupModal"><Pencil :size="16" /> Edit Details</button>
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

        <!-- 2. GROUP DETAIL LIST VIEW -->
        <div v-else class="drill-down-view">
          <div class="drill-header">
            <button @click="closeGroupDetails" class="back-btn">
              <ArrowLeft :size="20" />
            </button>
            <div class="header-info">
              <h3>{{ selectedGroup.name }}</h3>
              <span class="subtitle">{{ currentGroupMembers.length }} / {{ selectedGroup.capacity }} Members</span>
            </div>
          </div>

          <div class="members-list-full">
            <div 
              v-for="m in currentGroupMembers" 
              :key="m.id" 
              class="member-row clickable"
              @click="viewPerson(m)"
            >
              <div class="member-avatar">{{ m.firstName.charAt(0) }}</div>
              <div class="member-name-col">
                <span class="name">{{ m.firstName }} {{ m.lastName }}</span>
                <span class="status-sub">{{ m.status }}</span>
              </div>
              
              <button class="icon-btn remove" @click.stop="removeMember(m)" title="Remove Member">
                <UserMinus :size="18" />
              </button>
            </div>

            <div v-if="currentGroupMembers.length === 0" class="empty-members">
              <AlertCircle :size="32" color="#B0BEC5" />
              <p>No members in this group yet.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
    
    <!-- JOIN BY ID MODAL -->
    <div v-if="showJoinByIdModal" class="modal-overlay" @click.self="showJoinByIdModal = false">
      <div class="modal create-modal">
        <h3>Join by Dgroup ID</h3>
        <p class="modal-desc">Ask your leader for their Dgroup ID code.</p>
        
        <div class="form-group">
          <label>Dgroup ID</label>
          <input v-model="dgroupIdInput" placeholder="e.g. DG-26-1234" />
        </div>
        
        <div v-if="joinStatus.msg" class="status-msg" :class="joinStatus.type">
          {{ joinStatus.msg }}
        </div>

        <div class="actions">
          <button @click="showJoinByIdModal = false" class="cancel">Cancel</button>
          <button @click="joinDgroupById" class="confirm">Join Group</button>
        </div>
      </div>
    </div>

    <!-- EDIT GROUP MODAL (Leader) -->
    <div v-if="showEditGroupModal" class="modal-overlay">
      <div class="modal create-modal">
        <h3>Edit Group Details</h3>
        
        <div class="form-group">
          <label>Group Name</label>
          <input v-model="editGroupForm.dgroupName" />
        </div>

        <div class="form-group">
          <label>Capacity</label>
          <input type="number" v-model="editGroupForm.capacity" min="1" />
        </div>
        
        <div class="form-group">
          <label>Dgroup ID (Read Only)</label>
          <input :value="editGroupForm.dgroupId" disabled class="disabled-input" />
        </div>

        <div class="actions">
          <button @click="showEditGroupModal = false" class="cancel">Cancel</button>
          <button @click="saveGroupDetails" class="confirm">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Person Profile Modal -->
    <div v-if="showPersonModal && selectedPerson" class="modal-overlay person-overlay" @click.self="showPersonModal = false">
      <div class="modal profile-modal">
        <button class="close-icon-btn" @click="showPersonModal = false"><X :size="24" /></button>
        
        <div class="profile-header">
          <div class="profile-avatar-lg">{{ selectedPerson.firstName.charAt(0) }}</div>
          <h3>{{ selectedPerson.firstName }} {{ selectedPerson.lastName }}</h3>
          <span class="role-badge">{{ selectedPerson.finalTags?.isDgroupLeader ? 'Leader' : 'Member' }}</span>
        </div>

        <div class="profile-details">
          <div class="detail-row">
            <span class="label">Life Stage</span>
            <span class="value">{{ selectedPerson.finalTags?.ageCategory || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Birthday</span>
            <span class="value">{{ selectedPerson.birthday || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Facebook</span>
            <span class="value link-color">{{ selectedPerson.fbAccount || 'Not Linked' }}</span>
          </div>
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

/* Member List Style */
.members-list h4 { color: #546E7A; margin-bottom: 12px; }
.member-row { background: white; padding: 12px; border-bottom: 1px solid #ECEFF1; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
.member-row:first-of-type { border-radius: 12px 12px 0 0; }
.member-row:last-of-type { border-radius: 0 0 12px 12px; border-bottom: none; }
.member-row.clickable { cursor: pointer; }
.member-row.clickable:hover { background: #F5F5F5; }
.member-avatar { width: 32px; height: 32px; background: #ECEFF1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #546E7A; flex-shrink: 0; }
.member-name { font-weight: 600; color: #37474F; font-size: 14px; }
.member-name-col { display: flex; flex-direction: column; flex: 1; }
.member-name-col .name { font-weight: 600; color: #37474F; font-size: 14px; }
.member-name-col .status-sub { font-size: 11px; color: #90A4AE; text-transform: capitalize; }

/* remove button */
.icon-btn { background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.2s; display: flex; align-items: center; justify-content: center; }
.icon-btn.remove { color: #B0BEC5; }
.icon-btn.remove:hover { background: #FFEBEE; color: #D32F2F; }

/* Group Card */
.groups-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.create-btn { background: #E3F2FD; color: #1976D2; border: none; padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; cursor: pointer; }

.group-card { background: white; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 12px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
.group-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #42A5F5, #1976D2); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.group-info { flex: 1; }
.group-info h4 { margin: 0 0 4px 0; color: #263238; font-size: 15px; }
.group-info p { margin: 0; font-size: 12px; color: #78909C; }

.drill-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.back-btn { background: #ECEFF1; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #546E7A; transition: background 0.2s; }
.back-btn:hover { background: #CFD8DC; }
.drill-header h3 { margin: 0; font-size: 18px; color: #263238; }
.drill-header .subtitle { font-size: 12px; color: #78909C; }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; }
.person-overlay { z-index: 200; }

.modal { background: white; width: 90%; max-width: 400px; padding: 24px; border-radius: 16px; position: relative; }

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
.empty-members { text-align: center; color: #B0BEC5; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 13px; }

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
.link-color { color: #1976D2; text-decoration: underline; }

/* Seeker Prompt Styles */
.seeker-prompt {
  background: white;
  padding: 30px 20px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-top: 20px;
}
.icon-circle {
  width: 60px; height: 60px; background: #E3F2FD; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
}
.seeker-prompt h3 { margin: 0 0 8px; color: #1976D2; font-size: 20px; }
.seeker-prompt p { color: #546E7A; margin: 0 0 24px; font-size: 14px; }
.question-box { background: #F5F7FA; border-radius: 12px; padding: 20px; }
.question { font-weight: 700; font-size: 16px; margin-bottom: 16px; color: #37474F; }
.seeker-actions { display: flex; flex-direction: column; gap: 10px; }
.btn-action { padding: 12px; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; width: 100%; font-size: 14px; }
.btn-action.primary { background: #1976D2; color: white; }
.btn-action.secondary { background: white; border: 1px solid #CFD8DC; color: #37474F; }
.btn-action.text-only { background: transparent; color: #78909C; margin-top: 4px; }

.modal-desc { color: #546E7A; font-size: 14px; margin-bottom: 20px; margin-top: -10px; }
.status-msg { margin-top: 10px; padding: 10px; border-radius: 8px; font-size: 13px; text-align: center; }
.status-msg.error { background: #FFEBEE; color: #D32F2F; }
.status-msg.success { background: #E8F5E9; color: #2E7D32; }
.disabled-input { background: #e0e0e0; color: #757575; border-color: #bdbdbd; cursor: not-allowed; }
</style>