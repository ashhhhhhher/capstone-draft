<script setup>
import { computed } from 'vue'
import { Plus, Settings } from 'lucide-vue-next' // 1. Import Settings icon
import { useEventsStore } from '../stores/events'

// 2. Define both emits
const emit = defineEmits(['open-create-event', 'open-event-list'])

const eventsStore = useEventsStore()
const currentEvent = computed(() => eventsStore.currentEvent)

const eventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) {
    return "No Date Set"
  }
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const date = new Date(currentEvent.value.date + 'T00:00:00')
  return date.toLocaleDateString('en-US', options)
})

const eventTime = computed(() => {
    if (!currentEvent.value || !currentEvent.value.time) {
      return ""
    }
    const [hours, minutes] = currentEvent.value.time.split(':')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes} ${ampm}`
})

function createEvent() {
  emit('open-create-event')
}

// 3. New function for the Manage button
function manageEvents() {
  emit('open-event-list')
}
</script>

<template>
  <div class="card event-snapshot">
    <div class="event-info">
      <span class="date">{{ eventDate }} {{ eventTime ? `at ${eventTime}` : '' }}</span>
      <h2 class="event-name">{{ currentEvent ? currentEvent.name : "No Event Active" }}</h2>
    </div>
    
    <!-- 4. Wrapper for the two buttons -->
    <div class="button-wrapper">
      <button class="btn-secondary" @click="manageEvents">
        <Settings :size="18" />
      </button>
      <button class="create-btn" @click="createEvent">
        <Plus :size="20" />
        <span>Create</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.card {
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.event-snapshot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.event-info {
  flex-grow: 1;
  margin-right: 16px;
}
.event-info .date {
  font-size: 14px;
  color: #546E7A;
  font-weight: 500;
}
.event-info .event-name {
  font-size: 22px;
  font-weight: 600;
  color: #333;
  margin: 4px 0 0 0;
}
.button-wrapper {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.create-btn {
  background-color: #1976D2;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  transition: all 0.2s ease;
}
.create-btn:hover {
  background-color: #1565C0;
}
.btn-secondary {
  background-color: #ECEFF1;
  color: #37474F;
  border: none;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-secondary:hover {
  background-color: #CFD8DC;
}
</style>