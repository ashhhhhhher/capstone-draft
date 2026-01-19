<script setup>
import { ref, watch } from 'vue'
import { useEventsStore } from '../../stores/events'
import { storage } from '../../firebase'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { v4 as uuidv4 } from 'uuid'

const props = defineProps({
  eventToEdit: Object
})
const emit = defineEmits(['close'])
const eventsStore = useEventsStore()

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
const photoURL = ref('')
const imageFile = ref(null)

// --- Upload State ---
const isUploading = ref(false)
const uploadProgress = ref(0)

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
    isEditMode.value = false
    eventId.value = null; eventName.value = ''; eventDate.value = '';
    eventTime.value = ''; eventDescription.value = '';
    eventType.value = 'service'; eventLocation.value = ''; 
    eventSpeaker.value = ''; eventSeries.value = ''; 
    photoURL.value = ''; imageFile.value = null;
  }
}, { immediate: true })

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) {
    imageFile.value = file
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

// Helper to delete image
async function deleteOldImage(url) {
  if (!url) return
  try {
    const fileRef = storageRef(storage, url)
    await deleteObject(fileRef)
    console.log("Old event image deleted.")
  } catch (error) {
    console.warn("Could not delete old event image:", error)
  }
}

async function handleSubmit() {
  if (!eventName.value || !eventDate.value || !eventTime.value) {
    alert('Please fill in the event name, date, and time.')
    return
  }
  
  isUploading.value = true
  let newPhotoURL = photoURL.value 

  try {
    if (imageFile.value) {
      // If editing and we are replacing an image, delete the old one first
      if (isEditMode.value && props.eventToEdit.photoURL) {
        await deleteOldImage(props.eventToEdit.photoURL)
      }
      // Upload new
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

    if (isEditMode.value) {
      await eventsStore.updateEvent(eventId.value, eventData)
    } else {
      await eventsStore.createEvent(eventData)
    }
    
    isUploading.value = false
    emit('close')

  } catch (error) {
    isUploading.value = false
    alert("An error occurred: " + error.message)
  }
}
</script>

<template>
  <div class="form-container">
    
    <div class="form-header">
      <h2>{{ isEditMode ? 'Edit Event' : 'Create New Event' }}</h2>
    </div>
    
    <form class="form-body" @submit.prevent="handleSubmit">
      
      <div class="form-group">
        <label>Event Type</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" v-model="eventType" value="service">
            <span>Wknd Service</span>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="eventType" value="ccf_event">
            <span>CCF Event</span>
          </label>
        </div>
        <small v-if="eventType === 'service'">Attendance will be recorded for this event.</small>
        <small v-else>This is an informational event (no attendance).</small>
      </div>
      
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
        <label for="eventLocation">Location</label>
        <input type="text" id="eventLocation" v-model="eventLocation" placeholder="e.g., Baguio Convention Center" />
      </div>

      <!-- Speaker and Series Fields -->
      <div class="form-grid">
        <div class="form-group">
          <label for="eventSpeaker">Speaker</label>
          <input type="text" id="eventSpeaker" v-model="eventSpeaker" placeholder="e.g., Ptr. Danny" />
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
        <input type="file" id="eventPhoto" @change="onFileChange" accept="image/png, image/jpeg">
        <small v-if="isEditMode && photoURL && !imageFile">A photo is already set. Upload a new one to replace it.</small>
        <div v-if="photoURL" class="current-photo-preview">
          <img :src="photoURL" alt="Current Event Background" style="max-width: 100px; height: auto; border-radius: 4px;">
        </div>
      </div>
      
      <div v-if="isUploading" class="progress-bar">
        <div class="progress" :style="{ width: uploadProgress + '%' }"></div>
        <span>Uploading... {{ Math.round(uploadProgress) }}%</span>
      </div>

      <div class="form-footer-spacer"></div>
    </form>
    
    <div class="form-footer">
      <button 
        type="submit" 
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
.form-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.form-header {
  flex-shrink: 0;
  margin-bottom: 24px;
}

.form-header h2 {
  margin: 0;
  text-align: center;
  color: #333;
}

.form-body {
  overflow-y: auto;
  flex-grow: 1;
  padding: 0 16px;
  margin: 0 -16px;
}

.form-footer {
  flex-shrink: 0;
  padding-top: 20px;
  border-top: 1px solid #ECEFF1;
  margin-top: 20px;
}

.form-footer-spacer {
  height: 1px; 
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
.form-group textarea,
.form-group input[type="file"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box; 
  font-size: 16px;
}

.form-group input[type="file"] {
  padding: 8px;
}

.form-group small {
  font-size: 12px;
  color: #546E7A;
  margin-top: 4px;
}

.current-photo-preview {
  margin-top: 10px;
}

.radio-group {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.radio-label input {
  width: auto;
}

.progress-bar {
  width: 100%;
  background-color: #ECEFF1;
  border-radius: 8px;
  overflow: hidden;
  height: 24px;
  position: relative;
  margin-top: 10px;
}

.progress-bar span {
  position: absolute;
  width: 100%;
  text-align: center;
  line-height: 24px;
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.progress {
  height: 100%;
  background-color: #42A5F5;
  transition: width 0.3s ease;
}

.submit-btn {
  width: 100%;
  padding: 14px;
  margin-top: 20px;
  background-color: #1976D2;
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.submit-btn:disabled {
  background-color: #90A4AE;
  cursor: not-allowed;
}
</style>