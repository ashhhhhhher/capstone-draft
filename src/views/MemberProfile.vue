<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { storage } from '../firebase'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { v4 as uuidv4 } from 'uuid'
import { Camera, Save, Lock, Mail, Phone, Facebook, GraduationCap, X, Check, Upload } from 'lucide-vue-next'

const authStore = useAuthStore()

const isLoading = ref(false)
const passwordLoading = ref(false)
const fileInput = ref(null)
const uploadProgress = ref(0)
const isUploading = ref(false)

// --- Pending Photo State ---
const pendingPhotoBlob = ref(null)
const pendingPhotoPreview = ref('')

// --- Profile Data ---
const profile = reactive({
  firstName: '',
  lastName: '',
  birthday: '',
  gender: '',
  age: '',
  school: '',
  email: '',
  contactNumber: '',
  fbAccount: '',
  profilePicture: '' 
})

// --- Password Data ---
const passwordForm = reactive({
  current: '',
  new: '',
  confirm: ''
})

const lifestage = computed(() => authStore.userProfile?.finalTags?.ageCategory || 'N/A')

// Initialize
onMounted(() => {
  if (authStore.userProfile) {
    const p = authStore.userProfile
    Object.assign(profile, {
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      birthday: p.birthday || '',
      gender: p.gender || '',
      age: p.age || '',
      school: p.school || '',
      email: p.email || authStore.user?.email || '',
      contactNumber: p.contactNumber || '',
      fbAccount: p.fbAccount || '',
      profilePicture: p.profilePicture || ''
    })
  }
})

// --- Image Compression & Upload Logic ---

function triggerUpload() {
  fileInput.value.click()
}

// Compress image using Canvas
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; // Limit dimensions to save space
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to Blob (JPEG, 70% quality)
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.7); 
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

async function handleFileChange(event) {
  const file = event.target.files[0]
  if (file) {
    try {
      // Compress before setting state
      const compressedBlob = await compressImage(file)
      
      // Create local preview
      pendingPhotoBlob.value = compressedBlob
      pendingPhotoPreview.value = URL.createObjectURL(compressedBlob)
      
    } catch (error) {
      console.error("Compression error:", error)
      alert("Could not process image.")
    }
  }
  // Reset input so same file can be selected if retried
  event.target.value = ''
}

function cancelPhotoUpdate() {
  pendingPhotoBlob.value = null
  pendingPhotoPreview.value = ''
}

// Helper to delete old image
async function deleteOldImage(url) {
  if (!url) return
  try {
    // Create a reference from the HTTPS URL
    const fileRef = storageRef(storage, url)
    await deleteObject(fileRef)
    console.log("Old profile picture deleted from storage.")
  } catch (error) {
    // Ignore error if file not found (maybe already deleted)
    console.warn("Could not delete old image:", error)
  }
}

function uploadPendingPhoto() {
  if (!pendingPhotoBlob.value) return

  isUploading.value = true
  const filename = `${uuidv4()}.jpg` // Always jpg due to compression
  const filePath = `profile_images/${authStore.user.uid}/${filename}`
  const fileRef = storageRef(storage, filePath)
  
  const uploadTask = uploadBytesResumable(fileRef, pendingPhotoBlob.value)
  
  uploadTask.on('state_changed', 
    (snapshot) => { 
      uploadProgress.value = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
    },
    (error) => {
      console.error("Upload failed:", error)
      alert("Failed to upload image.")
      isUploading.value = false
    },
    async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
      
      // 1. Delete the old image from storage if it exists
      if (profile.profilePicture) {
        await deleteOldImage(profile.profilePicture)
      }

      // 2. Update local profile state
      profile.profilePicture = downloadURL 
      
      // 3. Save new URL to Firestore
      await saveProfilePictureUrl(downloadURL)
      
      // Cleanup
      isUploading.value = false
      cancelPhotoUpdate() // Clear pending state
      alert("Profile picture updated!")
    }
  )
}

