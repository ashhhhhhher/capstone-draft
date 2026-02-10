<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { useEventsStore } from '../../stores/events'
import { useAttendanceStore } from '../../stores/attendance'
import { storage } from '../../firebase'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { v4 as uuidv4 } from 'uuid'
import { XCircle, CheckCircle, Settings2, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  eventToEdit: Object
})
const emit = defineEmits(['close'])
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()

// --- Form State ---
const isEditMode = ref(false)
const eventId = ref(null)
const eventName = ref('')
const eventDate = ref('')
const eventTime = ref('')
const eventDescription = ref('')
const eventType = ref('service')
const eventLocation = ref('')
const eventSpeaker = ref('') 
const eventSeries = ref('')
const isAddingNewSpeaker = ref(false)
const isManagingSpeakers = ref(false)
const newSpeakerName = ref('')
const newSpeakerInput = ref(null)
const photoURL = ref('')
const imageFile = ref(null)

// --- UI State ---
const isUploading = ref(false)
const uploadProgress = ref(0)
const formStatus = ref({ type: '', message: '' }) // type: 'error' | 'success'

// Load speakers on mount
onMounted(() => {
  attendanceStore.fetchSpeakers()
})

watch(() => props.eventToEdit, (newEvent) => {
  if (newEvent) {
    isEditMode.value = true
    eventId.value = newEvent.id
    eventName.value = newEvent.name
    eventDate.value = newEvent.date
    eventTime.value = newEvent.time
    eventDescription.value = newEvent.description || ''
    eventType.value = newEvent.eventType
    eventLocation.value = newEvent.eventLocation || ''
    eventSpeaker.value = newEvent.eventSpeaker || '' 
    eventSeries.value = newEvent.eventSeries || ''  
    photoURL.value = newEvent.photoURL
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
    isEditMode.value = false
    eventId.value = null; eventName.value = ''; eventDate.value = '';
    eventTime.value = ''; eventDescription.value = '';
    eventType.value = 'service'; eventLocation.value = ''; 
    eventSpeaker.value = ''; eventSeries.value = ''; 
    photoURL.value = ''; imageFile.value = null;
    formStatus.value = { type: '', message: '' }
    isManagingSpeakers.value = false
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) {
    imageFile.value = file
  }
}

function setStatus(type, message) {
    formStatus.value = { type, message }
    // Auto clear success messages, keep errors until fixed
    if (type === 'success') {
        setTimeout(() => { formStatus.value = { type: '', message: '' } }, 3000)
    }
}

function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const filePath = `event_images/${uuidv4()}-${file.name}`
    const fileRef = storageRef(storage, filePath)
    const uploadTask = uploadBytesResumable(fileRef, file)
    
    uploadTask.on('state_changed', 
      (snapshot) => { 
        uploadProgress.value = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      },
      (error) => {
        console.error("Upload failed:", error)
        reject(error)
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadURL)
      }
    )
  })
}

async function deleteOldImage(url) {
  if (!url) return
  try {
    const fileRef = storageRef(storage, url)
    await deleteObject(fileRef)
  } catch (error) {
    console.warn("Could not delete old event image:", error)
  }
}

