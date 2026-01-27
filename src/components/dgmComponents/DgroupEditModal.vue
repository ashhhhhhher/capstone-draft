<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '../../stores/members'
import { storeToRefs } from 'pinia'
import { UserMinus, ArrowRightLeft, Save, X } from 'lucide-vue-next'

const props = defineProps({
  group: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const membersStore = useMembersStore()
const { leaders } = storeToRefs(membersStore)

// Local state for transfer logic
const transferModeMap = ref({}) // { memberId: boolean }
const targetLeaderMap = ref({}) // { memberId: newLeaderName }

// --- Computed ---
// Filter leaders to exclude current one and ensure gender match
const availableLeaders = computed(() => {
  return leaders.value
    .filter(l => l.gender === props.group.leaderGender)
    .filter(l => `${l.firstName} ${l.lastName}` !== props.group.leaderName)
    .map(l => `${l.firstName} ${l.lastName}`)
    .sort()
})

// --- Actions ---
async function removeMember(member) {
  if (!confirm(`Are you sure you want to remove ${member.firstName} from this DGroup?`)) return

  try {
    const updated = { ...member, dgroupLeader: null }
    // Optional: Reset tags if required, but safer to keep them as Regular/Seeker unless specific logic exists
    await membersStore.updateMember(updated)
    // Remove from local list visually immediately or let reactivity handle it (reactivity handles it via props)
  } catch (error) {
    alert("Error removing member: " + error.message)
  }
}

function enableTransfer(memberId) {
  transferModeMap.value[memberId] = true
  targetLeaderMap.value[memberId] = ''
}

function cancelTransfer(memberId) {
  transferModeMap.value[memberId] = false
  delete targetLeaderMap.value[memberId]
}

async function saveTransfer(member) {
  const newLeader = targetLeaderMap.value[member.id]
  if (!newLeader) {
    alert("Please select a new leader.")
    return
  }

  if (!confirm(`Transfer ${member.firstName} to ${newLeader}'s DGroup?`)) return

  try {
    const updated = { ...member, dgroupLeader: newLeader }
    await membersStore.updateMember(updated)
    transferModeMap.value[member.id] = false
  } catch (error) {
    alert("Error transferring member: " + error.message)
  }
}
</script>

<template>
  <div class="edit-modal-container">
    <div class="modal-header">
      <div>
        <h3>Manage DGroup</h3>
        <p class="subtitle">{{ group.leaderName }}'s Group</p>
      </div>
      <div class="capacity-badge">
        {{ group.members.length }} / {{ group.capacity }} Members
      </div>
    </div>

    <div class="members-list-container">
      <div v-if="group.members.length === 0" class="empty-state">
        No members in this group yet.
      </div>

      <div v-else class="list-rows">
        <div 
          v-for="member in group.members" 
          :key="member.id" 
          class="member-row"
        >
          <!-- View Mode -->
          <div class="member-info">
            <span class="member-name">{{ member.firstName }} {{ member.lastName }}</span>
            <span class="member-role" v-if="member.finalTags.isVolunteer">Volunteer</span>
          </div>

          <!-- Actions -->
          <div class="actions-area">
            
            <!-- Transfer Mode UI -->
            <div v-if="transferModeMap[member.id]" class="transfer-ui">
              <select v-model="targetLeaderMap[member.id]" class="leader-select">
                <option value="" disabled>Select Leader</option>
                <option v-for="l in availableLeaders" :key="l" :value="l">{{ l }}</option>
              </select>
              <button class="action-btn save" @click="saveTransfer(member)" title="Save">
                <Save :size="16" />
              </button>
              <button class="action-btn cancel" @click="cancelTransfer(member.id)" title="Cancel">
                <X :size="16" />
              </button>
            </div>

            <!-- Default Buttons -->
            <div v-else class="default-buttons">
              <button class="action-btn transfer" @click="enableTransfer(member.id)" title="Transfer to another group">
                <ArrowRightLeft :size="16" />
              </button>
              <button class="action-btn remove" @click="removeMember(member)" title="Remove from group">
                <UserMinus :size="16" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="close-main-btn" @click="emit('close')">Done</button>
    </div>
  </div>
</template>

<style scoped>
.edit-modal-container {
  padding: 8px;
  min-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
}

.modal-header h3 {
  margin: 0;
  color: #263238;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #546E7A;
}

.capacity-badge {
  background: #E3F2FD;
  color: #1565C0;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.members-list-container {
  max-height: 50vh;
  overflow-y: auto;
}

.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #F5F7F9;
}

.member-row:last-child {
  border-bottom: none;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-weight: 600;
  font-size: 14px;
  color: #37474F;
}

.member-role {
  font-size: 11px;
  color: #78909C;
  background: #F5F5F5;
  width: fit-content;
  padding: 1px 6px;
  border-radius: 4px;
  margin-top: 2px;
}

.actions-area {
  display: flex;
  align-items: center;
}

.default-buttons {
  display: flex;
  gap: 8px;
}

.transfer-ui {
  display: flex;
  gap: 6px;
  align-items: center;
}

.leader-select {
  padding: 6px;
  border: 1px solid #CFD8DC;
  border-radius: 6px;
  font-size: 12px;
  max-width: 150px;
}

.action-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.transfer { background: #E3F2FD; color: #1976D2; }
.action-btn.transfer:hover { background: #BBDEFB; }

.action-btn.remove { background: #FFEBEE; color: #C62828; }
.action-btn.remove:hover { background: #FFCDD2; }

.action-btn.save { background: #E8F5E9; color: #2E7D32; }
.action-btn.cancel { background: #ECEFF1; color: #546E7A; }

.empty-state {
  text-align: center;
  padding: 20px;
  color: #90A4AE;
  font-style: italic;
}

.modal-footer {
  margin-top: 20px;
  text-align: right;
}

.close-main-btn {
  background: #1976D2;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.close-main-btn:hover {
  background: #1565C0;
}
</style>