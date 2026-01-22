<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMembersStore } from '../../stores/members'
import { useAttendanceStore } from '../../stores/attendance'
import { Archive, RotateCcw, Copy } from 'lucide-vue-next' 

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

// Ensure array exists for ministries
if (!Array.isArray(editableMember.value.finalTags.volunteerMinistry)) {
  editableMember.value.finalTags.volunteerMinistry = []
}

// --- Auto-Uncheck Logic ---
// If Dgroup Leader is checked, Regular cannot be true.
watch(() => editableMember.value.finalTags.isDgroupLeader, (newVal) => {
  if (newVal) {
    editableMember.value.finalTags.isRegular = false;
  }
})

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

// --- Date Joined Logic ---
const memberSince = computed(() => {
  if (!props.member.createdAt) return 'Unknown';
  const date = new Date(props.member.createdAt);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
});

// --- Helper Computeds ---
const isArchived = computed(() => props.member.status === 'archived')

// Filter leaders by gender for the dropdown
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

function generateDgroupID() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DG-${year}-${random}`;
}

function save() {
  const finalTags = editableMember.value.finalTags;
  const dgroupLeaderSelection = editableMember.value.dgroupLeader;

  // --- Derived State ---
  const isFirstTimer = dgroupLeaderSelection === 'N/A (First Timer)';

  // --- 1. Validate Invalid Combinations ---
  if (finalTags.isDgroupLeader && finalTags.isRegular) {
    alert("Invalid Combination: A member cannot be both a Dgroup Leader and a Regular Member. Please uncheck Regular.");
    return;
  }
  // Volunteer Validation
  if (!finalTags.isDgroupLeader && finalTags.isVolunteer && finalTags.isRegular) {
     // Optional: You can force uncheck Regular here automatically if you want, but for now we alert
     alert("Invalid: A Volunteer cannot be tagged as 'Regular' in the profile. Their status changes dynamically.");
     return;
  }

  if (finalTags.isDgroupLeader && isFirstTimer) {
    alert("Invalid Combination: A Dgroup Leader cannot be a First Timer. Change Church Info.");
    return;
  }
  
  // --- 2. Empty Category Check ---
  const hasManualCategory = finalTags.isSeeker || finalTags.isRegular || finalTags.isDgroupLeader || finalTags.isVolunteer;
  if (!hasManualCategory && !isFirstTimer) {
    alert("Please select at least one Category (Seeker, Regular, DL, or Volunteer) or set Church Info to 'N/A (First Timer)'.");
    return;
  }

  // --- 3. Volunteer Ministry Validation ---
  if (finalTags.isVolunteer) {
    if (!finalTags.volunteerMinistry || finalTags.volunteerMinistry.length === 0) {
      alert("Please select a ministry for the volunteer.");
      return;
    }
    if (isFirstTimer) {
        alert("Invalid: A First Timer cannot be a Volunteer.");
        return;
    }
    if (!dgroupLeaderSelection) {
       alert("A Volunteer must belong to a Dgroup.");
       return;
    }
  }

  // --- 4. Church Information Validation ---
  if (finalTags.isDgroupLeader) {
      if (!dgroupLeaderSelection) {
          alert("Dgroup Leaders must have a Leader or be set to 'N/A (D-Lead)'.");
          return;
      }
  } else if (!isFirstTimer && !dgroupLeaderSelection) {
      alert("Church Information (Dgroup Leader) cannot be empty.");
      return;
  }

  // --- 5. Apply Data ---
  if (isFirstTimer) {
      finalTags.isFirstTimer = true;
      editableMember.value.dgroupLeader = ''; 
  } else {
      finalTags.isFirstTimer = false;
  }
  
  // Update Age & Category
  editableMember.value.age = editableAge.value
  if (editableAge.value >= 12 && editableAge.value <= 21) {
    editableMember.value.finalTags.ageCategory = 'Elevate'
  } else if (editableAge.value >= 22) {
    editableMember.value.finalTags.ageCategory = 'B1G'
  } else {
    editableMember.value.finalTags.ageCategory = 'N/A'
  }
  
  // Leader Logic
  if (finalTags.isDgroupLeader) {
    if (!editableMember.value.dgroupId) editableMember.value.dgroupId = generateDgroupID();
    if (!editableMember.value.dgroupName) editableMember.value.dgroupName = `${editableMember.value.firstName}'s Dgroup`;
  } else {
    editableMember.value.dgroupCapacity = null
  }
  
  // Format Strings
  editableMember.value.lastName = toTitleCase(editableMember.value.lastName.trim());
  editableMember.value.firstName = toTitleCase(editableMember.value.firstName.trim());
  editableMember.value.middleInitial = editableMember.value.middleInitial ? editableMember.value.middleInitial.toUpperCase().trim() : '';
  editableMember.value.school = editableMember.value.school ? toTitleCase(editableMember.value.school.trim()) : '';
  editableMember.value.email = editableMember.value.email ? editableMember.value.email.trim() : '';
  editableMember.value.fbAccount = editableMember.value.fbAccount ? editableMember.value.fbAccount.trim() : '';
  editableMember.value.contactNumber = editableMember.value.contactNumber ? editableMember.value.contactNumber.trim() : '';
  
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

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert('ID copied to clipboard: ' + text);
}
</script>

