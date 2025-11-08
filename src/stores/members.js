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

const mockMembers = [
  {
    id: 'Q-100001',
    firstName: 'John', lastName: 'Doe', age: 24, gender: 'Male',
    dgroupLeader: 'Peter Pan', email: 'john.doe@email.com',
    school: 'University of Cordilleras', birthday: '2001-05-10',
    finalTags: {
      isRegular: true, isVolunteer: true, volunteerMinistry: 'Live Prod',
      isDgroupLeader: false, isSeeker: false, isFirstTimer: false, ageCategory: 'B1G'
    }
  },
  {
    id: 'Q-100003',
    firstName: 'Mark', lastName: 'Bautista', age: 21, gender: 'Male',
    dgroupLeader: '', email: 'mark.b@email.com',
    school: 'University of Baguio', birthday: '2004-08-01',
    finalTags: {
      isRegular: false, isVolunteer: false, volunteerMinistry: '',
      isDgroupLeader: false, isSeeker: true, isFirstTimer: true, ageCategory: 'Elevate'
    }
  },
  {
    id: 'Q-100004',
    firstName: 'Peter', lastName: 'Pan', age: 28, gender: 'Male',
    dgroupLeader: 'Wendy Darling',
    email: 'peter.pan@email.com',
    school: 'Neverland Inc.', birthday: '1997-08-01',
    dgroupCapacity: 8, // Added capacity
    finalTags: {
      isRegular: true, isVolunteer: false, volunteerMinistry: '',
      isDgroupLeader: true,
      isSeeker: false, isFirstTimer: false, ageCategory: 'B1G'
    }
  },
  {
    id: 'Q-100005',
    firstName: 'Wendy', lastName: 'Darling', age: 27, gender: 'Female',
    dgroupLeader: '',
    email: 'wendy.d@email.com',
    school: 'Kensington', birthday: '1998-08-01',
    dgroupCapacity: 10, 
    finalTags: {
      isRegular: true, isVolunteer: false, volunteerMinistry: '',
      isDgroupLeader: true,
      isSeeker: false, isFirstTimer: false, ageCategory: 'B1G'
    }
  }
]

export const useMembersStore = defineStore('members', () => {
  // --- State ---
  const members = ref([])
  const isLoading = ref(true)

  // --- Getters (Computed) ---
  const leaderNames = computed(() => {
    return members.value
      .filter(m => m.finalTags.isDgroupLeader)
      .map(m => `${m.firstName} ${m.lastName}`)
  })
  
  // NEW: Get a list of all leader objects
  const leaders = computed(() => {
    return members.value.filter(m => m.finalTags.isDgroupLeader)
  })
  
  // NEW: Get a list of all seeker objects
  const seekers = computed(() => {
    return members.value.filter(m => m.finalTags.isSeeker)
  })

  // --- Actions ---
  function fetchMembers() {
    this.isLoading = true;
    const membersQuery = query(collection(db, "members"));

    onSnapshot(membersQuery, (querySnapshot) => {
      const allMembers = [];
      querySnapshot.forEach((doc) => {
        allMembers.push(doc.data());
      });
      members.value = allMembers;
      this.isLoading = false;
      console.log("Members store updated from Firebase.");
    }, (error) => {
      console.error("Error fetching members: ", error);
      this.isLoading = false;
    });
  }
  
  async function registerNewMember(memberData) {
    try {
      const memberRef = doc(db, "members", memberData.id);
      await setDoc(memberRef, memberData);
      console.log("Member registered with ID: ", memberData.id);
    } catch (error) {
      console.error("Error registering member: ", error);
    }
  }

  async function updateMember(updatedMember) {
    try {
      const memberRef = doc(db, "members", updatedMember.id);
      await updateDoc(memberRef, updatedMember);
      console.log("Member updated: ", updatedMember.id);
    } catch (error) {
      console.error("Error updating member: ", error);
    }
  }

  async function deleteMember(memberId) {
    try {
      const memberRef = doc(db, "members", memberId);
      await deleteDoc(memberRef);
      console.log("Member deleted: ", memberId);
    } catch (error) {
      console.error("Error deleting member: ", error);
    }
  }

  return { 
    members, 
    isLoading,
    leaderNames,
    leaders, // <-- Expose new getter
    seekers, // <-- Expose new getter
    fetchMembers,
    registerNewMember, 
    updateMember, 
    deleteMember
  }
})