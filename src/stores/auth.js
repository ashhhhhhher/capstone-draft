import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth, db } from '../firebase'
import { useNotificationsStore } from './notifications'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
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
  , onSnapshot
} from "firebase/firestore";

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userProfile = ref(null)
  const userRole = ref(null)
  const branchId = ref(null)
  const isLoading = ref(false)
  const isAuthReady = ref(false)
  let profileUnsub = null
  
  // --- 1. PATTERNED ID GENERATION (YYMM##) ---
  // Example: Jan 2026 -> 260101, 260102...
  async function generateMemberID(branchId) {
    // New ID format: fixed year prefix '26' followed by 6 random uppercase alphanumeric characters
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // e.g., "26"
    const month = String(now.getMonth() + 1).padStart(2, '0'); // e.g., "01"
    const prefix = `${year}${month}`; // "2601"

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    function randomSix() {
      let s = ''
      for (let i = 0; i < 6; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return s
    }

    // Try to generate a unique ID (check both members and pendingMembers to avoid collisions)
    let candidate = ''
    let attempts = 0
    while (attempts < 10) {
      candidate = prefix + randomSix()
      const memberDoc = doc(db, 'branches', branchId, 'members', candidate)
      const memberSnap = await getDoc(memberDoc)
      if (!memberSnap.exists()) {
        const pendingDoc = doc(db, 'branches', branchId, 'pendingMembers', candidate)
        const pendingSnap = await getDoc(pendingDoc)
        if (!pendingSnap.exists()) {
          return candidate
        }
      }
      attempts++
    }

    // Fallback: use timestamp slice to ensure uniqueness if random collisions occur
    return prefix + String(Date.now()).slice(-6)
  }

  // --- FETCH PROFILE ---
  async function fetchMemberProfile(uid, currentBranchId) {
    if (!currentBranchId || userRole.value !== 'member') return null;

    const membersRef = collection(db, "branches", currentBranchId, "members");
    const q = query(membersRef, where("authUid", "==", uid));
    const snap = await getDocs(q);

    if (!snap.empty) {
      userProfile.value = snap.docs[0].data();
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
    const displayName = `${basicData.profile.firstName} ${basicData.profile.lastName}`

    await updateProfile(user.value, { displayName })

    const defaultBranch = basicData.branchId || 'baguio'
    const newMemberId = await generateMemberID(defaultBranch)

    // Create pending profile only (not full member)
    await createPendingProfile(user.value.uid, defaultBranch, basicData.profile, newMemberId)

    // --- TEMPORARY BYPASS: Change 'pending' to 'member' ---
    userRole.value = 'member' 
    branchId.value = defaultBranch

  } catch (error) {
    throw error
  } finally {
    isLoading.value = false
  }
}

  // --- Create PENDING profile (awaiting admin approval) ---
  async function createPendingProfile(uid, branchId, basicData, memberId) {
    const age = new Date().getFullYear() - new Date(basicData.birthday).getFullYear(); 
    const ageCategory = (age >= 12 && age <= 21) ? 'Elevate' : (age >= 22 ? 'B1G' : 'N/A');
    const todayISO = new Date().toISOString();

    const pendingData = {
      id: memberId,
      authUid: uid,
      // Prefer the authenticated user's email when available, otherwise fall back
      // to the email collected in the form data.
      email: (auth.currentUser && auth.currentUser.email) || basicData.email || '',
      emailVerified: false, // New signups who are not yet verified
      // --- TEMPORARY BYPASS: Change 'pending' to 'active' ---
      status: 'active', 
      createdAt: todayISO,
      role: 'member',
      branchId: branchId,
      displayName: `${toTitleCase(basicData.firstName.trim())} ${toTitleCase(basicData.lastName.trim())}`,
      lastName: toTitleCase(basicData.lastName.trim()),
      firstName: toTitleCase(basicData.firstName.trim()),
      middleInitial: '',
      birthday: basicData.birthday,
      age: age,
      gender: basicData.gender,
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
        isSeeker: false,
        isFirstTimer: true,
        ageCategory: ageCategory,
        lifeStage: basicData.lifeStage
      }
    }

    // --- TEMPORARY BYPASS: Change "pendingMembers" to "members" ---
    const pendingRef = doc(db, "branches", branchId, "members", memberId); 
    await setDoc(pendingRef, pendingData);
    const notificationsStore = useNotificationsStore()

    await notificationsStore.notifyAdminsOfPending(
      branchId,
      memberId,
      pendingData.displayName
    )
  }

  

async function updateExtendedProfile(data) {
  if (!userProfile.value || !branchId.value) return;

  const notifStore = useNotificationsStore();

  // Merge locally first
  const updatedProfile = { ...userProfile.value, ...data };
  userProfile.value = updatedProfile;

  const memberRef = doc(
    db,
    "branches",
    branchId.value,
    "members",
    updatedProfile.id
  );

  await updateDoc(memberRef, data);

  // 🔔 MATCHING POOL ENTRY CHECK
  const isSeeker = updatedProfile.finalTags?.isSeeker === true;
  const hasLeader = !!updatedProfile.dgroupLeaderId;
  const hasJoinRequest = !!updatedProfile.joinRequest;

  if (isSeeker && !hasLeader && !hasJoinRequest) {
    await notifStore.notifyAdminsMatchingPending(
      branchId.value,
      updatedProfile.id,
      updatedProfile.displayName || "A member"
    );
  }
}

