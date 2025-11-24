<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const membersStore = useMembersStore()

const isLoading = ref(false)
const form = ref({
  name: '',
  lifeStage: 'Elevate',
  capacity: 12
})

async function handleSubmit() {
  if (!form.value.name || !form.value.capacity) {
    alert("Please fill in all fields");
    return;
  }

  // 1. Validate Profile exists
  if (!authStore.userProfile || !authStore.userProfile.id) {
    alert("User profile not found. Try refreshing the page.");
    return;
  }

  isLoading.value = true
  
  try {
    const newGroup = {
      id: 'dg_' + Date.now(), 
      name: form.value.name,
      lifeStage: form.value.lifeStage,
      capacity: parseInt(form.value.capacity),
      createdAt: new Date().toISOString()
    }

    // 2. Add to Firestore
    await membersStore.addDgroupToLeader(authStore.userProfile.id, newGroup)
    
    // 3. Refresh Profile (Now safe because we exported it in auth.js)
    if (authStore.user?.uid && authStore.branchId) {
        await authStore.fetchMemberProfile(authStore.user.uid, authStore.branchId)
    }

    form.value = { name: '', lifeStage: 'Elevate', capacity: 12 }
    emit('close')

  } catch (error) {
    console.error("Create Group Error:", error)
    // Alert the specific error message for debugging
    alert(`Failed to create group: ${error.message}`);
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3>Create New Dgroup</h3>
      </div>
      
      <div class="modal-body">
        <p class="helper-text">Create a new group bucket for your members.</p>

        <div class="form-group">
          <label>Dgroup Name</label>
          <input type="text" v-model="form.name" placeholder="e.g. Friday Elevate Group">
        </div>

        <div class="form-group">
          <label>Life Stage</label>
          <select v-model="form.lifeStage">
            <option value="Elevate">Elevate (Youth)</option>
            <option value="B1G">B1G (Young Adults)</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>

        <div class="form-group">
          <label>Capacity</label>
          <input type="number" v-model="form.capacity" min="1" max="50">
        </div>
      </div>

      <div class="actions">
        <button class="cancel" @click="$emit('close')" :disabled="isLoading">Cancel</button>
        <button class="confirm" @click="handleSubmit" :disabled="isLoading">
          {{ isLoading ? 'Creating...' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal { background: white; width: 90%; max-width: 400px; padding: 24px; border-radius: 16px; }
.modal-header h3 { margin: 0 0 10px 0; color: #1565C0; }
.helper-text { color: #546E7A; font-size: 14px; margin-bottom: 20px; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #37474F; font-size: 13px; }
.form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #CFD8DC; border-radius: 8px; font-size: 14px; box-sizing: border-box; }

.actions { display: flex; gap: 12px; margin-top: 24px; }
.actions button { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
.actions button:disabled { opacity: 0.7; cursor: not-allowed; }
.confirm { background: #1976D2; color: white; }
.cancel { background: #ECEFF1; color: #455A64; }
</style>