async function handleSubmit() {
  formStatus.value = { type: '', message: '' }
  
  if (!eventName.value || !eventDate.value || !eventTime.value || !eventLocation.value) {
    setStatus('error', 'Please fill in the event name, date, time, and location.')
    return
  }
  
  isUploading.value = true
  let newPhotoURL = photoURL.value 

  try {
    if (imageFile.value) {
      if (isEditMode.value && props.eventToEdit.photoURL) {
        await deleteOldImage(props.eventToEdit.photoURL)
      }
      newPhotoURL = await uploadImage(imageFile.value)
    }
    
    const eventData = {
      name: eventName.value,
      date: eventDate.value,
      time: eventTime.value,
      description: eventDescription.value,
      eventType: eventType.value,
      eventLocation: eventLocation.value,
      eventSpeaker: eventSpeaker.value, 
      eventSeries: eventSeries.value,  
      photoURL: newPhotoURL
    }

    if (eventType.value === 'b1g_event') {
      eventData.allowedAgeCategories = ['B1G']
    }

    if (isEditMode.value) {
      await eventsStore.updateEvent(eventId.value, eventData)
    } else {
      await eventsStore.createEvent(eventData)
    }
    
    isUploading.value = false
    setStatus('success', isEditMode.value ? 'Event updated successfully!' : 'Event created successfully!')
    
    // Slight delay before closing to show success message
    setTimeout(() => {
        emit('close')
    }, 1000)

  } catch (error) {
    isUploading.value = false
    setStatus('error', "An error occurred: " + error.message)
  }
}

// Watcher for "Add New" trigger
watch(eventSpeaker, (newVal) => {
  if (newVal === 'ADD_NEW') {
    isAddingNewSpeaker.value = true
    eventSpeaker.value = '' 
    nextTick(() => newSpeakerInput.value?.focus())
  }
})

function confirmNewSpeaker() {
  if (newSpeakerName.value.trim()) {
    const nameToAdd = newSpeakerName.value.trim()
    // Set form value
    eventSpeaker.value = nameToAdd
    // Save to Firestore permanently
    attendanceStore.addNewSpeaker(nameToAdd)
    // UI Reset
    newSpeakerName.value = ''
    isAddingNewSpeaker.value = false
  }
}

function cancelNewSpeaker() {
  isAddingNewSpeaker.value = false
  newSpeakerName.value = ''
  eventSpeaker.value = ''
}

async function handleDeleteSpeaker(speaker) {
  if (confirm(`Are you sure you want to delete "${speaker.name}" from the list?`)) {
    try {
      // Check if store has the delete action
      if (typeof attendanceStore.deleteSpeaker === 'function') {
        await attendanceStore.deleteSpeaker(speaker.id)
        
        // If the deleted speaker was currently selected, clear the selection
        if (eventSpeaker.value === speaker.name) {
          eventSpeaker.value = ''
        }
      } else {
        alert("Action needed: Please share your 'stores/attendance.js' file so I can add the 'deleteSpeaker' logic to the backend.")
      }
    } catch (error) {
      console.error(error)
      setStatus('error', 'Failed to delete speaker.')
    }
  }
}
</script>

