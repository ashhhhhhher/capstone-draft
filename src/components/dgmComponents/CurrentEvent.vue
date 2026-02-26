<script setup>
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { useEventsStore } from '../../stores/events'

const emit = defineEmits(['open-calendar', 'open-details'])
const eventsStore = useEventsStore()
const currentEvent = computed(() => eventsStore.currentEvent)

const hasPhoto = computed(() => !!(currentEvent.value && currentEvent.value.photoURL))

const eventDate = computed(() => {
  if (!currentEvent.value || !currentEvent.value.date) return "No Event Active"
  return new Date(currentEvent.value.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
})

const eventTime = computed(() => {
  if (!currentEvent.value || !currentEvent.value.time) return ""
  const [hours, minutes] = currentEvent.value.time.split(':')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${minutes} ${ampm}`
})

const backgroundStyle = computed(() => hasPhoto.value ? { backgroundImage: `url(${currentEvent.value.photoURL})` } : {})

const eventTypeDisplay = computed(() => {
  if (!currentEvent.value) return null
  if (currentEvent.value.eventType === 'service') return 'Wknd Service'
  if (currentEvent.value.eventType === 'ccf_event') return 'CCF Event'
  return 'Special Event'
})

function openCalendar(event) { event?.stopPropagation?.(); emit('open-calendar') }
function openDetails() { emit('open-details') }
</script>

<template>
  <div class="card event-snapshot" :class="{ 'has-photo': hasPhoto, 'red-bg': !hasPhoto }" :style="backgroundStyle" @click="openDetails">
    <div class="overlay" v-if="hasPhoto"></div>
    <div class="event-info">
      <span v-if="eventTypeDisplay" class="event-type-tag" :class="{ 'light': !hasPhoto }">{{ eventTypeDisplay }}</span>
      <span class="date">{{ eventDate }} {{ eventTime ? `at ${eventTime}` : '' }}</span>
      <h2 class="event-name">{{ currentEvent ? currentEvent.name : "Check back later for updates" }}</h2>
    </div>
    <div class="button-wrapper">
      <button class="manage-btn" @click.stop="openCalendar"><Calendar :size="18" /></button>
    </div>
  </div>
</template>

<style scoped>
/* Main Container */
.event-snapshot { border-radius: 20px; padding: 24px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); display: flex; flex-direction: row; justify-content: space-between; align-items: center; position: relative; overflow: hidden; min-height: 140px; transition: all 0.3s ease; cursor: pointer; border: 1px solid #fee2e2; }
.event-snapshot.red-bg { background-color: #fef2f2; }
/* Text Content Area */
.event-info { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 4px; flex-grow: 1; text-align: left; }
.event-type-tag { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 100px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; width: fit-content; }
.event-info .date { font-size: 14px; color: #991b1b; font-weight: 600; opacity: 0.7; letter-spacing: 0.01em; }
.event-info .event-name { font-size: 26px; font-weight: 800; color: #7f1d1d; margin: 0; line-height: 1.2; letter-spacing: -0.02em; }
/* Button Area */
.button-wrapper { position: relative; z-index: 2; flex-shrink: 0; margin-left: 20px; }
.manage-btn { background-color: #ef4444; color: white; border: none; border-radius: 12px; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 15px rgba(239, 68, 68, 0.25); transition: 0.2s ease; }
.manage-btn:hover { background-color: #dc2626; transform: scale(1.05); }
/* Photo State Overrides */
.event-snapshot.has-photo { background-size: cover; background-position: center; border: none; }
.has-photo .overlay { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(127, 29, 29, 0.9) 0%, rgba(127, 29, 29, 0.2) 100%); z-index: 1; }
.has-photo .event-info .date, .has-photo .event-info .event-name { color: white; }
.has-photo .manage-btn { background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: none; }
</style>