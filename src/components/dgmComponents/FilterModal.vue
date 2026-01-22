<script setup>
import { ref } from 'vue'
import { Check, X } from 'lucide-vue-next'

const props = defineProps({
  // Expected structure:
  // { 
  //   age: [], 
  //   type: { included: [], excluded: [] }, 
  //   ministries: [] 
  // }
  modelValue: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'apply', 'clear'])

const localFilters = ref(JSON.parse(JSON.stringify(props.modelValue)))

// Ensure type structure exists for compatibility
if (Array.isArray(localFilters.value.type)) {
    // Convert old array format to new structure if passed
    localFilters.value.type = { included: [...localFilters.value.type], excluded: [] };
}

const ministries = ref(['Live Prod', 'Host Team', 'Exalt', 'Welcome', 'DGM'])

// --- TRI-STATE LOGIC ---
// Cycle: None -> Include -> Exclude -> None
function toggleTriState(value, category) {
    const included = localFilters.value[category].included;
    const excluded = localFilters.value[category].excluded;

    const isInc = included.includes(value);
    const isExc = excluded.includes(value);

    if (!isInc && !isExc) {
        // State 1: Include
        included.push(value);
    } else if (isInc) {
        // State 2: Exclude (remove from included, add to excluded)
        const idx = included.indexOf(value);
        if (idx > -1) included.splice(idx, 1);
        excluded.push(value);
    } else if (isExc) {
        // State 3: Reset (remove from excluded)
        const idx = excluded.indexOf(value);
        if (idx > -1) excluded.splice(idx, 1);
    }
}

function getTriStateClass(value, category) {
    if (localFilters.value[category].included.includes(value)) return 'is-included';
    if (localFilters.value[category].excluded.includes(value)) return 'is-excluded';
    return 'is-empty';
}

function applyFilters() {
  emit('update:modelValue', localFilters.value)
  emit('apply')
}

function clearFilters() {
  localFilters.value = {
    // Attendance filter removed
    age: [],
    type: { included: [], excluded: [] }, 
    ministries: []
  }
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
      <!-- Age Section (Standard) -->
      <div class="filter-group">
        <h4>Age Group</h4>
        <div class="checkbox-item"><input type="checkbox" id="filt-elevate" value="Elevate" v-model="localFilters.age"><label for="filt-elevate">Elevate (12-21)</label></div>
        <div class="checkbox-item"><input type="checkbox" id="filt-b1g" value="B1G" v-model="localFilters.age"><label for="filt-b1g">B1G (22+)</label></div>
      </div>
      
      <!-- Type Section (TRI-STATE) -->
      <div class="filter-group">
        <h4>Member Type <span class="hint">(Click to Include, Double-Click to Exclude)</span></h4>
        
        <div class="tri-state-row" @click="toggleTriState('Dgroup Leader', 'type')">
            <div class="tri-box" :class="getTriStateClass('Dgroup Leader', 'type')">
                <Check v-if="getTriStateClass('Dgroup Leader', 'type') === 'is-included'" :size="14" />
                <X v-if="getTriStateClass('Dgroup Leader', 'type') === 'is-excluded'" :size="14" />
            </div>
            <span>Dgroup Leader</span>
        </div>

        <div class="tri-state-row" @click="toggleTriState('Regular', 'type')">
            <div class="tri-box" :class="getTriStateClass('Regular', 'type')">
                <Check v-if="getTriStateClass('Regular', 'type') === 'is-included'" :size="14" />
                <X v-if="getTriStateClass('Regular', 'type') === 'is-excluded'" :size="14" />
            </div>
            <span>Regular</span>
        </div>

        <div class="tri-state-row" @click="toggleTriState('First Timer', 'type')">
            <div class="tri-box" :class="getTriStateClass('First Timer', 'type')">
                <Check v-if="getTriStateClass('First Timer', 'type') === 'is-included'" :size="14" />
                <X v-if="getTriStateClass('First Timer', 'type') === 'is-excluded'" :size="14" />
            </div>
            <span>First Timer</span>
        </div>

        <div class="tri-state-row" @click="toggleTriState('Volunteer', 'type')">
            <div class="tri-box" :class="getTriStateClass('Volunteer', 'type')">
                <Check v-if="getTriStateClass('Volunteer', 'type') === 'is-included'" :size="14" />
                <X v-if="getTriStateClass('Volunteer', 'type') === 'is-excluded'" :size="14" />
            </div>
            <span>Volunteer</span>
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
.filter-modal-container { padding: 16px; width: 95vw; max-width: 400px; }
.filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.filter-header h3 { margin: 0; font-size: 20px; color: #0D47A1; }
.clear-btn { background: none; border: none; color: #1976D2; font-size: 14px; font-weight: 600; cursor: pointer; }

.filter-body { display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto; padding: 4px; }
.filter-group h4 { font-size: 16px; font-weight: 600; color: #333; margin: 0 0 12px 0; border-bottom: 1px solid #eee; padding-bottom: 8px; }
.checkbox-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.checkbox-item input { width: 18px; height: 18px; }
.checkbox-item label { font-size: 14px; font-weight: 500; }

.hint { font-size: 11px; color: #999; font-weight: 400; margin-left: 6px; }

/* Tri-state styles */
.tri-state-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; cursor: pointer; user-select: none; }
.tri-box { width: 18px; height: 18px; border: 2px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: white; transition: all 0.1s; }
.tri-box.is-included { background-color: #1976D2; border-color: #1976D2; color: white; }
.tri-box.is-excluded { background-color: #D32F2F; border-color: #D32F2F; color: white; }
.tri-state-row span { font-size: 14px; font-weight: 500; }

.apply-btn { width: 100%; padding: 14px; margin-top: 24px; background-color: #1976D2; color: white; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; }
</style>