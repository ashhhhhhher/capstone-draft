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
  // --- State ---
  const members = ref([])
  const isLoading = ref(true)

  // --- Getters (Unchanged) ---
  const leaderNames = computed(() => {
    return members.value
      .filter(m => m.finalTags.isDgroupLeader)
      .map(m => `${m.firstName} ${m.lastName}`)
  })
  const leaders = computed(() => {
    return members.value.filter(m => m.finalTags.isDgroupLeader)
  })
  const seekers = computed(() => {
    return members.value.filter(m => m.finalTags.isSeeker)
  })

  // --- Actions ---

  const getMemberCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
        console.error("Branch ID not available. Cannot fetch members.");
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
        allMembers.push(doc.data());
      });
      members.value = allMembers;
      this.isLoading = false;
      console.log(`Members store updated for branch ${useAuthStore().branchId}.`);
    }, (error) => {
      console.error("Error fetching members: ", error);
      this.isLoading = false;
    });
  }
  
  async function registerNewMember(memberData) {
    const authStore = useAuthStore();
    memberData.authUid = null; 

    try {
      const memberRef = doc(getMemberCollection(), memberData.id);
      await setDoc(memberRef, memberData);
      
      authStore.sendCreationEmail(memberData.email);
      console.log(`[SIMULATED BACKEND]: Account creation link sent to ${memberData.email}.`);
      
    } catch (error) {
      console.error("Error during member registration:", error);
      throw new Error(`Registration failed: ${error.message}`);
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

  async function deleteMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await deleteDoc(memberRef);
    } catch (error) {
      console.error("Error deleting member: ", error);
    }
  }
  
  // --- CRITICAL FIX: EXPOSE ALL ACTIONS ---
  return { 
    members, 
    isLoading,
    leaderNames,
    leaders,
    seekers,
    fetchMembers, // <-- FIX: This function is now exposed
    registerNewMember, 
    updateMember, 
    deleteMember
  }
})