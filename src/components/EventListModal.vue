<script setup>
import { computed } from 'vue'
import { Edit2, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../stores/events'

const emit = defineEmits(['close', 'editEvent'])
const eventsStore = useEventsStore()
const { allEvents } = storeToRefs(eventsStore)

// 1. Get today's date string (based on your time)
const todayStr = '2025-11-08'

// 2. This computed prop now gets today AND all future events
const upcomingEvents = computed(() => {
  return allEvents.value.filter(e => e.date >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date)) // Show soonest first
})

// 3. The "Past Events" computed prop is REMOVED

function handleEdit(event) {
  emit('editEvent', event)
}

function handleDelete(event) {
  if (confirm(`Are you sure you want to delete "${event.name}"? This cannot be undone.`)) {
    eventsStore.deleteEvent(event.id)
  }
}
</script>

<template>
  <div class="event-list-container">
    <h2>Manage Events</h2>
    
    <div class="list-section">
      <h3>Current & Upcoming Events</h3>
      <ul v-if="upcomingEvents.length > 0">
        <li v-for="event in upcomingEvents" :key="event.id">
          <div class="event-details">
            <div class="event-name">
              <strong>{{ event.name }}</strong>
              <span v-if="event.eventType" class="event-type-tag">
                {{ event.eventType === 'service' ? 'Service' : 'CCF Event' }}
              </span>
              <!-- NEW: Add a tag if it's today -->
              <span v-if="event.date === todayStr" class="event-type-tag today-tag">
                Today
              </span>
            </div>
            <span>{{ new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {dateStyle: 'full'}) }} at {{ event.time }}</span>
          </div>
          <div class="event-actions">
            <button class="btn-icon btn-edit" @click="handleEdit(event)">
              <Edit2 :size="16" />
            </button>
            <button class="btn-icon btn-delete" @click="handleDelete(event)">
              <Trash2 :size="16" />
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="no-data-text">No upcoming events scheduled.</p>
    </div>

    <!-- 4. The "Past Events" list is REMOVED -->
    
    <button class="close-btn" @click="emit('close')">Close</button>
  </div>
</template>

<style scoped>
.event-list-container {
  padding: 16px;
  width: 95vw;
  max-width: 600px;
}
h2 {
  margin-top: 0;
  text-align: center;
  color: #0D47A1;
}
.list-section {
  margin-bottom: 24px;
}
.list-section h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 60vh; /* Increased height */
  overflow-y: auto;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
li:last-child {
  border-bottom: none;
}
.event-details {
  display: flex;
  flex-direction: column;
}
.event-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* Allow tags to wrap on small screens */
  gap: 8px;
}
.event-details strong {
  font-weight: 600;
  font-size: 16px;
}
.event-type-tag {
  background: #ECEFF1;
  color: #37474F;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.event-type-tag.today-tag {
  background-color: #E8F5E9;
  color: #2E7D32;
}
.event-details span {
  font-size: 14px;
  color: #546E7A;
}
.event-actions {
  display: flex;
  gap: 12px;
}
.btn-icon {
  background: none;
  border: 1px solid #CFD8DC;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-icon.btn-edit { color: #1976D2; }
.btn-icon.btn-edit:hover { background: #E3F2FD; border-color: #1976D2; }
.btn-icon.btn-delete { color: #D32F2F; }
.btn-icon.btn-delete:hover { background: #FFEBEE; border-color: #D32F2F; }

.no-data-text {
  font-size: 14px;
  color: #78909C;
  text-align: center;
  padding: 20px 0;
}
.close-btn {
  width: 100%;
  padding: 14px;
  margin-top: 16px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>