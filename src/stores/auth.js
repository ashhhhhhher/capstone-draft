import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth, db } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userProfile = ref(null)
  const userRole = ref(null)
  const branchId = ref(null)
  const isLoading = ref(false)
  const isAuthReady = ref(false)

  // (Helper function fetchMemberProfile is unchanged)
  async function fetchMemberProfile(uid, branchId) {
      if (!branchId) return null;
      const membersRef = collection(db, "branches", branchId, "members");
      const q = query(membersRef, where("authUid", "==", uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
          userProfile.value = querySnapshot.docs[0].data();
          await updateProfile(user.value, { 
            displayName: `${userProfile.value.firstName} ${userProfile.value.lastName}` 
          });
      } else {
          userProfile.value = null;
      }
  }

  // --- THIS IS THE FIX for the login button ---
  async function login(email, password) {
    isLoading.value = true
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user
      await fetchUserProfile(user.value.uid)
      if (userRole.value === 'member') {
          await fetchMemberProfile(user.value.uid, branchId.value);
      }
    } catch (error) {
      // Re-throw the error so the Login.vue page can catch it
      throw error;
    } finally {
      // This *always* runs, even if an error is thrown
      isLoading.value = false
    }
  }

  async function logout() {
    await signOut(auth)
    user.value = null
    userRole.value = null
    branchId.value = null
    userProfile.value = null
  }
  
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (loggedInUser) => {
        if (loggedInUser) {
          user.value = loggedInUser
          await fetchUserProfile(loggedInUser.uid)
          if (userRole.value === 'member') {
              await fetchMemberProfile(loggedInUser.uid, branchId.value);
          }
        } else {
          user.value = null
          userRole.value = null
          branchId.value = null
          userProfile.value = null
        }
        isAuthReady.value = true
        resolve()
      });
    })
  }
  
  async function fetchUserProfile(uid) {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      userRole.value = userDoc.data().role;
      branchId.value = userDoc.data().branchId;
    } else {
      userRole.value = 'member';
      branchId.value = 'baguio';
      console.warn("User profile not found in Firestore. Defaulting to 'member/baguio'.");
    }
  }

  // --- THIS IS THE FIX for the signup button ---
  async function signup(email, password, userData) {
    isLoading.value = true
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user
      
      await updateProfile(user.value, {
          displayName: `${userData.profile.firstName} ${userData.profile.lastName}`
      })
      
      // 2. Create the User document (Role & Branch)
      const userDocRef = doc(db, "users", user.value.uid);
      await setDoc(userDocRef, {
        email: user.value.email,
        role: 'member',
        branchId: userData.branchId,
        displayName: `${userData.profile.firstName} ${userData.profile.lastName}`,
        createdAt: new Date()
      });
      
      // 3. Create the member profile document
      await createMemberProfile(user.value.uid, userData.branchId, userData.profile);
      await fetchMemberProfile(user.value.uid, branchId.value);
      
      userRole.value = 'member';
      branchId.value = userData.branchId;

    } catch (error) {
      // Re-throw the error for the Signup.vue page
      throw error;
    } finally {
      // This *always* runs, even if an error is thrown
      isLoading.value = false
    }
  }

  async function createMemberProfile(uid, branchId, profileData) {
    const newId = 'Q-' + Math.floor(100000 + Math.random() * 900000).toString();
    const age = new Date().getFullYear() - new Date(profileData.birthday).getFullYear(); 
    const ageCategory = (age >= 12 && age <= 21) ? 'Elevate' : (age >= 22 ? 'B1G' : 'N/A');

    const memberData = {
      id: newId,
      authUid: uid, 
      lastName: toTitleCase(profileData.lastName.trim()),
      firstName: toTitleCase(profileData.firstName.trim()),
      middleInitial: '',
      birthday: profileData.birthday,
      age: age,
      gender: profileData.gender,
      school: '', 
      email: auth.currentUser.email, 
      contactNumber: profileData.contactNumber, 
      fbAccount: profileData.fbAccount, 
      dgroupLeader: profileData.dgroupLeader || '',
      dgroupCapacity: null,
      finalTags: {
        isRegular: false, isVolunteer: false, volunteerMinistry: [],
        isDgroupLeader: false, isSeeker: true, isFirstTimer: true,
        ageCategory: ageCategory
      }
    }
    const memberRef = doc(db, "branches", branchId, "members", newId);
    await setDoc(memberRef, memberData);
  }
  
  async function sendCreationEmail(email) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error("Error sending creation email:", error);
        throw new Error("Failed to send account creation email.");
    }
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }
  
  async function reauthenticate(currentPassword) {
    const credential = EmailAuthProvider.credential(user.value.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, credential)
  }
  
  async function updateAdminProfile(currentPassword, newName, newEmail) {
    await reauthenticate(currentPassword);
    
    if (newName !== user.value.displayName) {
      await updateProfile(auth.currentUser, { displayName: newName });
    }
    if (newEmail !== user.value.email) {
      await updateEmail(auth.currentUser, newEmail);
    }
    const userDocRef = doc(db, "users", user.value.uid);
    await updateDoc(userDocRef, { 
      email: newEmail,
      displayName: newName
    });

    user.value = { ...auth.currentUser };
  }
  
  async function updateAdminPassword(currentPassword, newPassword) {
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
  }

  return { 
    user, 
    userProfile,
    userRole,
    branchId,
    isLoading, 
    isAuthReady, 
    login, 
    logout, 
    init,
    signup,
    sendCreationEmail, 
    updateAdminProfile, 
    updateAdminPassword 
  }
})