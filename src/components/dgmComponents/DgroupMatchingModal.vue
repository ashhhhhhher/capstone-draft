<script setup>
import { computed } from 'vue'
import { useMembersStore } from '../../stores/members'
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

    const ranked = candidates
      .map(l => ({
        ...l,
        ageGap: (l.age !== null && sAge !== null) ? (l.age - sAge) : null,
        score: (l.openSlots * 10) + ((l.age !== null && sAge !== null) ? (l.age - sAge) : 0)
      }))
      .sort((a, b) => b.score - a.score)

    const topLeaders = ranked.slice(0, 3)

    return {
      seekerId: seeker.id,
      seekerName: fullName(seeker),
      seekerAge: sAge,
      seekerGender: sGender,
      recommendations: topLeaders,
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
      isFirstTimer: false,
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

      <!-- LEFT PANEL: Seekers + Suggestions -->
      <div class="list-card">
        <h3>Suggestions ({{ suggestions.length }})</h3>

        <ul v-if="suggestions.length > 0">
          <li v-for="s in suggestions" :key="s.seekerId">
            <details open class="seeker-row">
              <summary class="seeker-summary">
                <span class="chevron">▾</span>

                <div class="seeker-block">
                  <div class="seeker-name">{{ s.seekerName }}</div>
                  <div class="seeker-meta">
                    {{ s.seekerGender }}
                    <span v-if="s.seekerAge !== null">• {{ s.seekerAge }} yrs</span>
                  </div>
                </div>
              </summary>

              <div class="suggestion-block">
                <template v-if="s.recommendations.length">
                  <div
                    v-for="leader in s.recommendations"
                    :key="leader.id"
                    class="leader-suggestion"
                  >
                    <div class="leader-main">
                      <span class="leader-name">{{ leader.name }}</span>
                      <span class="leader-meta">
                        {{ leader.openSlots }} slot(s) • age gap {{ leader.ageGap }} yrs
                      </span>
                    </div>

                    <button
                      class="assign-btn"
                      @click="assignLeader(s.seekerId, leader.name)"
                    >
                      Assign
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="no-suggestion">No match yet</div>
                  <div class="reason">No eligible leader meets the rules yet.</div>
                </template>
              </div>
            </details>
          </li>
        </ul>

        <p v-else class="no-data-text">No seekers found.</p>
      </div>

      <!-- RIGHT PANEL: Leader Slots -->
      <div class="list-card">
        <h3>Open Slots by Leader</h3>

        <ul v-if="leaderStats.length > 0">
        <li
          v-for="leader in leaderStats"
          :key="leader.id"
          class="leader-row"
        >
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

/* =========================
   MODAL CONTAINER
========================= */
.matching-container {
  max-width: 960px;
  max-height: 90vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

h2 {
  margin: 0;
  text-align: center;
  color: #0D47A1;
}

/* =========================
   GRID LAYOUT
========================= */
.lists-grid {
  flex: 1;                   /* ← allows it to grow */
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 16px;
  overflow: hidden;          /* ← KEY */
}


@media (min-width: 900px) {
  .lists-grid {
    grid-template-columns: 2.2fr 1fr;
  }
}

/* =========================
   LIST CARD
========================= */
.list-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;          /* ← KEY */
}

.list-card h3 {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
}

/* =========================
   LIST BASE
========================= */
ul {
  flex: 1;
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}


/* =========================
   SEEKER ITEM
========================= */
li {
  margin-bottom: 10px;
}

/* =========================
   COLLAPSIBLE ROW
========================= */
.seeker-row {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
}

/* =========================
   SUMMARY (HEADER)
========================= */
.seeker-summary {
  list-style: none;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
}

.seeker-summary::-webkit-details-marker {
  display: none;
}

/* Chevron icon */
.chevron {
  font-size: 14px;
  color: #475569;
  transition: transform 0.2s ease;
}

/* Rotate when closed */
details:not([open]) .chevron {
  transform: rotate(-90deg);
}

/* =========================
   SEEKER INFO
========================= */
.seeker-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.seeker-name {
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
}

.seeker-meta {
  font-size: 12px;
  color: #64748b;
}

/* =========================
   CONTENT AREA
========================= */
.suggestion-block {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* =========================
   LEADER SUGGESTION
========================= */
.leader-suggestion {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

/* Leader text */
.leader-main {
  display: flex;
  flex-direction: column;
}

.leader-name {
  font-weight: 600;
  font-size: 13px;
  color: #166534;
}

.leader-meta {
  font-size: 11px;
  color: #64748b;
}

/* =========================
   ASSIGN BUTTON
========================= */
.assign-btn {
  padding: 4px 10px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

/* =========================
   EMPTY STATES
========================= */
.no-suggestion {
  font-size: 13px;
  font-weight: 600;
  color: #b91c1c;
}

.reason {
  font-size: 11px;
  color: #64748b;
}

.no-data-text {
  font-size: 14px;
  color: #94a3b8;
  text-align: center;
  padding: 24px 0;
}
/* =========================
   LEADER LIST (RIGHT PANEL)
========================= */

.leader-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  gap: 12px;
}

/* Leader name */
.leader-name {
  font-weight: 500;
  font-size: 14px;
  color: #0f172a;
  line-height: 1.2;
}

/* Slot count */
.slot-count {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #15803d;
}

/* Full capacity */
.slot-count.is-full {
  background: #fee2e2;
  color: #b91c1c;
}


/* =========================
   MOBILE TWEAKS
========================= */
@media (max-width: 480px) {
  .leader-suggestion {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .assign-btn {
    align-self: flex-end;
    margin-top: 4px;
  }
}

@media (max-width: 480px) {
  .matching-container {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}


/* =========================
   CLOSE BUTTON
========================= */
.close-btn {
  width: 100%;
  padding: 14px;
  margin-top: 20px;
  background-color: #2563eb;
  color: white;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
}
</style>