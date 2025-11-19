<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance'
import { Archive, RotateCcw } from 'lucide-vue-next' 

const props = defineProps({
  member: Object
})

const emit = defineEmits(['close', 'saveChanges', 'archiveMember', 'restoreMember'])

const membersStore = useMembersStore()
const { leaders } = storeToRefs(membersStore) 
const attendanceStore = useAttendanceStore()
const { allAttendance } = storeToRefs(attendanceStore);

const isEditMode = ref(false)
const showArchiveConfirmation = ref(false)
const editableMember = ref(JSON.parse(JSON.stringify(props.member)))

if (!Array.isArray(editableMember.value.finalTags.volunteerMinistry)) {
  editableMember.value.finalTags.volunteerMinistry = []
}

// --- Attendance Status Logic ---
const memberAttendanceStatus = computed(() => {
  const memberId = props.member.id;
  const isPresentToday = attendanceStore.currentEventAttendees.some(att => att.memberId === memberId);
  if (isPresentToday) return 'Present Today';
  
  const lastAttendance = allAttendance.value
    .filter(att => att.memberId === memberId)
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())[0]; 

  if (lastAttendance) {
    const date = lastAttendance.timestamp.toDate();
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Last seen: ${formattedDate}`;
  }
  return 'Never Attended';
});

// --- Helper Computeds ---
const isArchived = computed(() => props.member.status === 'archived')

const dgroupLeadersList = computed(() => {
  if (!editableMember.value.gender) return [] 
  return leaders.value
    .filter(leader => leader.gender === editableMember.value.gender)
    .map(leader => `${leader.firstName} ${leader.lastName}`)
})

const allTags = computed(() => {
  const tags = []
  if (props.member.finalTags.ageCategory) tags.push(props.member.finalTags.ageCategory)
  if (props.member.finalTags.isFirstTimer) tags.push('First Timer')
  if (props.member.finalTags.isSeeker) tags.push('Seeker')
  if (props.member.finalTags.isRegular) tags.push('Regular')
  if (props.member.finalTags.isDgroupLeader) tags.push('Dgroup Leader')
  if (props.member.finalTags.isVolunteer && props.member.finalTags.volunteerMinistry) {
    props.member.finalTags.volunteerMinistry.forEach(ministry => {
      tags.push(ministry);
    });
  }
  return tags
})

const editableAge = computed(() => {
  if (!editableMember.value.birthday) return null
  const today = new Date()
  const birthDate = new Date(editableMember.value.birthday)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
})

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function save() {
  if (editableMember.value.finalTags.isRegular && !editableMember.value.dgroupLeader) {
    alert('A "Regular Member" must be assigned to a Dgroup Leader.');
    return;
  }
  editableMember.value.age = editableAge.value
  if (editableAge.value >= 12 && editableAge.value <= 21) {
    editableMember.value.finalTags.ageCategory = 'Elevate'
  } else if (editableAge.value >= 22) {
    editableMember.value.finalTags.ageCategory = 'B1G'
  } else {
    editableMember.value.finalTags.ageCategory = 'N/A'
  }
  
  if (!editableMember.value.finalTags.isDgroupLeader) {
    editableMember.value.dgroupCapacity = null
  }
  
  editableMember.value.lastName = toTitleCase(editableMember.value.lastName.trim());
  editableMember.value.firstName = toTitleCase(editableMember.value.firstName.trim());
  editableMember.value.middleInitial = editableMember.value.middleInitial.toUpperCase().trim();
  editableMember.value.school = toTitleCase(editableMember.value.school.trim());
  editableMember.value.email = editableMember.value.email.trim();
  editableMember.value.fbAccount = editableMember.value.fbAccount.trim();
  editableMember.value.contactNumber = editableMember.value.contactNumber.trim();
  
  emit('saveChanges', editableMember.value)
  isEditMode.value = false
}

function cancelEdit() {
  editableMember.value = JSON.parse(JSON.stringify(props.member))
  if (!Array.isArray(editableMember.value.finalTags.volunteerMinistry)) {
    editableMember.value.finalTags.volunteerMinistry = []
  }
  isEditMode.value = false
}

function confirmArchive() {
  emit('archiveMember', props.member.id)
  showArchiveConfirmation.value = false
}

function confirmRestore() {
  emit('restoreMember', props.member.id)
}
</script>

<template>
  <div class="details-modal-container">
    
    <!-- 1. HEADER -->
    <div class="modal-header-section">
      <div v-if="!isEditMode && !showArchiveConfirmation" class="modal-header">
        <div class="header-text">
          <h2>{{ member.firstName }} {{ member.lastName }}</h2>
          <div class="status-badges">
            <span class="member-id">ID: {{ member.id }}</span>
            <span v-if="isArchived" class="archived-badge">ARCHIVED</span>
          </div>
        </div>
        <button class="btn-primary" @click="isEditMode = true">Edit</button>
      </div>
      <h3 v-if="isEditMode" class="modal-title">Edit Member Details</h3>
      <h3 v-if="showArchiveConfirmation" class="modal-title delete-header">Archive Member</h3>
    </div>

    <!-- 2. BODY -->
    <div class="modal-body-scrollable">

      <!-- Archive Confirmation -->
      <div v-if="showArchiveConfirmation" class="delete-confirmation">
        <p>
          Are you sure you want to archive 
          <strong>{{ member.firstName }} {{ member.lastName }}</strong>?
        </p>
        <p class="warning-text">
          They will be hidden from the main lists but their attendance history is preserved. You can restore them later.
        </p>
        <div class="button-group">
          <button class="btn-secondary" @click="showArchiveConfirmation = false">Cancel</button>
          <button class="btn-danger" @click="confirmArchive">Confirm Archive</button>
        </div>
      </div>

      <!-- Edit View -->
      <div v-else-if="isEditMode" class="edit-view">
        <h4>Personal Information</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Last Name</label>
            <input type="text" v-model="editableMember.lastName">
          </div>
          <div class="form-group">
            <label>First Name</label>
            <input type="text" v-model="editableMember.firstName">
          </div>
           <div class="form-group">
            <label>M.I.</label>
            <input type="text" v-model="editableMember.middleInitial" maxlength="2">
          </div>
          <div class="form-group">
            <label>Birthday</label>
            <input type="date" v-model="editableMember.birthday">
          </div>
          <div class="form-group">
            <label>Gender</label>
            <select v-model="editableMember.gender">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
           <div class="form-group">
            <label>School/Workplace</label>
            <input type="text" v-model="editableMember.school">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" v-model="editableMember.email">
          </div>
          <div class="form-group">
            <label>Contact Number</label>
            <input type="tel" v-model="editableMember.contactNumber">
          </div>
          <div class="form-group">
            <label>Facebook</label>
            <input type="text" v-model="editableMember.fbAccount">
          </div>
        </div>
        
        <h4>Church Information</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Dgroup Leader</label>
            <select v-model="editableMember.dgroupLeader">
              <option value="">N/A (First Timer)</option>
              <option v-for="leader in dgroupLeadersList" :key="leader" :value="leader">
                {{ leader }}
              </option>
            </select>
          </div>
        </div>
        <div class="button-group">
          <button class="btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="btn-primary" @click="save">Save Changes</button>
        </div>
      </div>

      <!-- Default View -->
      <div v-else class="view-mode">
        <div class="tag-list">
          <span v-for="tag in allTags" :key="tag" class="tag">{{ tag }}</span>
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <span class="label">Email</span>
            <span class="value">{{ member.email || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Contact Number</span>
            <span class="value">{{ member.contactNumber || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Facebook</span>
            <span class="value">{{ member.fbAccount || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Gender</span>
            <span class="value">{{ member.gender }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Birthday</span>
            <span class="value">{{ member.birthday }} (Age: {{ member.age }})</span>
          </div>
          <div class="detail-item">
            <span class="label">School/Workplace</span>
            <span class="value">{{ member.school || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Dgroup Leader</span>
            <span class="value">{{ member.dgroupLeader || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Attendance</span>
            <span class="value">{{ memberAttendanceStatus }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. FOOTER -->
    <div class="modal-footer-section">
      <!-- ARCHIVE / RESTORE ACTIONS -->
      <div v-if="!isEditMode && !showArchiveConfirmation" class="danger-zone">
        
        <button v-if="isArchived" class="btn-restore" @click="confirmRestore">
          <RotateCcw :size="16" /> Restore Member
        </button>
        
        <button v-else class="btn-danger-outline" @click="showArchiveConfirmation = true">
          <Archive :size="16" /> Archive Member
        </button>
        
      </div>
    </div>

  </div>
</template>

<style scoped>
.details-modal-container {
  display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; height: 100%;
}
.modal-header-section {
  flex-shrink: 0; padding-bottom: 16px; border-bottom: 1px solid #ECEFF1;
}
.modal-body-scrollable {
  overflow-y: auto; flex-grow: 1; padding-top: 20px; padding-right: 16px; margin-right: -16px;
}
.modal-footer-section {
  flex-shrink: 0; padding-top: 16px; border-top: 1px solid #ECEFF1;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-danger-outline, .btn-restore {
  border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px;
  font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
}
.btn-primary { background-color: #1976D2; color: white; }
.btn-secondary { background-color: #CFD8DC; color: #37474F; }
.btn-danger { background-color: #D32F2F; color: white; }
.btn-danger-outline { background-color: transparent; color: #D32F2F; border: 1px solid #D32F2F; }
.btn-restore { background-color: #2E7D32; color: white; }

.button-group { display: flex; justify-content: flex-end; gap: 12px; }

/* Form Styles */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #333; font-size: 14px; }
.form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #B0BEC5; border-radius: 8px; box-sizing: border-box; font-size: 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.modal-title { font-size: 20px; font-weight: 600; margin: 0; }
.delete-header { color: #D32F2F; }
.edit-view h4 { font-size: 16px; font-weight: 600; color: #0D47A1; border-bottom: 2px solid #E3F2FD; padding-bottom: 8px; margin-top: 16px; margin-bottom: 16px; }
.edit-view h4:first-of-type { margin-top: 0; }
.tag-group { display: flex; flex-direction: column; gap: 12px; }
.checkbox-item { display: flex; align-items: center; gap: 10px; }
.checkbox-item input { width: auto; }
.checkbox-item label { margin: 0; font-weight: 400; font-size: 14px; }
.indented { margin-left: 28px; margin-top: 10px; }
.checkbox-subgroup { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }

/* View Mode */
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; }
.modal-header h2 { margin: 0; color: #333; }
.status-badges { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.member-id { font-size: 14px; color: #546E7A; }
.archived-badge { background: #455A64; color: white; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }

.tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tag { background-color: #E3F2FD; color: #0D47A1; padding: 4px 10px; border-radius: 16px; font-size: 12px; font-weight: 500; }
.details-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 640px) { .details-grid { grid-template-columns: 1fr 1fr; } }
.detail-item { background-color: #f9f9f9; padding: 12px; border-radius: 8px; }
.detail-item .label { display: block; font-size: 12px; font-weight: 500; color: #546E7A; margin-bottom: 4px; }
.detail-item .value { display: block; font-size: 14px; font-weight: 600; color: #333; word-wrap: break-word; }

.danger-zone { display: flex; justify-content: flex-end; gap: 10px; }
.warning-text { color: #546E7A; font-size: 14px; margin-bottom: 20px; }
</style>