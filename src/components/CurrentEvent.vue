<script setup>
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { useEventsStore } from '../stores/events'

const emit = defineEmits(['open-calendar']) 

const eventsStore = useEventsStore()
const currentEvent = computed(() => eventsStore.currentEvent)

// --- Computed Properties ---
const hasPhoto = computed(() => {
  return currentEvent.value && currentEvent.value.photoURL
})

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

const backgroundStyle = computed(() => {
  if (hasPhoto.value) {
    return { backgroundImage: `url(${currentEvent.value.photoURL})` }
  }
  return {}
})

const eventTypeDisplay = computed(() => {
  if (!currentEvent.value) return null
  if (currentEvent.value.eventType === 'service') return 'Wknd Service'
  if (currentEvent.value.eventType === 'ccf_event') return 'CCF Event'
  return null
})

function openCalendar() {
  emit('open-calendar')
}
</script>

<template>
  <div class="card event-snapshot" 
    :class="{ 'has-photo': hasPhoto, 'blue-bg': !hasPhoto }" 
    :style="backgroundStyle"
  >
    <div class="overlay" v-if="hasPhoto"></div>
    
    <div class="event-info">
      <span v-if="eventTypeDisplay" 
        class="event-type-tag"
        :class="{ 'light': !hasPhoto }"
      >
        {{ eventTypeDisplay }}
      </span>
      <span class="date">{{ eventDate }} {{ eventTime ? `at ${eventTime}` : '' }}</span>
      <h2 class="event-name">{{ currentEvent ? currentEvent.name : "No Event Active" }}</h2>
    </div>
    
    <!-- calendar button -->
    <div class="button-wrapper">
      <button class="manage-btn" @click="openCalendar">
        <Calendar :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* --- DEFAULT (NO-PHOTO) STYLES --- */
.event-snapshot {
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
  border: 1px solid #BBDEFB; 
}

.event-snapshot.blue-bg {
  background-color: #E3F2FD; 
}

.event-info {
  flex-grow: 1;
  margin-right: 16px;
  position: relative;
  z-index: 2;
}

.event-type-tag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.event-type-tag.light {
  background: #BBDEFB;
  color: #0D47A1;
}

.event-info .date {
  font-size: 14px;
  color: #546E7A; 
  font-weight: 500;
  display: block;
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
  position: relative;
  z-index: 2;
}

.manage-btn {
  background-color: #1976D2;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px; 
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  transition: all 0.2s ease;
}
.manage-btn:hover {
  background-color: #1565C0;
}

/* --- PHOTO STYLES (Overrides) --- */
.event-snapshot.has-photo {
  background-size: cover;
  background-position: center;
  color: white;
  border: none;
}

.has-photo .overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%);
  z-index: 1;
}

.has-photo .event-info .date {
  color: #E0E0E0;
}

.has-photo .event-info .event-name {
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

.has-photo .manage-btn {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: none;
}
.has-photo .manage-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>