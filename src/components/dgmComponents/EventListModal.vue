<script setup>
import { computed } from 'vue'
import { Edit2, Trash2, Calendar, Clock, MapPin } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../../stores/events'

const emit = defineEmits(['close', 'editEvent'])
const eventsStore = useEventsStore()
const { allEvents } = storeToRefs(eventsStore)

// Hardcoded for your 2025/2026 timeline
const todayStr = '2025-11-08'

const upcomingEvents = computed(() => {
  return allEvents.value.filter(e => e.date >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

function handleEdit(event) { emit('editEvent', event) }
function handleDelete(event) {
  if (confirm(`Are you sure you want to delete "${event.name}"?`)) {
    eventsStore.deleteEvent(event.id)
  }
}
</script>

<template>
  <div class="event-list-container">
    <div class="modal-header">
      <h2>Manage Events</h2>
      <p>Upcoming Schedule</p>
    </div>
    
    <div class="scroll-area">
      <div v-if="upcomingEvents.length > 0" class="vertical-stack">
        <div v-for="event in upcomingEvents" :key="event.id" class="event-v-card">
          <div class="v-card-top">
            <span v-if="event.eventType" class="badge">{{ event.eventType === 'service' ? 'Service' : 'CCF Event' }}</span>
            <span v-if="event.date === todayStr" class="badge today">Today</span>
          </div>
          
          <div class="v-card-content">
            <h4 class="event-title">{{ event.name }}</h4>
            <div class="meta-list">
              <div class="meta-row"><Calendar :size="14" /> <span>{{ new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {dateStyle: 'full'}) }}</span></div>
              <div class="meta-row"><Clock :size="14" /> <span>{{ event.time }}</span></div>
            </div>
          </div>

          <div class="v-card-actions">
            <button class="v-btn edit" @click="handleEdit(event)">
              <Edit2 :size="14" /> Edit Details
            </button>
            <button class="v-btn delete" @click="handleDelete(event)">
              <Trash2 :size="14" /> Delete
            </button>
          </div>
        </div>
      </div>
      <p v-else class="no-data">No events found.</p>
    </div>

    <button class="footer-close-btn" @click="emit('close')">Done</button>
  </div>
</template>

<style scoped>
.event-list-container { padding: 20px; width: 100%; max-width: 500px; margin: 0 auto; background: #fff; }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header h2 { color: #0D47A1; margin: 0; font-size: 24px; font-weight: 800; }
.modal-header p { color: #90A4AE; margin: 4px 0 0; font-size: 14px; }
.scroll-area { max-height: 65vh; overflow-y: auto; padding: 4px; }
.vertical-stack { display: flex; flex-direction: column; gap: 20px; align-items: center; }
.event-v-card { width: 100%; max-width: 380px; background: #fff; border-radius: 16px; border: 1px solid #ECEFF1; box-shadow: 0 10px 20px rgba(0,0,0,0.04); overflow: hidden; display: flex; flex-direction: column; }
.v-card-top { padding: 12px 16px 4px; display: flex; gap: 8px; }
.badge { background: #E3F2FD; color: #1976D2; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
.badge.today { background: #E8F5E9; color: #2E7D32; }
.v-card-content { padding: 12px 16px 20px; text-align: left; }
.event-title { margin: 0 0 12px; font-size: 18px; color: #263238; font-weight: 700; line-height: 1.2; }
.meta-list { display: flex; flex-direction: column; gap: 6px; }
.meta-row { display: flex; align-items: center; gap: 8px; color: #607D8B; font-size: 13px; }
.v-card-actions { display: flex; flex-direction: column; border-top: 1px solid #F5F7F8; }
.v-btn { border: none; background: transparent; padding: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 600; transition: background 0.2s; }
.v-btn.edit { color: #1976D2; border-bottom: 1px solid #F5F7F8; }
.v-btn.edit:hover { background: #F0F7FF; }
.v-btn.delete { color: #D32F2F; }
.v-btn.delete:hover { background: #FFF5F5; }
.no-data { text-align: center; color: #CFD8DC; padding: 40px; }
.footer-close-btn { width: 100%; margin-top: 24px; padding: 16px; background: #0D47A1; color: #fff; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(13, 71, 161, 0.2); }
</style>