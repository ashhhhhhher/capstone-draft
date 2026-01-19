import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth, db } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from "firebase/firestore";

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userProfile = ref(null)
  const userRole = ref(null)
  const branchId = ref(null)
  const isLoading = ref(false)
  const isAuthReady = ref(false)
  
  // --- 1. PATTERNED ID GENERATION (YYMM##) ---
  // Example: Jan 2026 -> 260101, 260102...
  async function generateMemberID(branchId) {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // e.g., "26"
    const month = String(now.getMonth() + 1).padStart(2, '0'); // e.g., "01"
    const prefix = `${year}${month}`; // "2601"

    const membersRef = collection(db, "branches", branchId, "members");
    
    // Find the latest ID starting with prefix
    const q = query(
      membersRef, 
      where("id", ">=", prefix), 
      where("id", "<=", prefix + "\uf8ff"),
      orderBy("id", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);
    
    let nextOrder = 1;
    if (!snapshot.empty) {
      const lastId = snapshot.docs[0].data().id; // e.g., "260101"
      const suffix = lastId.substring(4); // "01"
      if (!isNaN(suffix)) {
        nextOrder = parseInt(suffix) + 1;
      }
    }

    // Pad order with zeros (01, 02... 99)
    const orderStr = String(nextOrder).padStart(2, '0');
    return `${prefix}${orderStr}`; // "260102"
  }

  // --- FETCH PROFILE ---
  async function fetchMemberProfile(uid, currentBranchId) {
      if (!currentBranchId) return null;
      const membersRef = collection(db, "branches", currentBranchId, "members");
      const q = query(membersRef, where("authUid", "==", uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
          userProfile.value = querySnapshot.docs[0].data();
      } else {
          userProfile.value = null;
      }
  }

  // --- SIGNUP ---
  async function signup(email, password, basicData) {
    isLoading.value = true
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user
      
      const displayName = `${basicData.profile.firstName} ${basicData.profile.lastName}`;

      await updateProfile(user.value, {
          displayName: displayName
      })
      
      const defaultBranch = basicData.branchId || 'baguio'; 

      // Create User Doc
      const userDocRef = doc(db, "users", user.value.uid);
      await setDoc(userDocRef, {
        email: user.value.email,
        role: 'member',
        branchId: defaultBranch,
        displayName: displayName,
        createdAt: new Date().toISOString()
      });
      
      // Generate ID & Create Member Profile
      const newMemberId = await generateMemberID(defaultBranch);
      await createMemberProfile(user.value.uid, defaultBranch, basicData.profile, newMemberId);
      
      await fetchMemberProfile(user.value.uid, defaultBranch);
      userRole.value = 'member';
      branchId.value = defaultBranch;

    } catch (error) {
      throw error;
    } finally {
      isLoading.value = false
    }
  }

  async function createMemberProfile(uid, branchId, basicData, memberId) {
    const age = new Date().getFullYear() - new Date(basicData.birthday).getFullYear(); 
    const ageCategory = (age >= 12 && age <= 21) ? 'Elevate' : (age >= 22 ? 'B1G' : 'N/A');
    const todayISO = new Date().toISOString();

    // Default to First Timer, NOT Seeker yet
    const memberData = {
      id: memberId,         
      authUid: uid, 
      createdAt: todayISO,  
      
      lastName: toTitleCase(basicData.lastName.trim()),
      firstName: toTitleCase(basicData.firstName.trim()),
      middleInitial: '',
      birthday: basicData.birthday,
      age: age,
      gender: basicData.gender,
      email: auth.currentUser.email,
      
      // Empty fields for later
      school: '', 
      contactNumber: '', 
      fbAccount: '', 
      profilePicture: '', 
      
      dgroupLeader: '', 
      dgroupDetails: null, 

      finalTags: {
        isRegular: false, 
        isVolunteer: false, 
        volunteerMinistry: [],
        isDgroupLeader: false, 
        isSeeker: false,    // Starts false, set to true via Dgroup tab questionnaire
        isFirstTimer: true, // Default true
        ageCategory: ageCategory
      }
    }
    
    const memberRef = doc(db, "branches", branchId, "members", memberId);
    await setDoc(memberRef, memberData);
  }

  async function updateExtendedProfile(data) {
    if (!userProfile.value || !branchId.value) return;
    
    userProfile.value = { ...userProfile.value, ...data };
    
    const memberRef = doc(db, "branches", branchId.value, "members", userProfile.value.id);
    await updateDoc(memberRef, data);
  }

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
      throw error;
    } finally {
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
    }
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
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
    updateExtendedProfile,
    fetchMemberProfile
  }
})