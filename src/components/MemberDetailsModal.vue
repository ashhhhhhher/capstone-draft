<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../stores/members'
import { useAttendanceStore } from '../stores/attendance' // 1. Import Attendance Store

const props = defineProps({
  member: Object
})

const emit = defineEmits(['close', 'saveChanges', 'deleteMember'])

// --- Store Setup ---
const membersStore = useMembersStore()
const { leaders } = storeToRefs(membersStore) 
const attendanceStore = useAttendanceStore() // 2. Initialize Attendance Store
const { allAttendance } = storeToRefs(attendanceStore); // 3. Get ALL historical data

// --- Mode State (unchanged) ---
const isEditMode = ref(false)
const showDeleteConfirmation = ref(false)
const adminPasswordInput = ref('')
const deleteError = ref('')
const editableMember = ref(JSON.parse(JSON.stringify(props.member)))

// Helper function to get the member's last attendance timestamp or status
const memberAttendanceStatus = computed(() => {
  const memberId = props.member.id;
  
  // 1. Check if Present Today (using the current event attendees set)
  // Since we can't access currentEventAttendees here easily, we'll check history:
  const isPresentToday = attendanceStore.currentEventAttendees.some(att => att.memberId === memberId);
  if (isPresentToday) {
    return 'Present Today';
  }
  
  // 2. Find the last time they attended *any* event
  const lastAttendance = allAttendance.value
    .filter(att => att.memberId === memberId)
    // CRITICAL: Sort by timestamp (which is a Firebase Timestamp object)
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())[0]; 

  if (lastAttendance) {
    const date = lastAttendance.timestamp.toDate();
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Last seen: ${formattedDate}`;
  }
  
  return 'Never Attended';
});

// (Other computed properties and functions are unchanged)
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
    alert('A "Regular Member" must be assigned to a Dgroup Leader. Please select a leader or uncheck "Regular Member".');
    return;
  }
  
  // 🚀 AUTOMATION: When first-timer gets assigned to D-group, automatically tag as regular
  if (editableMember.value.finalTags.isFirstTimer && editableMember.value.dgroupLeader) {
    editableMember.value.finalTags.isFirstTimer = false;
    editableMember.value.finalTags.isRegular = true;
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

function startDelete() {
  showDeleteConfirmation.value = true
}

function cancelDelete() {
  showDeleteConfirmation.value = false
  adminPasswordInput.value = ''
  deleteError.value = ''
}

function confirmDelete() {
  deleteError.value = ''
  if (adminPasswordInput.value.trim() === 'admin123') {
    emit('deleteMember', props.member.id)
  } else {
    deleteError.value = 'Incorrect password. Deletion cancelled.'
  }
}
</script>

<template>
  <div class="details-modal-container">
    
    <!-- 1. HEADER (Stays at the top) -->
    <div class="modal-header-section">
      <div v-if="!isEditMode && !showDeleteConfirmation" class="modal-header">
        <div class="header-text">
          <h2>{{ member.firstName }} {{ member.lastName }}</h2>
          <p class="member-id">Member ID: {{ member.id }}</p>
        </div>
        <button class="btn-primary" @click="isEditMode = true">Edit</button>
      </div>
      <h3 v-if="isEditMode" class="modal-title">Edit Member Details</h3>
      <h3 v-if="showDeleteConfirmation" class="modal-title delete-header">Delete Member</h3>
    </div>

    <!-- 2. BODY (This is the only part that scrolls) -->
    <div class="modal-body-scrollable">

      <!-- Delete View -->
      <div v-if="showDeleteConfirmation" class="delete-confirmation">
        <p>
          Are you sure you want to permanently delete 
          <strong>{{ member.firstName }} {{ member.lastName }}</strong>?
          This action cannot be undone.
        </p>
        <p>Please enter the admin password to confirm:</p>
        <div class="form-group">
          <label for="admin-password">Admin Password</label>
          <input 
            type="password" 
            id="admin-password" 
            v-model="adminPasswordInput"
            placeholder="Enter password..."
            @keyup.enter="confirmDelete"
          >
        </div>
        <p v-if="deleteError" class="error-message">{{ deleteError }}</p>
      </div>

      <!-- Edit View -->
      <div v-else-if="isEditMode" class="edit-view">
        <h4>Personal Information</h4>
        <div class="form-grid">
          <div class="form-group">
            <label for="edit-lastName">Last Name</label>
            <input type="text" id="edit-lastName" v-model="editableMember.lastName">
          </div>
          <div class="form-group">
            <label for="edit-firstName">First Name</label>
            <input type="text" id="edit-firstName" v-model="editableMember.firstName">
          </div>
          <div class="form-group">
            <label for="edit-middleInitial">M.I.</label>
            <input type="text" id="edit-middleInitial" v-model="editableMember.middleInitial" maxlength="2">
          </div>
          <div class="form-group">
            <label for="edit-birthday">Birthday</label>
            <input type="date" id="edit-birthday" v-model="editableMember.birthday">
          </div>
          <div class="form-group">
            <label for="edit-gender">Gender</label>
            <select id="edit-gender" v-model="editableMember.gender">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-school">School/Workplace</label>
            <input type="text" id="edit-school" v-model="editableMember.school">
          </div>
          <div class="form-group">
            <label for="edit-email">Email</label>
            <input type="email" id="edit-email" v-model="editableMember.email">
          </div>
          <div class="form-group">
            <label for="edit-contact">Contact Number</label>
            <input type="tel" id="edit-contact" v-model="editableMember.contactNumber">
          </div>
          <div class="form-group">
            <label for="edit-facebook">Facebook Account</label>
            <input type="text" id="edit-facebook" v-model="editableMember.fbAccount">
          </div>
        </div>
        
        <h4>Church Information</h4>
        <div class="form-grid">
          <div class="form-group">
            <label for="edit-dgroupLeader">Dgroup Leader</label>
            <select id="edit-dgroupLeader" v-model="editableMember.dgroupLeader">
              <option value="">N/A (First Timer)</option>
              <option v-for="leader in dgroupLeadersList" :key="leader" :value="leader">
                {{ leader }}
              </option>
            </select>
          </div>
        </div>

        <h4>Category Tags</h4>
        <div class="tag-group">
          <div class="checkbox-item">
            <input type="checkbox" id="edit-isRegular" v-model="editableMember.finalTags.isRegular" />
            <label for="edit-isRegular">Regular Member</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="edit-isFirstTimer" v-model="editableMember.finalTags.isFirstTimer" />
            <label for="edit-isFirstTimer">First Timer</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="edit-isSeeker" v-model="editableMember.finalTags.isSeeker" />
            <label for="edit-isSeeker">Seeker (Needs Dgroup)</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="edit-isDgroupLeader" v-model="editableMember.finalTags.isDgroupLeader" />
            <label for="edit-isDgroupLeader">Dgroup Leader</label>
          </div>
          
          <div v-if="editableMember.finalTags.isDgroupLeader" class="form-group indented">
            <label for="edit-dgroupCapacity">Dgroup Capacity</label>
            <input type="number" id="edit-dgroupCapacity" v-model="editableMember.dgroupCapacity" min="1" />
          </div>
          
          <div class="checkbox-item">
            <input type="checkbox" id="edit-isVolunteer" v-model="editableMember.finalTags.isVolunteer" />
            <label for="edit-isVolunteer">Volunteer</label>
          </div>
          
          <div v-if="editableMember.finalTags.isVolunteer" class="form-group indented">
            <label>Volunteer Ministry (Select all that apply):</label>
            <div class="checkbox-subgroup">
              <div class="checkbox-item">
                <input type="checkbox" id="edit-vol-liveprod" value="Live Prod" v-model="editableMember.finalTags.volunteerMinistry" />
                <label for="edit-vol-liveprod">Live Prod</label>
              </div>
              <div class="checkbox-item">
                <input type="checkbox" id="edit-vol-host" value="Host" v-model="editableMember.finalTags.volunteerMinistry" />
                <label for="edit-vol-host">Host</label>
              </div>
              <div class="checkbox-item">
                <input type="checkbox" id="edit-vol-exalt" value="Exalt" v-model="editableMember.finalTags.volunteerMinistry" />
                <label for="edit-vol-exalt">Exalt (Worship)</label>
              </div>
              <div class="checkbox-item">
                <input type="checkbox" id="edit-vol-usher" value="Usher" v-model="editableMember.finalTags.volunteerMinistry" />
                <label for="edit-vol-usher">Usher</label>
              </div>
            </div>
          </div>
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
          <!-- NEW: Attendance Status from computed property -->
          <div class="detail-item">
            <span class="label">Attendance</span>
            <span class="value">{{ memberAttendanceStatus }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. FOOTER (Stays at the bottom) -->
    <div class="modal-footer-section">
      <div v-if="showDeleteConfirmation" class="button-group">
        <button class="btn-secondary" @click="cancelDelete">Cancel</button>
        <button class="btn-danger" @click="confirmDelete">Confirm Delete</button>
      </div>
      <div v-else-if="isEditMode" class="button-group">
        <button class="btn-secondary" @click="cancelEdit">Cancel</button>
        <button class="btn-primary" @click="save">Save Changes</button>
      </div>
      <div v-else class="danger-zone">
        <button class="btn-danger-outline" @click="startDelete">
          Delete Member
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- New Container Styles --- */
.details-modal-container {
  display: flex;
  flex-direction: column;
  flex-grow: 1; 
  overflow: hidden; 
  height: 100%;
}
.modal-header-section {
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #ECEFF1;
}
.modal-body-scrollable {
  overflow-y: auto; /* This is the scrollbar! */
  flex-grow: 1;
  padding-top: 20px;
  padding-right: 16px;
  margin-right: -16px;
}
.modal-footer-section {
  flex-shrink: 0;
  padding-top: 16px;
  border-top: 1px solid #ECEFF1;
}

/* --- Button Styles --- */
.btn-primary, .btn-secondary, .btn-danger, .btn-danger-outline {
  border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px;
  font-weight: 600; cursor: pointer;
}
.btn-primary { background-color: #1976D2; color: white; }
.btn-secondary { background-color: #CFD8DC; color: #37474F; }
.btn-danger { background-color: #D32F2F; color: white; }
.btn-danger-outline { background-color: transparent; color: #D32F2F; border: 1px solid #D32F2F; }
.button-group {
  display: flex; justify-content: flex-end; gap: 12px;
}

/* --- Form & Grid --- */
.form-group { margin-bottom: 16px; }
.form-group label {
  display: block; margin-bottom: 6px; font-weight: 500; color: #333; font-size: 14px;
}
.form-group input, .form-group select {
  width: 100%; padding: 10px; border: 1px solid #B0BEC5;
  border-radius: 8px; box-sizing: border-box; font-size: 14px;
}
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
}
.modal-title {
  font-size: 20px; font-weight: 600; margin: 0;
}
.delete-header { color: #D32F2F; }
.edit-view h4 {
  font-size: 16px; font-weight: 600; color: #0D47A1;
  border-bottom: 2px solid #E3F2FD; padding-bottom: 8px; margin-top: 16px; margin-bottom: 16px;
}
.edit-view h4:first-of-type { margin-top: 0; }
.tag-group {
  display: flex; flex-direction: column; gap: 12px;
}
.checkbox-item {
  display: flex; align-items: center; gap: 10px;
}
.checkbox-item input { width: auto; }
.checkbox-item label { margin: 0; font-weight: 400; font-size: 14px; }
.indented { margin-left: 28px; margin-top: 10px; }
.checkbox-subgroup {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;
}

/* --- View Mode --- */
.modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.modal-header h2 { margin: 0; color: #333; }
.member-id { font-size: 14px; color: #546E7A; margin: 4px 0 0 0; }
.tag-list {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
}
.tag {
  background-color: #E3F2FD; color: #0D47A1; padding: 4px 10px;
  border-radius: 16px; font-size: 12px; font-weight: 500;
}
.details-grid {
  display: grid; grid-template-columns: 1fr; gap: 16px;
}
@media (min-width: 640px) {
  .details-grid { grid-template-columns: 1fr 1fr; }
}
.detail-item {
  background-color: #f9f9f9; padding: 12px; border-radius: 8px;
}
.detail-item .label {
  display: block; font-size: 12px; font-weight: 500;
  color: #546E7A; margin-bottom: 4px;
}
.detail-item .value {
  display: block; font-size: 14px; font-weight: 600;
  color: #333; word-wrap: break-word;
}
/* --- Delete Confirmation --- */
.delete-confirmation h3 { margin-top: 0; }
.error-message { color: #D32F2F; font-size: 14px; margin: 10px 0 0 0; }
</style>