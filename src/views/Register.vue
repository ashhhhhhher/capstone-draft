<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import Modal from '../components/Modal.vue'
import RegistrationSuccess from '../components/RegistrationSuccess.vue'
import { useMembersStore } from '../stores/members'

// --- Store Setup ---
const membersStore = useMembersStore()
const { leaders } = storeToRefs(membersStore) 

// --- Form Data Refs ---
const lastName = ref('')
const firstName = ref('')
const middleInitial = ref('')
const birthday = ref('')
const gender = ref('')
const school = ref('')
const email = ref('')
const contactNumber = ref('')
const fbAccount = ref('')
const dgroupCapacity = ref(8)

// --- Dgroup Leader Autocomplete Refs ---
const dgroupLeaderSearch = ref('')
const selectedDgroupLeader = ref('')

// --- Category Tag Refs ---
const tags = ref({
  isRegular: false,
  isVolunteer: false,
  volunteerMinistry: [],
  isDgroupLeader: false,
  isSeeker: false
})

// --- Modal State ---
const showSuccessModal = ref(false)
const newMemberData = ref(null)

// --- Computed Properties ---
const filteredLeaders = computed(() => {
  if (!dgroupLeaderSearch.value || !gender.value) {
    return []
  }
  const search = dgroupLeaderSearch.value.toLowerCase()
  return leaders.value.filter(leader => {
    const genderMatch = leader.gender === gender.value
    const nameMatch = `${leader.firstName} ${leader.lastName}`.toLowerCase().includes(search)
    return genderMatch && nameMatch
  }).map(leader => `${leader.firstName} ${leader.lastName}`)
})

const isFirstTimer = computed(() => !selectedDgroupLeader.value && !tags.value.isDgroupLeader)

const age = computed(() => {
  if (!birthday.value) return null
  const today = new Date()
  const birthDate = new Date(birthday.value)
  let ageVal = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    ageVal--
  }
  return ageVal
})

const ageCategory = computed(() => {
  if (age.value === null) return ''
  if (age.value >= 12 && age.value <= 21) return 'Elevate'
  if (age.value >= 22) return 'B1G'
  return 'N/A'
})

// --- Functions ---
function selectLeader(leader) {
  selectedDgroupLeader.value = leader
  dgroupLeaderSearch.value = leader
}

function clearForm() {
  lastName.value = ''; firstName.value = ''; middleInitial.value = '';
  birthday.value = ''; gender.value = ''; school.value = ''; email.value = '';
  contactNumber.value = ''; fbAccount.value = '';
  dgroupLeaderSearch.value = ''; selectedDgroupLeader.value = '';
  dgroupCapacity.value = 8;
  tags.value = { isRegular: false, isVolunteer: false, volunteerMinistry: [], isDgroupLeader: false, isSeeker: false };
}

function handleSubmit() {
  // --- Validation ---
  if (!lastName.value || !firstName.value || !birthday.value || !gender.value || !email.value) {
      alert('Please fill in all required fields (marked with *).');
      return;
  }
  
  // --- THIS IS THE FIX ---
  // If text is in the search box but no leader is officially selected, it's an error.
  if (dgroupLeaderSearch.value && !selectedDgroupLeader.value) {
    alert('Invalid Dgroup Leader. Please select a valid leader from the list or leave the field blank.');
    return;
  }
  
  const hasSelectedLeader = !!selectedDgroupLeader.value
  const hasSelectedTag = tags.value.isRegular || tags.value.isVolunteer || tags.value.isDgroupLeader
  
  if (tags.value.isRegular && !hasSelectedLeader) {
    alert('A "Regular Member" must be assigned to a Dgroup Leader. Please select a leader or uncheck "Regular Member".');
    return;
  }
  
  const newId = 'Q-' + Math.floor(100000 + Math.random() * 900000).toString();

  const memberData = {
    id: newId,
    lastName: toTitleCase(lastName.value.trim()),
    firstName: toTitleCase(firstName.value.trim()),
    middleInitial: middleInitial.value.toUpperCase().trim(),
    birthday: birthday.value,
    age: age.value,
    gender: gender.value,
    school: toTitleCase(school.value.trim()),
    email: email.value.trim(),
    contactNumber: contactNumber.value.trim(),
    fbAccount: fbAccount.value.trim(),
    dgroupLeader: selectedDgroupLeader.value,
    dgroupCapacity: tags.value.isDgroupLeader ? dgroupCapacity.value : null,
    finalTags: {
      ...tags.value,
      ageCategory: ageCategory.value,
      isFirstTimer: isFirstTimer.value
    }
  }

  membersStore.registerNewMember(memberData);
  newMemberData.value = memberData;
  showSuccessModal.value = true;
  clearForm();
}

// Helper function
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
</script>