<template>
  <div class="details-modal-container">
    
    <div class="modal-header-section">
      <div v-if="!isEditMode && !showArchiveConfirmation" class="modal-header">
        
        <div class="header-left">
          <div class="modal-avatar-wrapper">
            <img v-if="member.profilePicture" :src="member.profilePicture" alt="Profile" class="modal-avatar-img"/>
            <div v-else class="modal-avatar-placeholder">{{ member.firstName ? member.firstName.charAt(0).toUpperCase() : '?' }}</div>
          </div>
          <div class="header-text">
            <h2>{{ member.firstName }} {{ member.lastName }}</h2>
            <div class="status-badges">
              <span class="member-id">ID: {{ member.id }}</span>
              <span v-if="isArchived" class="archived-badge">ARCHIVED</span>
            </div>
          </div>
        </div>

        <button class="btn-primary" @click="isEditMode = true">Edit</button>
      </div>
      <h3 v-if="isEditMode" class="modal-title">Edit Member Details</h3>
      <h3 v-if="showArchiveConfirmation" class="modal-title delete-header">Archive Member</h3>
    </div>

    <div class="modal-body-scrollable">

      <div v-if="showArchiveConfirmation" class="delete-confirmation">
        <p>Are you sure you want to archive <strong>{{ member.firstName }} {{ member.lastName }}</strong>?</p>
        <p class="warning-text">They will be hidden from the main lists but their attendance history is preserved.</p>
        <div class="button-group">
          <button class="btn-secondary" @click="showArchiveConfirmation = false">Cancel</button>
          <button class="btn-danger" @click="confirmArchive">Confirm Archive</button>
        </div>
      </div>

      <div v-else-if="isEditMode" class="edit-view">
        
        <h4>Personal Information</h4>
        <div class="form-grid">
          <div class="form-group"><label>Last Name</label><input type="text" v-model="editableMember.lastName"></div>
          <div class="form-group"><label>First Name</label><input type="text" v-model="editableMember.firstName"></div>
          <div class="form-group"><label>M.I.</label><input type="text" v-model="editableMember.middleInitial" maxlength="2"></div>
          <div class="form-group"><label>Birthday</label><input type="date" v-model="editableMember.birthday"></div>
          <div class="form-group"><label>Gender</label><select v-model="editableMember.gender"><option value="Male">Male</option><option value="Female">Female</option></select></div>
          <div class="form-group"><label>School/Workplace</label><input type="text" v-model="editableMember.school"></div>
          <div class="form-group"><label>Email</label><input type="email" v-model="editableMember.email"></div>
          <div class="form-group"><label>Contact Number</label><input type="tel" v-model="editableMember.contactNumber"></div>
          <div class="form-group"><label>Facebook</label><input type="text" v-model="editableMember.fbAccount"></div>
        </div>
        
        <h4>Church Information</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Dgroup Leader</label>
            <select v-model="editableMember.dgroupLeader">
              <option value="N/A (First Timer)">N/A (First Timer)</option>
              <option value="N/A (D-Lead)">N/A (D-Lead)</option>
              <option v-for="leader in dgroupLeadersList" :key="leader" :value="leader">{{ leader }}</option>
            </select>
          </div>
        </div>
        
        <h4>Categories & Ministry</h4>
        <div class="tag-group">
            <div class="checkbox-item">
                <input type="checkbox" id="seeker" v-model="editableMember.finalTags.isSeeker">
                <label for="seeker">Seeker</label>
            </div>
            
            <!-- Dgroup Leader Checkbox -->
            <div class="checkbox-item">
                <input type="checkbox" id="leader" v-model="editableMember.finalTags.isDgroupLeader">
                <label for="leader">Dgroup Leader</label>
            </div>
             
             <!-- Leader Specific Settings -->
             <div v-if="editableMember.finalTags.isDgroupLeader" class="form-group indented">
                 <div class="sub-form-group"><label>Dgroup Name</label><input type="text" v-model="editableMember.dgroupName" placeholder="e.g. Elevate Boys"></div>
                 <div class="sub-form-group"><label>Dgroup Capacity</label><input type="number" v-model="editableMember.dgroupCapacity" min="1"></div>
                 <div class="sub-form-group" v-if="editableMember.dgroupId"><label>Dgroup ID (Auto)</label><input type="text" :value="editableMember.dgroupId" disabled class="disabled-input"></div>
            </div>

            <!-- Volunteer Checkbox -->
            <div class="checkbox-item">
                <input type="checkbox" id="volunteer" v-model="editableMember.finalTags.isVolunteer">
                <label for="volunteer">Volunteer</label>
            </div>

             <!-- Volunteer Settings -->
             <div v-if="editableMember.finalTags.isVolunteer" class="indented">
                <label class="sub-label">Select Ministries:</label>
                <div class="checkbox-subgroup">
                     <div class="checkbox-item"><input type="checkbox" value="Host Team" v-model="editableMember.finalTags.volunteerMinistry"><label>Host Team</label></div>
                     <div class="checkbox-item"><input type="checkbox" value="Live Prod" v-model="editableMember.finalTags.volunteerMinistry"><label>Live Prod</label></div>
                     <div class="checkbox-item"><input type="checkbox" value="Exalt" v-model="editableMember.finalTags.volunteerMinistry"><label>Exalt (Music)</label></div>
                     <div class="checkbox-item"><input type="checkbox" value="Welcome" v-model="editableMember.finalTags.volunteerMinistry"><label>Welcome</label></div>
                     <div class="checkbox-item"><input type="checkbox" value="DGM" v-model="editableMember.finalTags.volunteerMinistry"><label>DGM</label></div>
                </div>
            </div>

            <!-- Regular Member Checkbox (ALWAYS VISIBLE for fixing state) -->
            <!-- Disabled if DLeader/Volunteer to guide user, or enabled if you want manual control. -->
            <!-- We removed v-if so it can always be seen and unchecked. -->
            <div class="checkbox-item">
                <input type="checkbox" id="regular" v-model="editableMember.finalTags.isRegular">
                <label for="regular">Regular Member</label>
            </div>
        </div>

        <div class="button-group mt-20">
          <button class="btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="btn-primary" @click="save">Save Changes</button>
        </div>
      </div>

      <div v-else class="view-mode">
        <div class="tag-list">
          <span v-for="tag in allTags" :key="tag" class="tag">{{ tag }}</span>
        </div>

        <div class="details-grid">
          <div class="detail-item full-width">
            <span class="label">Member Since</span>
            <span class="value">{{ memberSince }}</span>
          </div>
          <div class="detail-item"><span class="label">Email</span><span class="value">{{ member.email || 'N/A' }}</span></div>
          <div class="detail-item"><span class="label">Contact Number</span><span class="value">{{ member.contactNumber || 'N/A' }}</span></div>
          <div class="detail-item"><span class="label">Facebook</span><span class="value">{{ member.fbAccount || 'N/A' }}</span></div>
          <div class="detail-item"><span class="label">Gender</span><span class="value">{{ member.gender }}</span></div>
          <div class="detail-item"><span class="label">Birthday</span><span class="value">{{ member.birthday }} (Age: {{ member.age }})</span></div>
          <div class="detail-item"><span class="label">School/Workplace</span><span class="value">{{ member.school || 'N/A' }}</span></div>
          <div class="detail-item"><span class="label">Dgroup Leader</span><span class="value">{{ member.dgroupLeader || 'N/A' }}</span></div>
          <div class="detail-item"><span class="label">Attendance</span><span class="value">{{ memberAttendanceStatus }}</span></div>
          
          <div v-if="member.finalTags.isDgroupLeader && member.dgroupId" class="detail-item full-width highlight-box">
            <span class="label">Dgroup ID (For Downlines)</span>
            <div class="value-with-icon">
              <span class="code-text">{{ member.dgroupId }}</span>
              <button @click="copyToClipboard(member.dgroupId)" class="copy-btn"><Copy :size="14" /></button>
            </div>
            <span class="sub-val">Group Name: {{ member.dgroupName }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer-section">
      <div v-if="!isEditMode && !showArchiveConfirmation" class="danger-zone">
        <button v-if="isArchived" class="btn-restore" @click="confirmRestore"><RotateCcw :size="16" /> Restore Member</button>
        <button v-else class="btn-danger-outline" @click="showArchiveConfirmation = true"><Archive :size="16" /> Archive Member</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Reuse existing styles, keeping structure for scroll */
.details-modal-container { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; height: 100%; }
.modal-header-section { flex-shrink: 0; padding-bottom: 16px; border-bottom: 1px solid #ECEFF1; }
.modal-body-scrollable { overflow-y: auto; flex-grow: 1; padding-top: 20px; padding-right: 16px; margin-right: -16px; }
.modal-footer-section { flex-shrink: 0; padding-top: 16px; border-top: 1px solid #ECEFF1; }

.btn-primary, .btn-secondary, .btn-danger, .btn-danger-outline, .btn-restore { border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.btn-primary { background-color: #1976D2; color: white; }
.btn-secondary { background-color: #CFD8DC; color: #37474F; }
.btn-danger { background-color: #D32F2F; color: white; }
.btn-danger-outline { background-color: transparent; color: #D32F2F; border: 1px solid #D32F2F; }
.btn-restore { background-color: #2E7D32; color: white; }

.button-group { display: flex; justify-content: flex-end; gap: 12px; }
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
.checkbox-item input { width: auto; transform: scale(1.2); cursor: pointer; }
.checkbox-item label { margin: 0; font-weight: 400; font-size: 14px; cursor: pointer; }
.indented { margin-left: 28px; margin-top: 10px; padding: 12px; background: #F5F7FA; border-radius: 8px; }
.sub-label { font-weight: 600; margin-bottom: 8px; display: block; color: #546E7A; }
.checkbox-subgroup { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sub-form-group { margin-bottom: 10px; }
.disabled-input { background: #e0e0e0; color: #757575; border-color: #bdbdbd; cursor: not-allowed; font-family: monospace; }
.mt-20 { margin-top: 20px; }

.modal-header { display: flex; justify-content: space-between; align-items: flex-start; }
.header-left { display: flex; align-items: center; gap: 16px; }
.modal-avatar-wrapper { width: 64px; height: 64px; flex-shrink: 0; }
.modal-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #E3F2FD; }
.modal-avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; background-color: #E3F2FD; color: #1565C0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; border: 2px solid #E3F2FD; }
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
.full-width { grid-column: 1 / -1; }
.highlight-box { background-color: #E3F2FD; border: 1px solid #BBDEFB; }
.value-with-icon { display: flex; align-items: center; justify-content: space-between; }
.code-text { font-family: monospace; font-size: 16px; color: #1565C0; font-weight: 700; }
.copy-btn { background: none; border: none; cursor: pointer; color: #1976D2; padding: 4px; }
.sub-val { display: block; font-size: 12px; color: #546E7A; margin-top: 4px; }
.danger-zone { display: flex; justify-content: flex-end; gap: 10px; }
.warning-text { color: #546E7A; font-size: 14px; margin-bottom: 20px; }
</style>