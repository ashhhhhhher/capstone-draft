<script setup>
import { ref, watch, onMounted } from 'vue'
import { useEventsStore } from '../stores/events'

// 1. Define props
const props = defineProps({
  eventToEdit: Object // This will be null if creating, or an object if editing
})

const emit = defineEmits(['close'])
const eventsStore = useEventsStore()

// 2. Set mode based on prop
const isEditMode = ref(false)

const eventId = ref(null)
const eventName = ref('')
const eventDate = ref('')
const eventTime = ref('')
const eventDescription = ref('')

// 3. This 'watch' function pre-fills the form if we are editing
watch(() => props.eventToEdit, (newEvent) => {
  if (newEvent) {
    isEditMode.value = true
    eventId.value = newEvent.id
    eventName.value = newEvent.name
    eventDate.value = newEvent.date
    eventTime.value = newEvent.time
    eventDescription.value = newEvent.description
  } else {
    isEditMode.value = false
    eventId.value = null
    eventName.value = ''
    eventDate.value = ''
    eventTime.value = ''
    eventDescription.value = ''
  }
}, { immediate: true }) // 'immediate: true' runs this check on load


function handleSubmit() {
  if (!eventName.value || !eventDate.value || !eventTime.value) {
    alert('Please fill in the event name, date, and time.')
    return
  }

  const eventData = {
    name: eventName.value,
    date: eventDate.value,
    time: eventTime.value,
    description: eventDescription.value
  }

  // 4. Call the correct store action
  if (isEditMode.value) {
    eventsStore.updateEvent(eventId.value, eventData)
  } else {
    eventsStore.createEvent(eventData)
  }

  emit('close')
}
</script>

<template>
  <div class="form-container">
    <!-- 5. Dynamic title -->
    <h2>{{ isEditMode ? 'Edit Event' : 'Create New Event' }}</h2>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="eventName">Event Name</label>
        <input type="text" id="eventName" v-model="eventName" required />
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="eventDate">Event Date</label>
          <input type="date" id="eventDate" v-model="eventDate" required />
        </div>
        <div class="form-group">
          <label for="eventTime">Event Time</label>
          <input type="time" id="eventTime" v-model="eventTime" required />
        </div>
      </div>

      <div class="form-group">
        <label for="eventDescription">Description (Optional)</label>
        <textarea id="eventDescription" v-model="eventDescription"></textarea>
      </div>

      <!-- 6. Dynamic button text -->
      <button type="submit" class="submit-btn">
        {{ isEditMode ? 'Update Event' : 'Save Event' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
h2 {
  margin-top: 0;
  margin-bottom: 24px;
  text-align: center;
  color: #333;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box; 
  font-size: 16px;
}
.submit-btn {
  width: 100%;
  padding: 14px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.submit-btn:hover {
  background-color: #1565C0;
}
</style>