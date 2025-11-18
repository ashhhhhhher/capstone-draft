<script setup>
import { computed } from 'vue'
import { useMembersStore } from '../stores/members'
import { storeToRefs } from 'pinia'

const emit = defineEmits(['close'])

// --- Store Setup ---
const membersStore = useMembersStore()
// Get the live computed lists from the store
const { seekers, leaders, members } = storeToRefs(membersStore)

// --- Helpers ---
function fullName(person) {
  return `${person.firstName} ${person.lastName}`
}

// --- Computed ---
// Leader stats with capacity + attributes
const leaderStats = computed(() => {
  return leaders.value.map(leader => {
    const name = fullName(leader)
    const currentMembers = members.value.filter(m => m.dgroupLeader === name).length
    const capacity = leader.dgroupCapacity || 8
    const openSlots = capacity - currentMembers
    return {
      id: leader.id,
      name,
      gender: leader.gender || null,
      age: leader.age ?? null,
      current: currentMembers,
      capacity,
      openSlots
    }
  }).sort((a, b) => b.openSlots - a.openSlots)
})

// Suggestions per seeker (same gender + age gap >=3 + open slots)
const suggestions = computed(() => {
  return seekers.value.map(seeker => {
    const sAge = seeker.age ?? null
    const sGender = seeker.gender || null

    const candidates = leaderStats.value.filter(l => {
      if (l.openSlots <= 0) return false
      if (sGender && l.gender && l.gender !== sGender) return false
      if (sAge !== null && l.age !== null) {
        return (l.age - sAge) >= 3
      }
      return false
    })

    const ranked = candidates.map(l => ({
      ...l,
      ageGap: (l.age !== null && sAge !== null) ? (l.age - sAge) : null,
      score: (l.openSlots * 10) + ((l.age !== null && sAge !== null) ? (l.age - sAge) : 0)
    })).sort((a, b) => b.score - a.score)

    const top = ranked[0]
    return {
      seekerId: seeker.id,
      seekerName: fullName(seeker),
      seekerAge: sAge,
      seekerGender: sGender,
      suggestedLeader: top ? top.name : null,
      reason: top ? `Same gender; age gap ${top.ageGap} yrs; ${top.openSlots} open slot(s).` : 'No eligible leader meets the rules yet.',
      hasDataIssues: (sAge === null) || ranked.length === 0
    }
  })
})

// --- Actions ---
async function assignLeader(seekerId, leaderName) {
  const seeker = members.value.find(m => m.id === seekerId)
  if (!seeker) return
  const updated = {
    ...seeker,
    dgroupLeader: leaderName,
    finalTags: {
      ...seeker.finalTags,
      isSeeker: false,
      isRegular: true
    }
  }
  try {
    await membersStore.updateMember(updated)
  } catch (e) {
    console.error('Failed to assign leader:', e)
  }
}
</script>

<template>
  <div class="matching-container">
    <h2>Dgroup Matching</h2>
    
    <div class="lists-grid">
      
      <!-- Seekers + Suggestions -->
      <div class="list-card">
        <h3>Suggestions ({{ suggestions.length }})</h3>
        <ul v-if="suggestions.length > 0">
          <li v-for="s in suggestions" :key="s.seekerId">
            <div class="seeker-block">
              <div class="seeker-name">{{ s.seekerName }}</div>
              <div class="seeker-meta">{{ s.seekerGender }} <span v-if="s.seekerAge !== null">• {{ s.seekerAge }} yrs</span></div>
            </div>
            <div class="suggestion-block">
              <template v-if="s.suggestedLeader">
                <div class="suggested">→ {{ s.suggestedLeader }}</div>
                <div class="reason">{{ s.reason }}</div>
                <button class="assign-btn" @click="assignLeader(s.seekerId, s.suggestedLeader)">Assign</button>
              </template>
              <template v-else>
                <div class="no-suggestion">No match yet</div>
                <div class="reason">{{ s.reason }}</div>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="no-data-text">No seekers found.</p>
      </div>

      <!-- Leaders List -->
      <div class="list-card">
        <h3>Open Slots by Leader</h3>
        <ul v-if="leaderStats.length > 0">
          <li v-for="leader in leaderStats" :key="leader.id">
            <span class="leader-name">{{ leader.name }}</span>
            <span 
              class="slot-count"
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
  max-width: 900px;
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
@media (min-width: 800px) {
  .lists-grid {
    grid-template-columns: 2fr 1fr;
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
  max-height: 60vh;
  overflow-y: auto;
}
li {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
}

.seeker-block { display: flex; flex-direction: column; }
.seeker-name { font-weight: 600; }
.seeker-meta { color: #607D8B; font-size: 12px; }

.suggestion-block { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.suggested { font-weight: 600; color: #1B5E20; }
.reason { color: #607D8B; font-size: 12px; }
.no-suggestion { color: #D32F2F; font-weight: 600; }
.assign-btn { margin-top: 6px; padding: 6px 10px; background: #1976D2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }

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