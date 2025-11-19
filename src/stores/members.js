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
  query
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
    memberData.monitoringState = { msgSentDate: null, leaderNotifiedDate: null }; // Init state

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

  async function archiveMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { status: 'archived' });
    } catch (error) {
      console.error("Error archiving member: ", error);
    }
  }

  async function restoreMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { status: 'active' });
    } catch (error) {
      console.error("Error restoring member: ", error);
    }
  }

  // ---  Log Monitoring Actions ---
  async function logMonitoringAction(memberId, actionType) {
    // actionType = 'message' or 'notifyLeader'
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
    fetchMembers, registerNewMember, updateMember, archiveMember, restoreMember,
    logMonitoringAction 
  }
})