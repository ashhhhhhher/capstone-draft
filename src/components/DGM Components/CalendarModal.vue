<script setup>
import { ref, computed } from 'vue'
import ExportButton from './ExportButton.vue'
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, MapPin } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useEventsStore } from '../../stores/events'

const emit = defineEmits(['close', 'createEvent', 'editEvent', 'exportEvent'])
// accept isMember from parent; when true, hide create/edit/delete UI for members
const props = defineProps({
  isMember: { type: Boolean, default: false }
})
const eventsStore = useEventsStore()
const { allEvents } = storeToRefs(eventsStore)

// --- Calendar State ---
const currentDate = ref(new Date())
const selectedDayEvents = ref([]) 
const selectedDateStr = ref(null)

// --- Computed ---
const currentMonthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const eventsByDate = computed(() => {
    return allEvents.value.reduce((acc, event) => {
        if (!acc[event.date]) {
            acc[event.date] = [];
        }
        acc[event.date].push(event);
        return acc;
    }, {})
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const days = []
  
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push({ day: '', events: [] })
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      day: i,
      dateStr: dateStr,
      events: eventsByDate.value[dateStr] || [],
      isToday: dateStr === new Date().toISOString().split('T')[0]
    })
  }
  return days
})

// --- Functions ---
function prevMonth() {
  selectedDayEvents.value = []
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

function nextMonth() {
  selectedDayEvents.value = []
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

function handleDayClick(cell) {
    selectedDateStr.value = cell.dateStr;
    if (cell.events.length > 0) {
        selectedDayEvents.value = cell.events;
    } else {
        selectedDayEvents.value = [];
    }
}

function handleEdit(event) {
    emit('editEvent', event)
}

function handleExport(event) {
    emit('exportEvent', event)
}

function handleDelete(event) {
    if (confirm(`Are you sure you want to delete "${event.name}"? This cannot be undone.`)) {
        eventsStore.deleteEvent(event.id)
        selectedDayEvents.value = selectedDayEvents.value.filter(e => e.id !== event.id)
    }
}
</script>

<template>
  <div class="calendar-layout-container">
    
    <!-- Left Side: Calendar View -->
    <div class="calendar-view">
        <div class="calendar-header">
            <button class="nav-btn" @click="prevMonth"><ChevronLeft :size="24" /></button>
            <h2>{{ currentMonthName }}</h2>
            <button class="nav-btn" @click="nextMonth"><ChevronRight :size="24" /></button>
        </div>
        
        <div class="calendar-grid">
            <div class="day-name">Sun</div>
            <div class="day-name">Mon</div>
            <div class="day-name">Tue</div>
            <div class="day-name">Wed</div>
            <div class="day-name">Thu</div>
            <div class="day-name">Fri</div>
            <div class="day-name">Sat</div>
            
            <div 
                v-for="(cell, index) in calendarDays" 
                :key="index"
                class="day-cell"
                :class="{ 
                    'is-today': cell.isToday, 
                    'has-event': cell.events && cell.events.length > 0,
                    'is-selected': cell.dateStr === selectedDateStr 
                }"
                @click="handleDayClick(cell)"
            >
                <span class="day-number">{{ cell.day }}</span>
                
                <div class="event-dots">
                    <div 
                        v-for="event in cell.events" 
                        :key="event.id" 
                        class="dot"
                        :title="event.name"
                        :class="event.eventType === 'service' ? 'dot-service' : 'dot-event'"
                    ></div>
                </div>
            </div>
        </div>
        
        <div class="legend">
            <div class="legend-item"><span class="dot dot-service"></span> Wknd Service</div>
            <div class="legend-item"><span class="dot dot-event"></span> CCF Event</div>
        </div>
        
        <!-- hide create button for members -->
        <button v-if="!props.isMember" class="create-event-btn" @click="emit('createEvent')">
            <Plus :size="20" /> Create New Event
        </button>
    </div>

    <!-- Right Side: Event Details  -->
    <div class="event-details-panel">
        <div v-if="selectedDayEvents.length > 0">
            <h3>Events on {{ new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'}) }}</h3>
            <div class="event-list-details">
                <div v-for="event in selectedDayEvents" :key="event.id" class="detail-card">
                    <div class="detail-header">
                        <div class="detail-name">
                            <span :class="event.eventType === 'service' ? 'service-tag' : 'ccf-tag'">
                                {{ event.eventType === 'service' ? 'Service' : 'CCF Event' }}
                            </span>
                            <h4>{{ event.name }}</h4>
                        </div>
                        <!-- hide edit/delete for members -->
                        <div class="action-buttons" v-if="!props.isMember">
                            <button class="btn-icon btn-edit" @click="handleEdit(event)">
                                <Edit2 :size="16" />
                            </button>
                            <button class="btn-icon btn-delete" @click="handleDelete(event)">
                                <Trash2 :size="16" />
                            </button>
                            
                        </div>
                    </div>
                    
                    <div class="detail-body">
                        <p><strong>Time:</strong> {{ event.time }}</p>
                        <p class="location-detail">
                            <MapPin :size="14" /> {{ event.eventLocation || 'Online/Default' }}
                        </p>
                        <p class="description">{{ event.description || 'No description provided.' }}</p>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="no-selection">
            <Calendar :size="32" />
            <p>Select a date to view events.</p>
        </div>
    </div>

    <button class="close-btn" @click="emit('close')">Close Calendar</button>
  </div>
</template>

<style scoped>
.calendar-layout-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.calendar-view {
    padding: 16px;
    flex-grow: 1;
    overflow-y: auto;
}

@media (min-width: 900px) { 
    .calendar-layout-container {
        flex-direction: row;
        gap: 20px;
    }
    .calendar-view {
        flex-basis: 50%; 
        border-right: 1px solid #ECEFF1;
        flex-shrink: 0;
        max-height: 80vh;
    }
    .event-details-panel {
        flex-basis: 40%;
        flex-shrink: 0;
        max-height: 80vh;
        padding-left: 20px;
    }
}
@media (max-width: 899px) {
    .event-details-panel {
        margin-top: 20px;
        border-top: 1px solid #ECEFF1;
        padding: 16px;
    }
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.calendar-header h2 {
  margin: 0; color: #0D47A1; font-size: 20px;
}
.nav-btn { background: none; border: none; cursor: pointer; color: #546E7A; padding: 8px; border-radius: 50%; }
.nav-btn:hover { background-color: #ECEFF1; }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}
.day-name { text-align: center; font-size: 12px; font-weight: 600; color: #90A4AE; padding-bottom: 8px; }

.day-cell {
  height: 60px;
  border: 1px solid #ECEFF1;
  border-radius: 8px;
  padding: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.day-cell:hover { background-color: #FAFAFA; }
.day-cell.is-today { border-color: #1976D2; background-color: #E3F2FD; }
.day-cell.is-selected {
    border: 2px solid #1976D2; 
    background-color: #BBDEFB;
}
.day-number { font-size: 14px; font-weight: 500; color: #333; }

/* Event Dots */
.event-dots { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; justify-content: center; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-service { background-color: #1976D2; }
.dot-event { background-color: #FFA000; }

.legend { display: flex; justify-content: center; gap: 20px; margin-top: 16px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #546E7A; }

.create-event-btn {
    width: 100%;
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    flex-shrink: 0;
}

/* --- Details Panel Styles --- */
.event-details-panel h3 {
    color: #333;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 15px 0;
    flex-shrink: 0;
}
.event-list-details {
    display: flex;
    flex-direction: column;
    gap: 15px;
    overflow-y: auto; 
    flex-grow: 1;
    padding-right: 8px;
    margin-right: -8px;
}
.detail-card {
    background: #fff;
    border: 1px solid #ECEFF1;
    border-radius: 8px;
    padding: 15px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.detail-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 1px solid #ECEFF1; padding-bottom: 10px; margin-bottom: 10px;
}
.detail-name { display: flex; flex-direction: column; }
.detail-name h4 { margin: 4px 0 0 0; font-size: 16px; font-weight: 600; }
.service-tag { color: #1976D2; font-weight: 700; font-size: 10px; }
.ccf-tag { color: #FFA000; font-weight: 700; font-size: 10px; }
.action-buttons { display: flex; gap: 8px; }
.btn-icon {
    background: #ECEFF1; border: none; border-radius: 50%;
    width: 30px; height: 30px; display: flex; align-items: center;
    justify-content: center; cursor: pointer;
}
.btn-edit { color: #1976D2; }
.btn-delete { color: #D32F2F; }

.detail-body p { margin: 0 0 5px 0; font-size: 14px; color: #333; }
.location-detail { display: flex; align-items: center; gap: 5px; color: #546E7A; }
.description { font-style: italic; color: #78909C; margin-top: 10px !important; white-space: pre-wrap; }
.no-selection {
    text-align: center; padding: 40px 20px; color: #90A4AE;
    border: 2px dashed #CFD8DC; border-radius: 8px; margin-top: 40px;
    flex-shrink: 0;
}

.close-btn {
  width: 100%; padding: 14px; margin-top: 20px; background-color: #1976D2;
  color: white; font-size: 16px; font-weight: 600; border: none;
  border-radius: 8px; cursor: pointer; flex-shrink: 0;
}
</style>