async function saveProfilePictureUrl(url) {
  try {
    await authStore.updateExtendedProfile({ profilePicture: url })
  } catch (e) {
    console.error("Failed to save profile URL to DB", e)
  }
}

async function removePhoto() {
  if (confirm("Are you sure you want to remove your profile picture?")) {
    const oldUrl = profile.profilePicture
    
    // 1. Clear in UI
    profile.profilePicture = ''
    
    // 2. Delete from Storage
    if (oldUrl) {
      await deleteOldImage(oldUrl)
    }

    // 3. Clear in Firestore
    saveProfilePictureUrl('') 
  }
}

async function saveProfile() {
  isLoading.value = true
  
  const updates = {
    school: profile.school,
    contactNumber: profile.contactNumber,
    fbAccount: profile.fbAccount,
    email: profile.email
  }

  try {
    await authStore.updateExtendedProfile(updates)
    alert("Personal details saved successfully!")
  } catch (e) {
    console.error(e)
    alert("Failed to save profile details.")
  } finally {
    isLoading.value = false
  }
}

async function updatePassword() {
  if (!passwordForm.new || !passwordForm.confirm || !passwordForm.current) {
    return alert("Please fill all password fields")
  }
  if (passwordForm.new !== passwordForm.confirm) {
    return alert("New passwords do not match")
  }
  
  passwordLoading.value = true
  // Simulate password update
  setTimeout(() => {
    passwordLoading.value = false
    passwordForm.current = ''
    passwordForm.new = ''
    passwordForm.confirm = ''
    alert("Password updated successfully!")
  }, 1000)
}
</script>

<template>
  <div class="profile-view">
    
    <!-- Header Section (Centered) -->
    <header class="profile-header-card">
      <div class="avatar-section">
        <div class="avatar-container">
          <!-- Show Pending Preview if available, else Actual Profile Pic -->
          <img 
            v-if="pendingPhotoPreview" 
            :src="pendingPhotoPreview" 
            class="avatar-img pending" 
          />
          <img 
            v-else-if="profile.profilePicture" 
            :src="profile.profilePicture" 
            class="avatar-img" 
          />
          <div v-else class="avatar-placeholder">{{ profile.firstName.charAt(0) }}</div>
          
          <div v-if="isUploading" class="upload-overlay">
            <span>{{ Math.round(uploadProgress) }}%</span>
          </div>

          <!-- Hide camera button if pending action exists -->
          <button v-if="!pendingPhotoBlob" class="camera-btn" @click="triggerUpload" title="Change Photo" :disabled="isUploading">
            <Camera :size="18" />
          </button>
        </div>
        
        <!-- Photo Actions -->
        <div class="avatar-actions">
          
          <!-- Pending Save/Cancel State -->
          <div v-if="pendingPhotoBlob" class="pending-actions">
            <button class="btn-confirm" @click="uploadPendingPhoto" :disabled="isUploading">
              <Upload :size="14" /> Confirm Upload
            </button>
            <button class="btn-cancel" @click="cancelPhotoUpdate" :disabled="isUploading">
              <X :size="14" /> Cancel
            </button>
          </div>

          <!-- Existing Photo Actions -->
          <div v-else-if="profile.profilePicture" class="default-actions">
            <button class="remove-text" @click="removePhoto">Remove Photo</button>
          </div>
        </div>
        
        <!-- Hidden Input -->
        <input type="file" ref="fileInput" @change="handleFileChange" accept="image/png, image/jpeg" class="hidden-input" />
      </div>

      <div class="info-section">
        <h2 class="user-name">{{ profile.firstName }} {{ profile.lastName }}</h2>
        <div class="meta-badges">
          <span class="badge">{{ profile.age || '?' }} yrs</span>
          <span class="badge">{{ profile.gender }}</span>
          <span class="badge highlight">{{ lifestage }}</span>
        </div>
      </div>
    </header>

    <!-- Details Form -->
    <div class="form-card">
      <div class="form-row">
        <div class="input-group full">
          <label>School / Workplace</label>
          <div class="input-wrapper">
            <GraduationCap :size="18" class="icon" />
            <input v-model="profile.school" placeholder="Enter school or workplace" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="input-group">
          <label>Email Address</label>
          <div class="input-wrapper">
            <Mail :size="18" class="icon" />
            <input v-model="profile.email" type="email" />
          </div>
        </div>
        
        <div class="input-group">
          <label>Contact Number</label>
          <div class="input-wrapper">
            <Phone :size="18" class="icon" />
            <input v-model="profile.contactNumber" placeholder="0912 345 6789" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="input-group full">
          <label>Facebook Link / Name</label>
          <div class="input-wrapper">
            <Facebook :size="18" class="icon" />
            <input v-model="profile.fbAccount" placeholder="Facebook profile link" />
          </div>
        </div>
      </div>

      <div class="action-footer">
        <button class="save-btn" @click="saveProfile" :disabled="isLoading">
          <Save :size="18" />
          <span>{{ isLoading ? 'Saving...' : 'Save Details' }}</span>
        </button>
      </div>
    </div>

    <!-- Security Section -->
    <div class="form-card security">
      <h3>Change Password</h3>
      <div class="form-row">
        <div class="input-group full">
          <label>Current Password</label>
          <div class="input-wrapper">
            <Lock :size="18" class="icon" />
            <input type="password" v-model="passwordForm.current" placeholder="Required" />
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="input-group">
          <label>New Password</label>
          <input type="password" v-model="passwordForm.new" placeholder="New password" />
        </div>
        <div class="input-group">
          <label>Confirm</label>
          <input type="password" v-model="passwordForm.confirm" placeholder="Retype" />
        </div>
      </div>
      
      <div class="action-footer">
        <button class="save-btn outline" @click="updatePassword" :disabled="passwordLoading">
          <span>{{ passwordLoading ? 'Updating...' : 'Update Password' }}</span>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}

