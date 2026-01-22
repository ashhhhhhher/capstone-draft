<script setup>
import { ref } from 'vue'

const props = defineProps({
  // Receives the current filters from the parent
  modelValue: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'apply', 'clear'])

// We use a local ref so we can change things
// without affecting the parent until we hit "Apply"
const localFilters = ref(JSON.parse(JSON.stringify(props.modelValue)))

// List of all possible ministries
const ministries = ref(['Live Prod', 'Host', 'Exalt', 'Usher'])

function applyFilters() {
  emit('update:modelValue', localFilters.value)
  emit('apply')
}

function clearFilters() {
  // Reset local state to default
  localFilters.value = {
    attendance: [],
    age: [],
    type: [],
    ministries: []
  }
  // Immediately apply the cleared filters
  applyFilters()
}
</script>

<template>
  <div class="filter-modal-container">
    <div class="filter-header">
      <h3>Filter Members</h3>
      <button class="clear-btn" @click="clearFilters">Clear All</button>
    </div>
    
    <div class="filter-body">
      <!-- Attendance Section -->
      <div class="filter-group">
        <h4>Attendance</h4>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-present" value="present" v-model="localFilters.attendance">
          <label for="filt-present">Present</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-absent" value="absent" v-model="localFilters.attendance">
          <label for="filt-absent">Absent</label>
        </div>
      </div>
      
      <!-- Age Section -->
      <div class="filter-group">
        <h4>Age Group</h4>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-elevate" value="Elevate" v-model="localFilters.age">
          <label for="filt-elevate">Elevate (12-21)</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-b1g" value="B1G" v-model="localFilters.age">
          <label for="filt-b1g">B1G (22+)</label>
        </div>
      </div>
      
      <!-- Type Section -->
      <div class="filter-group">
        <h4>Member Type</h4>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-leader" value="leader" v-model="localFilters.type">
          <label for="filt-leader">Dgroup Leader</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-regular" value="regular" v-model="localFilters.type">
          <label for="filt-regular">Regular</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-firsttimer" value="firstTimer" v-model="localFilters.type">
          <label for="filt-firsttimer">First Timer</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="filt-volunteer" value="volunteer" v-model="localFilters.type">
          <label for="filt-volunteer">Volunteer</label>
        </div>
      </div>
      
      <!-- Ministry Section -->
      <div class="filter-group">
        <h4>Volunteer Ministry</h4>
        <div v-for="ministry in ministries" :key="ministry" class="checkbox-item">
          <input type="checkbox" :id="`filt-${ministry}`" :value="ministry" v-model="localFilters.ministries">
          <label :for="`filt-${ministry}`">{{ ministry }}</label>
        </div>
      </div>
    </div>
    
    <button class="apply-btn" @click="applyFilters">Apply Filters</button>
  </div>
</template>

<style scoped>
.filter-modal-container {
  padding: 16px;
  width: 95vw;
  max-width: 400px;
}
.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.filter-header h3 {
  margin: 0;
  font-size: 20px;
  color: #0D47A1;
}
.clear-btn {
  background: none;
  border: none;
  color: #1976D2;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.filter-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
}
.filter-group h4 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.checkbox-item input {
  width: 18px;
  height: 18px;
}
.checkbox-item label {
  font-size: 14px;
  font-weight: 500;
}

.apply-btn {
  width: 100%;
  padding: 14px;
  margin-top: 24px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>