<template>
  <div class="register-container">
    <div class="register-header">
      <h1>Register New Member</h1>
      <p>Fill in the details to create a new member profile.</p>
    </div>

    <form class="register-form" @submit.prevent="handleSubmit">
      
      <h3>Personal Information</h3>
      <div class="form-group">
        <label for="lastName">Last Name *</label>
        <input type="text" id="lastName" v-model="lastName" required />
      </div>
      <div class="form-group">
        <label for="firstName">First Name *</label>
        <input type="text" id="firstName" v-model="firstName" required />
      </div>
       <div class="form-group">
        <label for="middleInitial">Middle Initial</label>
        <input type="text" id="middleInitial" v-model="middleInitial" maxlength="2" />
      </div>

      <div class="form-group">
        <label for="birthday">Birthday *</label>
        <input type="date" id="birthday" v-model="birthday" required />
        <span v-if="age !== null" class="age-display">
          Age: {{ age }} (Category: {{ ageCategory }})
        </span>
      </div>

      <div class="form-group">
        <label for="gender">Gender *</label>
        <select id="gender" v-model="gender" required>
          <option value="" disabled>Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      
       <div class="form-group">
        <label for="email">Email Address *</label>
        <input type="email" id="email" v-model="email" required />
      </div>
      
      <div class="form-group">
        <label for="contactNumber">Contact Number</label>
        <input type="tel" id="contactNumber" v-model="contactNumber" placeholder="e.g., 09171234567" />
      </div>
      <div class="form-group">
        <label for="fbAccount">Facebook Account (Optional)</label>
        <input type="text" id="fbAccount" v-model="fbAccount" placeholder="e.g., facebook.com/juan.delacruz" />
      </div>

      <div class="form-group">
        <label for="school">School/Workplace</label>
        <input type="text" id="school" v-model="school" />
      </div>

      <h3>Church Information</h3>
      <div class="form-group autocomplete-wrapper">
        <label for="dgroupLeader">Dgroup Leader (Optional)</label>
        <input 
          type="text" 
          id="dgroupLeader"
          placeholder="Select gender, then type a name..."
          v-model="dgroupLeaderSearch"
          @input="selectedDgroupLeader = ''" 
          :disabled="!gender"
        />
        <ul v-if="filteredLeaders.length > 0 && dgroupLeaderSearch !== selectedDgroupLeader" class="autocomplete-results">
          <li 
            v-for="leader in filteredLeaders" 
            :key="leader"
            @click="selectLeader(leader)">
            {{ leader }}
          </li>
        </ul>
        <small v-if="!gender" class="field-hint">Please select a gender first to filter leaders.</small>
      </div>
      
      <div v-if="isFirstTimer" class="first-timer-follow-up">
          <p class="status-tag">Status: First Timer</p>
          <div class="checkbox-item">
             <input type="checkbox" id="isSeeker" v-model="tags.isSeeker" />
             <label for="isSeeker">Are they looking for a small group (Dgroup)?</label>
          </div>
      </div>


      <h3>Category Tags</h3>
      <div class="tag-group">
        <div class="checkbox-item">
          <input type="checkbox" id="isRegular" v-model="tags.isRegular" />
          <label for="isRegular">Regular Member</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="isDgroupLeader" v-model="tags.isDgroupLeader" />
          <label for="isDgroupLeader">Dgroup Leader</label>
        </div>
        
        <div v-if="tags.isDgroupLeader" class="form-group indented">
          <label for="dgroupCapacity">Dgroup Capacity</label>
          <input type="number" id="dgroupCapacity" v-model="dgroupCapacity" min="1" />
        </div>
        
        <div class="checkbox-item">
          <input type="checkbox" id="isVolunteer" v-model="tags.isVolunteer" />
          <label for="isVolunteer">Volunteer</label>
        </div>
        
        <div v-if="tags.isVolunteer" class="form-group indented">
          <label>Volunteer Ministry (Select all that apply):</label>
          <div class="checkbox-subgroup">
            <div class="checkbox-item">
              <input type="checkbox" id="vol-liveprod" value="Live Prod" v-model="tags.volunteerMinistry" />
              <label for="vol-liveprod">Live Prod</label>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="vol-host" value="Host" v-model="tags.volunteerMinistry" />
              <label for="vol-host">Host</label>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="vol-exalt" value="Exalt" v-model="tags.volunteerMinistry" />
              <label for="vol-exalt">Exalt (Worship)</label>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="vol-usher" value="Usher" v-model="tags.volunteerMinistry" />
              <label for="vol-usher">Usher</label>
            </div>
          </div>
        </div>
      </div>
      
      <button type="submit" class="submit-btn">Register Member</button>

    </form>
  </div>
  
  <Modal 
    v-if="showSuccessModal" 
    @close="showSuccessModal = false"
  >
    <RegistrationSuccess 
      v-if="newMemberData"
      :memberData="newMemberData"
      @close="showSuccessModal = false"
    />
  </Modal>
</template>

<style scoped>
.autocomplete-wrapper { position: relative; }
.autocomplete-results { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; border-radius: 0 0 8px 8px; list-style: none; margin: 0; padding: 0; max-height: 150px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.autocomplete-results li { padding: 12px; cursor: pointer; }
.autocomplete-results li:hover { background-color: #f0f0f0; }
.field-hint {
  font-size: 12px;
  color: #546E7A;
  margin-top: 4px;
}
.first-timer-follow-up { background-color: #E3F2FD; border-left: 4px solid #1976D2; padding: 16px; margin: 20px 0; border-radius: 8px; }
.status-tag { margin: 0 0 12px 0; font-weight: 600; color: #0D47A1; }
.first-timer-follow-up .checkbox-item { padding: 0; }
.register-container { padding: 20px; }
.register-header h1 { font-size: 28px; font-weight: 700; margin: 0; }
.register-header p { font-size: 16px; color: #546E7A; margin-top: 4px; }
.register-form h3 { font-size: 18px; font-weight: 600; color: #0D47A1; border-bottom: 2px solid #E3F2FD; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
.form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #B0BEC5; border-radius: 8px; box-sizing: border-box; font-size: 16px; background-color: #fff; }
.age-display { display: block; font-size: 14px; color: #546E7A; margin-top: 8px; }
.tag-group { display: flex; flex-direction: column; gap: 12px; }
.checkbox-item { display: flex; align-items: center; gap: 10px; }
.checkbox-item input { width: auto; }
.checkbox-item label { margin: 0; font-weight: 400; }
.indented { margin-left: 28px; margin-top: 10px; margin-bottom: 0; }
.submit-btn { width: 100%; padding: 16px; margin-top: 32px; background-color: #1976D2; color: white; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s ease; }
.submit-btn:hover { background-color: #1565C0; }
.checkbox-subgroup {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
</style>