/* HEADER CARD */
.profile-header-card {
  background: white;
  border-radius: 16px;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.avatar-container {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 12px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #E3F2FD;
}
.avatar-img.pending {
  border-color: #FFA726; /* Orange border for pending state */
  opacity: 0.8;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #E3F2FD;
  color: #1565C0;
  font-size: 40px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.upload-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
}

.camera-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #1976D2;
  color: white;
  border: 2px solid white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
.camera-btn:disabled { background: #90A4AE; cursor: not-allowed; }

/* Actions below avatar */
.avatar-actions {
  min-height: 24px;
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.pending-actions {
  display: flex;
  gap: 8px;
}

.btn-confirm {
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn-cancel {
  background: #F5F5F5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.remove-text {
  background: none;
  border: none;
  color: #D32F2F;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.hidden-input { display: none; }

.user-name {
  margin: 0 0 8px 0;
  font-size: 22px;
  color: #333;
}

.meta-badges {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.badge {
  background: #F5F5F5;
  color: #616161;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.badge.highlight {
  background: #E3F2FD;
  color: #1565C0;
}

/* FORM CARDS */
.form-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.form-card.security h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: #D32F2F;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.input-group {
  flex: 1;
}
.input-group.full {
  width: 100%;
}

label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #546E7A;
  margin-bottom: 6px;
}

.input-wrapper {
  position: relative;
}
.icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #90A4AE;
}

input {
  width: 100%;
  padding: 12px 12px 12px 40px; /* space for icon */
  border: 1px solid #CFD8DC;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
input:focus {
  border-color: #1976D2;
  outline: none;
}
/* Inputs without icons (e.g. password) */
.form-card.security input {
  padding-left: 12px;
}
.form-card.security .input-wrapper input {
  padding-left: 40px;
}

.action-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  background: #1976D2;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.save-btn:hover { background: #1565C0; }
.save-btn:disabled { background: #90A4AE; cursor: not-allowed; }

.save-btn.outline {
  background: white;
  border: 1px solid #D32F2F;
  color: #D32F2F;
}
.save-btn.outline:hover {
  background: #FFEBEE;
}

@media (max-width: 600px) {
  .form-row { flex-direction: column; gap: 16px; }
}
</style>