async function login(email, password) {
  isLoading.value = true
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const currentUser = userCredential.user

    // ✅ Check if email is verified
    if (!currentUser.emailVerified) {
      await signOut(auth) // Make sure user cannot stay logged in
      alert("Please verify your email before logging in.")
      return // STOP further execution
    }

    // Only proceed if verified
    user.value = currentUser
    await fetchUserProfile(user.value.uid)
    
    if (userRole.value === 'member') {
      await fetchMemberProfile(user.value.uid, branchId.value)
    }

  } catch (error) {
    // Log raw error so network/API response can be inspected in console
    console.error('Sign-in failed (raw):', error);

    // Normalize errors so UI switch(error.code) in Login.vue always works.
    let code = error && error.code;
    const msg = error && (error.message || String(error));

    // Some Firebase REST responses embed a short error token (e.g., EMAIL_NOT_FOUND,
    // INVALID_PASSWORD, MISSING_PASSWORD) in the message text — check for those.
    const apiMessage = (msg || '').toString();

    // If the raw error already contains a Firebase-style code that we want to
    // normalize for the UI, handle it explicitly.
    if (code === 'auth/invalid-credential' || /INVALID_CREDENTIAL/i.test(apiMessage)) {
      code = 'auth/wrong-password';
    }

    if (!code && apiMessage) {
      if (/INVALID_PASSWORD|wrong[-\s]?password/i.test(apiMessage)) code = 'auth/wrong-password';
      else if (/EMAIL_NOT_FOUND|user not found|no user record/i.test(apiMessage)) code = 'auth/user-not-found';
      else if (/MISSING_PASSWORD/i.test(apiMessage)) code = 'auth/wrong-password';
      else if (/INVALID_EMAIL/i.test(apiMessage)) code = 'auth/invalid-email';
      else if (/TOO_MANY_ATTEMPTS|too many requests/i.test(apiMessage)) code = 'auth/too-many-requests';
      else code = 'auth/unknown';
    }

    // Throw a plain object with code + message so Login.vue's switch works.
    throw { code, body: msg, original: error };
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
          // initial fetch
          await fetchUserProfile(loggedInUser.uid)

          // setup realtime listeners to react to admin approval/rejection
          // clean up previous listener
          if (profileUnsub) profileUnsub()

          // listen to members collection for this user's authUid
          try {
            const membersRef = collection(db, "branches", branchId.value || 'baguio', "members");
            const mq = query(membersRef, where("authUid", "==", loggedInUser.uid));
            const pendingRef = collection(db, "branches", branchId.value || 'baguio', "pendingMembers");
            const pq = query(pendingRef, where("authUid", "==", loggedInUser.uid));

            profileUnsub = onSnapshot(mq, (snap) => {
              if (!snap.empty) {
                userRole.value = 'member';
                branchId.value = branchId.value || 'baguio';
                userProfile.value = snap.docs[0].data();
              }
            })

            // Also listen to pending registration changes
            onSnapshot(pq, (snap) => {
              if (!snap.empty) {
                userRole.value = 'pending';
                branchId.value = branchId.value || 'baguio';
                userProfile.value = snap.docs[0].data();
              }
            })
          } catch (e) {
            console.warn('Failed to setup realtime profile listeners', e)
          }
          
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
  const branch = 'baguio';

  // 1️⃣ CHECK DGMS (ADMINS) FIRST
  const dgmRef = doc(db, "branches", branch, "dgms", uid);
  const dgmSnap = await getDoc(dgmRef);

  if (dgmSnap.exists()) {
    userRole.value = 'admin';
    branchId.value = branch;
    userProfile.value = dgmSnap.data();
    return;
  }

  // 2️⃣ CHECK MEMBERS
  const membersRef = collection(db, "branches", branch, "members");
  const q = query(membersRef, where("authUid", "==", uid));
  const snap = await getDocs(q);

  if (!snap.empty) {
    userRole.value = 'member';
    branchId.value = branch;
    userProfile.value = snap.docs[0].data();
    return;
  }

  // 3️⃣ CHECK PENDING REGISTRATIONS
  const pendingRef = collection(db, "branches", branch, "pendingMembers");
  const pq = query(pendingRef, where("authUid", "==", uid));
  const psnap = await getDocs(pq);

  if (!psnap.empty) {
    userRole.value = 'pending';
    branchId.value = branch;
    userProfile.value = psnap.docs[0].data();
    return;
  }

  // 4️⃣ FALLBACK (INVALID ACCOUNT)
  userRole.value = null;
  branchId.value = null;
  userProfile.value = null;
  console.warn("No profile found for user:", uid);
}

  // --- ADMIN PROFILE & PASSWORD UPDATES ---
  async function updateAdminProfile(currentPassword, newDisplayName, newEmail) {
    if (!auth.currentUser) throw new Error('No authenticated user')

    // Reauthenticate
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, credential)

    // Update Firebase Auth profile (displayName / email)
    if (newDisplayName && newDisplayName !== auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName: newDisplayName })
    }
    if (newEmail && newEmail !== auth.currentUser.email) {
      await updateEmail(auth.currentUser, newEmail)
    }

    // Update Firestore admin doc (dgms)
    const branch = branchId.value || 'baguio'
    const dgmRef = doc(db, "branches", branch, "dgms", auth.currentUser.uid)
    const updates = {}
    if (newDisplayName) updates.displayName = newDisplayName
    if (newEmail) updates.email = newEmail
    if (Object.keys(updates).length) {
      await updateDoc(dgmRef, updates)
      // Refresh local profile
      userProfile.value = { ...userProfile.value, ...updates }
    }
    // Also refresh the local user object
    user.value = auth.currentUser
  }

  async function updateAdminPassword(currentPassword, newPassword) {
    if (!auth.currentUser) throw new Error('No authenticated user')

    // Reauthenticate
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, credential)

    // Update password
    await updatePassword(auth.currentUser, newPassword)
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
    fetchMemberProfile,
    updateAdminProfile,
    updateAdminPassword
  }
})