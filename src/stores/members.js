
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  getDocs,
  getDoc
} from "firebase/firestore";
import { useAuthStore } from './auth';

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
  const pendingMembers = ref([])
  const isLoading = ref(true)

  const activeMembers = computed(() => {
    return members.value.filter(m => m.status !== 'archived')
  })
  const archivedMembers = computed(() => {
    return members.value.filter(m => m.status === 'archived')
  })

  const leaderNames = computed(() => {
    return activeMembers.value
      .filter(m => m.finalTags.isDgroupLeader)
      .map(m => `${m.firstName} ${m.lastName}`)
  })
  const leaders = computed(() => {
    return activeMembers.value.filter(m => m.finalTags.isDgroupLeader)
  })
  const seekers = computed(() => {
    return activeMembers.value.filter(m => m.finalTags.isSeeker)
  })

  const getMemberCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
        return collection(db, "members_error"); 
    }
    return collection(db, "branches", authStore.branchId, "members");
  };

  const getPendingCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
      return collection(db, "pending_error");
    }
    return collection(db, "branches", authStore.branchId, "pendingMembers");
  };

  function fetchMembers() {
    this.isLoading = true;
    const membersQuery = query(getMemberCollection());

    onSnapshot(membersQuery, (querySnapshot) => {
      const allMembers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.status) data.status = 'active';
        // Ensure monitoringState object exists
        if (!data.monitoringState) data.monitoringState = { msgSentDate: null, leaderNotifiedDate: null };
        allMembers.push(data);
      });
      members.value = allMembers;
      this.isLoading = false;
    }, (error) => {
      console.error("Error fetching members: ", error);
      this.isLoading = false;
    });
  }

  // --- FETCH PENDING REGISTRATIONS ---
  function fetchPendingRegistrations() {
    const pendingQuery = query(getPendingCollection());
    onSnapshot(pendingQuery, (querySnapshot) => {
      const list = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        list.push(data);
      });
      pendingMembers.value = list;
    }, (error) => {
      console.error('Error fetching pending registrations:', error);
    })
  }
  
  async function registerNewMember(memberData) {
    const authStore = useAuthStore();
    memberData.authUid = null; 
    memberData.status = 'active'; 
    memberData.monitoringState = { msgSentDate: null, leaderNotifiedDate: null }; 

    try {
      const memberRef = doc(getMemberCollection(), memberData.id);
      await setDoc(memberRef, memberData);
      await authStore.sendCreationEmail(memberData.email);
    } catch (error) {
      console.error("Error during member registration:", error);
    }
  }

  // --- APPROVE PENDING REGISTRATION ---
  async function approvePending(memberId) {
    try {
      const pendingRef = doc(getPendingCollection(), memberId);
      const snap = await getDoc(pendingRef);
      if (!snap.exists()) throw new Error('Pending registration not found');
      const data = snap.data();

      const memberRef = doc(getMemberCollection(), memberId);
      // Set createdAt to now if not present
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      // Remove pending status
      data.status = data.status || 'active';

      await setDoc(memberRef, data);
      await deleteDoc(pendingRef);
    } catch (error) {
      console.error('Error approving pending member:', error);
      throw error;
    }
  }

  // --- REJECT PENDING REGISTRATION ---
  async function rejectPending(memberId) {
    try {
      const pendingRef = doc(getPendingCollection(), memberId);
      const snap = await getDoc(pendingRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const authUid = data.authUid;

      // Delete pending document
      await deleteDoc(pendingRef);

      // NOTE: Deleting the Auth user from client-side is not possible for other users
      // without admin privileges. We attempt a best-effort: if the user currently
      // signed in is the same uid, sign them out and delete their account.
      const authStore = useAuthStore();
      if (authStore.user && authStore.user.uid === authUid) {
        // If the rejected user is the one currently signed in, remove their auth account
        try {
          // sign out first (delete will require reauth in many cases)
          await authStore.logout();
        } catch (e) {
          console.warn('Failed to sign out rejected user:', e);
        }
      }

      // Return the authUid so calling code can trigger server-side deletion if available
      return authUid;
    } catch (error) {
      console.error('Error rejecting pending member:', error);
      throw error;
    }
  }

  async function updateMember(updatedMember) {
    try {
      const memberRef = doc(getMemberCollection(), updatedMember.id);
      await updateDoc(memberRef, updatedMember);
    } catch (error) {
      console.error("Error updating member: ", error);
    }
  }

  // --- UPDATED: Archive with Timestamp ---
  async function archiveMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { 
        status: 'archived',
        archivedAt: new Date().toISOString() // Save current time
      });
    } catch (error) {
      console.error("Error archiving member: ", error);
    }
  }

  // --- UPDATED: Restore removes Timestamp ---
  async function restoreMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { 
        status: 'active',
        archivedAt: null 
      });
    } catch (error) {
      console.error("Error restoring member: ", error);
    }
  }

  // --- NEW: Auto-Restore on Attendance (for Scan) ---
  async function checkAndAutoRestore(memberId) {
    const member = members.value.find(m => m.id === memberId);
    // If found and currently archived, restore them immediately
    if (member && member.status === 'archived') {
      console.log(`Auto-restoring member ${memberId} due to attendance activity.`);
      await restoreMember(memberId);
      return true; // Indicates restoration happened
    }
    return false;
  }

  // --- NEW: Policy Enforcement (Auto-Delete > 1 Year) ---
  async function purgeOldArchives() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // We filter from the local 'members' state first to minimize reads, 
    // assuming fetchMembers() is already running.
    const toDelete = members.value.filter(m => {
      if (m.status !== 'archived' || !m.archivedAt) return false;
      const archiveDate = new Date(m.archivedAt);
      return archiveDate < oneYearAgo;
    });

    if (toDelete.length === 0) return;

    console.log(`Found ${toDelete.length} members archived for > 1 year. Purging...`);

    // Execute deletions
    for (const m of toDelete) {
      try {
        const memberRef = doc(getMemberCollection(), m.id);
        await deleteDoc(memberRef);
        console.log(`Permanently deleted member: ${m.firstName} ${m.lastName} (ID: ${m.id})`);
      } catch (error) {
        console.error(`Failed to delete member ${m.id}:`, error);
      }
    }
  }

  // --- Log Monitoring Actions ---
  async function logMonitoringAction(memberId, actionType) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      const updateData = {};
      
      if (actionType === 'message') {
        updateData['monitoringState.msgSentDate'] = new Date().toISOString();
      } else if (actionType === 'notifyLeader') {
        updateData['monitoringState.leaderNotifiedDate'] = new Date().toISOString();
      }

      await updateDoc(memberRef, updateData);
    } catch (error) {
      console.error("Error logging action:", error);
    }
  }
  
  return { 
    members, activeMembers, archivedMembers, isLoading,
    pendingMembers,
    leaderNames, leaders, seekers,
    fetchMembers, registerNewMember, updateMember, 
    archiveMember, restoreMember, purgeOldArchives,
    checkAndAutoRestore, // Export the new function
    fetchPendingRegistrations, approvePending, rejectPending,
    logMonitoringAction 
  }
})