
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
  getDocs
} from "firebase/firestore";
import { useAuthStore } from './auth';

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
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
    leaderNames, leaders, seekers,
    fetchMembers, registerNewMember, updateMember, 
    archiveMember, restoreMember, purgeOldArchives,
    checkAndAutoRestore, // Export the new function
    logMonitoringAction 
  }
})