<template>
  <div class="form-container">
    <div class="form-header">
      <h2>{{ isEditMode ? 'Edit Event' : 'Create New Event' }}</h2>
    </div>
    
    <!-- Status Message Banner -->
    <div v-if="formStatus.message" class="status-banner" :class="formStatus.type">
        <component :is="formStatus.type === 'error' ? XCircle : CheckCircle" :size="20" />
        <span>{{ formStatus.message }}</span>
    </div>
    
    <form class="form-body" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Event Type</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" v-model="eventType" value="service">
            <span>WKND</span>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="eventType" value="b1g_event">
            <span>B1G</span>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="eventType" value="ccf_event">
            <span>Updates</span> 
          </label>
        </div>
        <small v-if="eventType === 'service' || eventType === 'b1g_event'">Attendance will be recorded for this event.</small>
        <small v-else>This is an informational update (no attendance).</small>
      </div>
      
      <div class="form-group">
        <label for="eventName">Event Name</label>
        <input type="text" id="eventName" v-model="eventName" placeholder="e.g. Sunday Service" required />
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
        <label for="eventLocation">Location</label>
        <input type="text" id="eventLocation" v-model="eventLocation" placeholder="e.g., Baguio Convention Center" />
      </div>

      <div class="form-grid">
        <div class="form-group speaker-container">
          <label for="eventSpeaker">Speaker</label>
          <div class="speaker-selection-wrapper">
            
            <!-- MODE 1: Standard Select with Manage Button -->
            <div v-if="!isAddingNewSpeaker && !isManagingSpeakers" class="select-with-tools">
                <select 
                  id="eventSpeaker" 
                  v-model="eventSpeaker" 
                  class="styled-select"
                >
                  <option value="" disabled>Select a Speaker</option>
                  <option v-for="speaker in attendanceStore.speakersList" :key="speaker.id" :value="speaker.name">
                    {{ speaker.name }}
                  </option>
                  <option value="ADD_NEW" class="add-new-option">+ Add New Speaker...</option>
                </select>
                <button type="button" class="tool-btn" @click="isManagingSpeakers = true" title="Manage Speakers">
                    <Settings2 :size="18" />
                </button>
            </div>

            <!-- MODE 2: Add New Speaker Input -->
            <transition name="fade-slide">
              <div v-if="isAddingNewSpeaker" class="new-speaker-input-group">
                <input 
                  type="text" 
                  v-model="newSpeakerName" 
                  placeholder="Enter name" 
                  ref="newSpeakerInput"
                  @keyup.enter.stop="confirmNewSpeaker"
                />
                <div class="input-actions">
                  <button type="button" @click.stop="confirmNewSpeaker" class="btn-check">✓</button>
                  <button type="button" @click.stop="cancelNewSpeaker" class="btn-cancel">✕</button>
                </div>
              </div>
            </transition>

            <!-- MODE 3: Manage/Delete Speakers -->
            <transition name="fade-slide">
                <div v-if="isManagingSpeakers" class="manage-speakers-panel">
                    <div class="manage-header">
                        <span>Manage Speakers</span>
                        <button type="button" class="link-btn" @click="isManagingSpeakers = false">Done</button>
                    </div>
                    <ul class="speaker-list">
                        <li v-for="speaker in attendanceStore.speakersList" :key="speaker.id">
                            <span class="speaker-name">{{ speaker.name }}</span>
                            <button type="button" class="delete-btn" @click="handleDeleteSpeaker(speaker)" title="Delete">
                                <Trash2 :size="14" />
                            </button>
                        </li>
                        <li v-if="attendanceStore.speakersList.length === 0" class="empty-list">
                            No speakers found.
                        </li>
                    </ul>
                </div>
            </transition>

          </div>
        </div>

        <div class="form-group">
          <label for="eventSeries">Series Title</label>
          <input type="text" id="eventSeries" v-model="eventSeries" placeholder="e.g., Unstoppable" />
        </div>
      </div>

      <div class="form-group">
        <label for="eventDescription">Description (Optional)</label>
        <textarea id="eventDescription" v-model="eventDescription" rows="4"></textarea>
      </div>

      <div class="form-group">
        <label for="eventPhoto">Background Photo (Optional)</label>
        <div class="file-upload-wrapper">
             <input type="file" id="eventPhoto" @change="onFileChange" accept="image/png, image/jpeg">
        </div>
        <div v-if="photoURL" class="current-photo-preview">
            <p class="preview-label">Current Image:</p>
            <img :src="photoURL" alt="Current Event">
        </div>
      </div>
      
      <div v-if="isUploading" class="progress-bar">
        <div class="progress" :style="{ width: uploadProgress + '%' }"></div>
        <span>Uploading... {{ Math.round(uploadProgress) }}%</span>
      </div>
    </form>
    
    <div class="form-footer">
      <button 
        type="button" 
        class="submit-btn" 
        :disabled="isUploading" 
        @click="handleSubmit"
      >
        {{ isEditMode ? 'Update Event' : 'Save Event' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.form-container { width: 100%; display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; background: #fff; }
.form-header { flex-shrink: 0; margin-bottom: 20px; }
.form-header h2 { margin: 0; text-align: center; color: #333; }
.form-body { overflow-y: auto; flex-grow: 1; padding: 0 4px; } /* Added padding for scrollbar space */

/* Status Banner */
.status-banner {
    display: flex; align-items: center; gap: 10px;
    padding: 12px; margin-bottom: 16px; border-radius: 8px;
    font-size: 14px; font-weight: 500;
}
.status-banner.error { background-color: #FFEBEE; color: #D32F2F; border: 1px solid #FFCDD2; }
.status-banner.success { background-color: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; }

.form-footer { flex-shrink: 0; padding-top: 20px; border-top: 1px solid #ECEFF1; margin-top: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px; }
.form-group input, .form-group textarea, .form-group select { 
    width: 100%; padding: 10px 12px; border: 1px solid #CFD8DC; 
    border-radius: 6px; box-sizing: border-box; font-size: 14px; 
    transition: border-color 0.2s;
}
.form-group input:focus, .form-group textarea:focus, .form-group select:focus {
    border-color: #1976D2; outline: none;
}

.radio-group { display: flex; gap: 20px; margin-bottom: 8px; }
.radio-label { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }
.radio-label input { width: auto; margin: 0; }

.progress-bar { width: 100%; background-color: #ECEFF1; border-radius: 8px; height: 24px; position: relative; margin-top: 10px; overflow: hidden; }
.progress { height: 100%; background-color: #42A5F5; transition: width 0.3s ease; }
.progress-bar span { position: absolute; top: 0; left: 0; width: 100%; text-align: center; line-height: 24px; font-size: 12px; color: #455A64; font-weight: 600; }

.submit-btn { width: 100%; padding: 12px; background-color: #1976D2; color: white; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
.submit-btn:hover:not(:disabled) { background-color: #1565C0; }
.submit-btn:disabled { background-color: #90A4AE; cursor: not-allowed; }

.styled-select { cursor: pointer; background-color: white; flex-grow: 1; }
.add-new-option { font-weight: bold; color: #1976D2; background-color: #E3F2FD; }

/* Speaker Selection Tools */
.select-with-tools { display: flex; gap: 8px; align-items: center; width: 100%; }
.tool-btn { 
    background: #ECEFF1; border: none; border-radius: 6px; 
    width: 40px; height: 40px; display: flex; align-items: center; 
    justify-content: center; cursor: pointer; color: #546E7A;
}
.tool-btn:hover { background: #CFD8DC; color: #37474F; }

/* Manage Panel Styles */
.manage-speakers-panel { 
    background: #FAFAFA; border: 1px solid #ECEFF1; border-radius: 8px; 
    padding: 10px; width: 100%; 
}
.manage-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; font-weight: bold; color: #78909C; text-transform: uppercase; }
.link-btn { background: none; border: none; color: #1976D2; font-weight: 600; cursor: pointer; font-size: 12px; }
.link-btn:hover { text-decoration: underline; }

.speaker-list { list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto; }
.speaker-list li { 
    display: flex; justify-content: space-between; align-items: center; 
    padding: 6px 8px; border-bottom: 1px solid #eee; background: white; 
}
.speaker-list li:last-child { border-bottom: none; }
.speaker-name { font-size: 14px; color: #333; }
.delete-btn { 
    background: #FFEBEE; color: #D32F2F; border: none; border-radius: 4px; 
    width: 24px; height: 24px; display: flex; align-items: center; 
    justify-content: center; cursor: pointer; 
}
.delete-btn:hover { background: #FFCDD2; }
.empty-list { padding: 10px; text-align: center; color: #90A4AE; font-style: italic; font-size: 13px; }

.new-speaker-input-group { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.input-actions { display: flex; gap: 4px; }
.btn-check { background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
.btn-cancel { background: #FF5252; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; }

.current-photo-preview { margin-top: 12px; border: 1px solid #eee; padding: 8px; border-radius: 6px; display: inline-block; }
.preview-label { margin: 0 0 4px 0; font-size: 11px; color: #90A4AE; text-transform: uppercase; letter-spacing: 0.5px; }
.current-photo-preview img { max-width: 150px; height: auto; border-radius: 4px; display: block; }

.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(-10px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(10px); }
</style>