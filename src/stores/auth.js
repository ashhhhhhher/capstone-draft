import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile, // 1. Import new functions
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "firebase/auth";

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const user = ref(null)
  const isLoading = ref(false)
  const isAuthReady = ref(false)

  // --- Actions ---
  
  async function login(email, password) {
    isLoading.value = true
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    user.value = userCredential.user
    isLoading.value = false
  }

  async function logout() {
    await signOut(auth)
    user.value = null
  }
  
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (loggedInUser) => {
        user.value = loggedInUser
        isAuthReady.value = true
        resolve()
      });
    })
  }
  
  /**
   * 2. NEW: Re-authenticates the user
   */
  async function reauthenticate(currentPassword) {
    const credential = EmailAuthProvider.credential(
      user.value.email, 
      currentPassword
    )
    await reauthenticateWithCredential(auth.currentUser, credential)
  }
  
  /**
   * 3. NEW: Updates the user's profile (name and email)
   */
  async function updateAdminProfile(currentPassword, newName, newEmail) {
    // First, verify the user's current password
    await reauthenticate(currentPassword);
    
    // If re-auth is successful, proceed with updates
    if (newName !== user.value.displayName) {
      await updateProfile(auth.currentUser, { displayName: newName });
    }
    if (newEmail !== user.value.email) {
      await updateEmail(auth.currentUser, newEmail);
    }
    
    // Manually refresh the user object in our store
    user.value = { ...auth.currentUser };
  }
  
  /**
   * 4. NEW: Updates the user's password
   */
  async function updateAdminPassword(currentPassword, newPassword) {
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
  }

  return { 
    user, 
    isLoading, 
    isAuthReady, 
    login, 
    logout, 
    init,
    updateAdminProfile, // 5. Expose new actions
    updateAdminPassword 
  }
})