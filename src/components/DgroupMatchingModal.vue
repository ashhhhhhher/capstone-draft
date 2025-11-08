<script setup>
import { computed } from 'vue'
import { useMembersStore } from '../stores/members'
import { storeToRefs } from 'pinia'

const emit = defineEmits(['close'])

// --- Store Setup ---
const membersStore = useMembersStore()
// Get the live computed lists from the store
const { seekers, leaders, members } = storeToRefs(membersStore)

// --- Computed ---
// Create a detailed list of leaders with their capacity
const leaderStats = computed(() => {
  return leaders.value.map(leader => {
    // Find all members who have this leader as their dgroupLeader
    const currentMembers = members.value.filter(
      m => m.dgroupLeader === `${leader.firstName} ${leader.lastName}`
    ).length
    
    const capacity = leader.dgroupCapacity || 8 // Default to 8
    
    return {
      id: leader.id,
      name: `${leader.firstName} ${leader.lastName}`,
      current: currentMembers,
      capacity: capacity,
      openSlots: capacity - currentMembers
    }
  }).sort((a, b) => b.openSlots - a.openSlots) // Show leaders with most slots first
})
</script>

<template>
  <div class="matching-container">
    <h2>Dgroup Matching</h2>
    
    <div class="lists-grid">
      
      <!-- Seekers List -->
      <div class="list-card">
        <h3>Seekers ({{ seekers.length }})</h3>
        <ul v-if="seekers.length > 0">
          <li v-for="seeker in seekers" :key="seeker.id">
            {{ seeker.firstName }} {{ seeker.lastName }}
          </li>
        </ul>
        <p v-else class="no-data-text">No seekers found.</p>
      </div>

      <!-- Leaders List -->
      <div class="list-card">
        <h3>Open Slots by Leader</h3>
        <ul v-if="leaderStats.length > 0">
          <li v-for="leader in leaderStats" :key="leader.id">
            <span class.="leader-name">{{ leader.name }}</span>
            <span 
              class.="slot-count"
              :class="{ 'is-full': leader.openSlots <= 0 }"
            >
              {{ leader.current }} / {{ leader.capacity }}
            </span>
          </li>
        </ul>
        <p v-else class="no-data-text">No Dgroup Leaders registered.</p>
      </div>
    </div>
    
    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.matching-container {
  padding: 16px;
  width: 95vw;
  max-width: 700px;
}
h2 {
  margin-top: 0;
  text-align: center;
  color: #0D47A1;
}

.lists-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 24px;
}
@media (min-width: 640px) {
  .lists-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.list-card {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
}
.list-card h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 40vh;
  overflow-y: auto;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}
li .leader-name {
  font-weight: 500;
}
li .slot-count {
  font-weight: 700;
  color: #2E7D32; /* Green */
}
li .slot-count.is-full {
  color: #D32F2F; /* Red */
}

.no-data-text {
  font-size: 14px;
  color: #78909C;
  text-align: center;
  padding: 20px 0;
}

.close-btn {
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