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
.event-snapshot { border-radius: 20px; padding: 20px 32px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; height: 82%; transition: all 0.3s ease; cursor: pointer; border: 1px solid #fecaca; }
.event-snapshot.red-bg { background-color: #fff1f2; border: 1px solid #fee2e2; }
.event-info { flex-grow: 1; margin-right: 12px; position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: center; }
.event-type-tag { display: inline-block; background: rgba(255, 255, 255, 0.2); color: white; padding: 2px 10px; border-radius: 100px; font-size: 9px; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; width: fit-content; }
.event-type-tag.light { background: #ef4444; color: #ffffff; }
.event-info .date { font-size: 13px; color: #991b1b; font-weight: 600; display: block; margin-bottom: 2px; opacity: 0.8; }
.event-info .event-name { font-size: 24px; font-weight: 800; color: #7f1d1d; margin: 0; letter-spacing: -0.01em; line-height: 1.2; }
.button-wrapper { flex-shrink: 0; position: relative; z-index: 2; }
.manage-btn { background-color: #ef4444; color: white; border: none; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); transition: all 0.2s ease; }
.manage-btn:hover { background-color: #dc2626; transform: scale(1.05); }
.event-snapshot.has-photo { background-size: cover; background-position: center; color: white; border: none; }
.has-photo .overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, rgba(127, 29, 29, 0.9) 0%, rgba(127, 29, 29, 0.4) 100%); z-index: 1; }
.has-photo .event-info .date { color: rgba(255, 255, 255, 0.9); }
.has-photo .event-info .event-name { color: #fff; }
.has-photo .manage-btn { background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: none; backdrop-filter: blur(4px); }
</style>