import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query,
  getDocs,
  getDoc
} from "firebase/firestore";
import { useAuthStore } from './auth';
import { useNotificationsStore } from './notifications';

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
  const pendingMembers = ref([])
  const isLoading = ref(false)

  // --- Computed Properties ---
  const activeMembers = computed(() => {
    return members.value.filter(m => m.status === 'active')
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
    return activeMembers.value.filter(m => m.finalTags.isDgroupLeader).map(l => ({
      ...l,
      dgroupDetails: {
        interests: l.dgroupDetails?.interests || [],
        meetingTime: l.dgroupDetails?.meetingTime || 'Flexible'
      }
    }))
  })
  
  const seekers = computed(() => {
    return activeMembers.value.filter(m => m.finalTags.isSeeker)
  })

  const joinRequests = computed(() => {
    return activeMembers.value.filter(m => m.joinRequest && m.joinRequest.status === 'pending')
  })

  // --- PATH HELPERS ---
  const getMemberCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
        return collection(db, "members_loading_wait"); 
    }
    return collection(db, "branches", authStore.branchId, "members");
  };

  const getPendingCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
      return collection(db, "pending_loading_wait");
    }
    return collection(db, "branches", authStore.branchId, "pendingMembers");
  };

  // --- ACTIONS ---

  // 🚀 OPTIMIZATION: Replaced onSnapshot with getDocs + added caching
  async function fetchMembers(force = false) {
    // Cache check: If we already have members and aren't forcing a refresh, skip the fetch!
    if (!force && members.value.length > 0) {
      return; 
    }

    isLoading.value = true;
    try {
      const colRef = getMemberCollection();
      const membersQuery = query(colRef);
      const querySnapshot = await getDocs(membersQuery);
      
      const allMembers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.id) data.id = doc.id;
        if (!data.status) data.status = 'active';
        if (!data.monitoringState) data.monitoringState = { msgSentDate: null, leaderNotifiedDate: null };
        
        if (data.status === 'pending') return; // Skip pending
        
        allMembers.push(data);
      });
      members.value = allMembers;
    } catch (error) {
      console.error("Error fetching members: ", error);
    } finally {
      isLoading.value = false;
    }
  }

  // 🚀 OPTIMIZATION: One-time fetch with caching instead of real-time listener
  async function fetchPendingRegistrations(force = false) {
    if (!force && pendingMembers.value.length > 0) return;

    try {
      const pendingQuery = query(getPendingCollection());
      const querySnapshot = await getDocs(pendingQuery);
      const list = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.id) data.id = doc.id;
        list.push(data);
      });
      pendingMembers.value = list;
    } catch (error) {
      console.log('Fetching pending registrations (may require admin):', error.code);
    }
  }
  
  async function registerNewMember(memberData) {
    const authStore = useAuthStore();
    memberData.authUid = null; 
    memberData.status = 'active'; 
    memberData.monitoringState = { msgSentDate: null, leaderNotifiedDate: null }; 

    try {
      const docId = memberData.id || `mem-${Date.now()}`;
      memberData.id = docId;
      
      const memberRef = doc(getMemberCollection(), docId);
      await setDoc(memberRef, memberData);
      
      // 🚀 OPTIMIZATION: Manually add to local state to avoid refetching
      members.value.push(memberData);

      if (authStore.sendCreationEmail) {
        await authStore.sendCreationEmail(memberData.email);
      }
    } catch (error) {
      console.error("Error during member registration:", error);
    }
  }

  async function approvePending(memberId) {
    try {
      const pendingRef = doc(getPendingCollection(), memberId);
      const snap = await getDoc(pendingRef);
      if (!snap.exists()) throw new Error('Pending registration not found');

      const data = snap.data();
      const memberRef = doc(getMemberCollection(), memberId);

      if (!data.createdAt) data.createdAt = new Date().toISOString();
      data.status = 'active';
      if (!data.monitoringState)
        data.monitoringState = { msgSentDate: null, leaderNotifiedDate: null };

      await setDoc(memberRef, data);
      await deleteDoc(pendingRef);

      // 🚀 OPTIMIZATION: Manually update local state
      pendingMembers.value = pendingMembers.value.filter(p => p.id !== memberId);
      members.value.push(data);

      const notificationsStore = useNotificationsStore();
      await notificationsStore.notifyMemberApproved(data.branchId, memberId, data.displayName);

    } catch (error) {
      console.error('Error approving pending member:', error);
      throw error;
    }
  }

  async function rejectPending(memberId) {
    try {
      const pendingRef = doc(getPendingCollection(), memberId);
      const snap = await getDoc(pendingRef);
      if (!snap.exists()) return;
      
      const data = snap.data();
      const authUid = data.authUid;

      await deleteDoc(pendingRef);

      // 🚀 OPTIMIZATION: Manually remove from local state
      pendingMembers.value = pendingMembers.value.filter(p => p.id !== memberId);

      const authStore = useAuthStore();
      if (authStore.user && authStore.user.uid === authUid) {
        try {
          await authStore.logout();
        } catch (e) {
          console.warn('Failed to sign out rejected user:', e);
        }
      }
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
      
      // 🚀 OPTIMIZATION: Manually update local state array
      const index = members.value.findIndex(m => m.id === updatedMember.id);
      if (index !== -1) {
        members.value[index] = { ...members.value[index], ...updatedMember };
      }
    } catch (error) {
      console.error("Error updating member: ", error);
    }
  }

  async function archiveMember(memberId) {
    try {
      const archivedAt = new Date().toISOString();
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { 
        status: 'archived',
        archivedAt: archivedAt
      });

      // 🚀 OPTIMIZATION: Manually update local state
      const index = members.value.findIndex(m => m.id === memberId);
      if (index !== -1) {
        members.value[index].status = 'archived';
        members.value[index].archivedAt = archivedAt;
      }
    } catch (error) {
      console.error("Error archiving member: ", error);
    }
  }

  async function restoreMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { 
        status: 'active',
        archivedAt: null 
      });

      // 🚀 OPTIMIZATION: Manually update local state
      const index = members.value.findIndex(m => m.id === memberId);
      if (index !== -1) {
        members.value[index].status = 'active';
        members.value[index].archivedAt = null;
      }
    } catch (error) {
      console.error("Error restoring member: ", error);
    }
  }

  async function checkAndAutoRestore(memberId) {
    const member = members.value.find(m => m.id === memberId);
    if (member && member.status === 'archived') {
      console.log(`Auto-restoring member ${memberId} due to attendance activity.`);
      await restoreMember(memberId);
      return true;
    }
    return false;
  }

  async function purgeOldArchives() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const toDelete = members.value.filter(m => {
      if (m.status !== 'archived' || !m.archivedAt) return false;
      const archiveDate = new Date(m.archivedAt);
      return archiveDate < oneYearAgo;
    });

    if (toDelete.length === 0) return;

    for (const m of toDelete) {
      try {
        const memberRef = doc(getMemberCollection(), m.id);
        await deleteDoc(memberRef);
        // 🚀 OPTIMIZATION: Remove from local array
        members.value = members.value.filter(localM => localM.id !== m.id);
      } catch (error) {
        console.error(`Failed to delete member ${m.id}:`, error);
      }
    }
  }

  async function logMonitoringAction(memberId, actionType) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      const updateData = {};
      const now = new Date().toISOString();
      
      if (actionType === 'message') {
        updateData['monitoringState.msgSentDate'] = now;
      } else if (actionType === 'notifyLeader') {
        updateData['monitoringState.leaderNotifiedDate'] = now;
      }

      await updateDoc(memberRef, updateData);

      // 🚀 OPTIMIZATION: Manually update local state
      const index = members.value.findIndex(m => m.id === memberId);
      if (index !== -1) {
        if (!members.value[index].monitoringState) members.value[index].monitoringState = {};
        if (actionType === 'message') members.value[index].monitoringState.msgSentDate = now;
        if (actionType === 'notifyLeader') members.value[index].monitoringState.leaderNotifiedDate = now;
      }
    } catch (error) {
      console.error("Error logging action:", error);
    }
  }

  async function removeDgroupMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, {
        dgroupLeader: '',
        dgroupId: null,
        'finalTags.isSeeker': false,
        'finalTags.isRegular': false
      });

      // 🚀 OPTIMIZATION: Local update
      const index = members.value.findIndex(m => m.id === memberId);
      if (index !== -1) {
        members.value[index].dgroupLeader = '';
        members.value[index].dgroupId = null;
        if(members.value[index].finalTags) {
          members.value[index].finalTags.isSeeker = false;
          members.value[index].finalTags.isRegular = false;
        }
      }
    } catch (error) {
      console.error("Error removing member from Dgroup:", error);
      throw error;
    }
  }

  async function assignDgroupLeader(memberId, leaderId) {
    const notifStore = useNotificationsStore();
    const authStore = useAuthStore();
    try {
      const memberRef = doc(getMemberCollection(), memberId);

      if (!leaderId) {
        await updateDoc(memberRef, { dgroupLeader: '' });
        const idx = members.value.findIndex(m => m.id === memberId);
        if(idx !== -1) members.value[idx].dgroupLeader = '';
        return;
      }

      let leader = members.value.find(m => m.id === leaderId);
      if (!leader) {
        const leaderRef = doc(getMemberCollection(), leaderId);
        const snap = await getDoc(leaderRef);
        if (snap.exists()) leader = snap.data();
      }

      if (!leader) throw new Error('Leader not found');

      const leaderName =
        `${leader.firstName || ''} ${leader.lastName || ''}`.trim() ||
        leader.displayName ||
        leader.name ||
        leaderId;

      const updatePayload = {
        dgroupLeader: leaderName,
        dgroupLeaderId: leaderId
      };

      let member = members.value.find(m => m.id === memberId);
      
      const promoteToRegular = !!(
        member &&
        (member.finalTags?.isSeeker || member.finalTags?.isFirstTimer)
      );

      if (member && member.joinRequest?.leaderId === leaderId) {
        updatePayload.joinRequest = null;
        updatePayload['finalTags.isSeeker'] = false;
        updatePayload['finalTags.isRegular'] = true;
      } else if (promoteToRegular) {
        updatePayload['finalTags.isSeeker'] = false;
        updatePayload['finalTags.isFirstTimer'] = false;
        updatePayload['finalTags.isRegular'] = true;
      }

      await updateDoc(memberRef, updatePayload);

      // 🚀 OPTIMIZATION: Update local state immediately
      const mIdx = members.value.findIndex(m => m.id === memberId);
      if(mIdx !== -1) {
        members.value[mIdx] = { 
           ...members.value[mIdx], 
           dgroupLeader: leaderName, 
           dgroupLeaderId: leaderId,
           joinRequest: updatePayload.joinRequest !== undefined ? updatePayload.joinRequest : members.value[mIdx].joinRequest
        };
        if (members.value[mIdx].finalTags) {
          if (updatePayload['finalTags.isSeeker'] !== undefined) members.value[mIdx].finalTags.isSeeker = updatePayload['finalTags.isSeeker'];
          if (updatePayload['finalTags.isRegular'] !== undefined) members.value[mIdx].finalTags.isRegular = updatePayload['finalTags.isRegular'];
          if (updatePayload['finalTags.isFirstTimer'] !== undefined) members.value[mIdx].finalTags.isFirstTimer = updatePayload['finalTags.isFirstTimer'];
        }
      }

      await notifStore.notifyMemberAssigned(authStore.branchId, memberId, leader.dgroupName || "your DGroup");
      await notifStore.notifyLeaderMemberAssigned(authStore.branchId, leaderId, member.displayName, leader.dgroupName || "your DGroup");

    } catch (error) {
      console.error('Error assigning dgroup leader:', error);
      throw error;
    }
  }

  async function requestJoinDgroup(memberId, dgroupData, preferences) {
    const notifStore = useNotificationsStore();
    const authStore = useAuthStore();

    try {
      const memberRef = doc(getMemberCollection(), memberId);
      
      const joinRequestData = {
          dgroupLeaderId: dgroupData.leaderId || dgroupData.dgroupLeaderId || null,
          leaderId: dgroupData.leaderId,
          leaderName: dgroupData.leaderName,
          dgroupName: dgroupData.dgroupName,
          status: 'pending',
          requestedAt: new Date().toISOString()
        };

      await updateDoc(memberRef, {
        seekerPreferences: preferences,
        joinRequest: joinRequestData,
        'finalTags.isSeeker': true
      });

      // 🚀 OPTIMIZATION: Local update
      const idx = members.value.findIndex(m => m.id === memberId);
      if (idx !== -1) {
        members.value[idx].seekerPreferences = preferences;
        members.value[idx].joinRequest = joinRequestData;
        if(members.value[idx].finalTags) members.value[idx].finalTags.isSeeker = true;
      }

      const requester = members.value.find(m => m.id === memberId);
      const requesterName = requester?.displayName || "A member";

      await notifStore.notifyAdminsMatchingPending(authStore.branchId, memberId, requesterName);

      if (dgroupData.leaderId) {
        await notifStore.notifyLeaderOfJoinRequest(authStore.branchId, dgroupData.leaderId, requesterName, dgroupData.dgroupName);
      }
    } catch (error) {
      console.error("Error requesting join:", error);
      throw error;
    }
  }

  async function respondToJoinRequest(memberId, action, dgroupData = null) {
    const notifStore = useNotificationsStore();
    const authStore = useAuthStore();

    try {
      const memberRef = doc(getMemberCollection(), memberId);
      const member = members.value.find(m => m.id === memberId);
      
      if (action === 'approve') {
        if (!member || !member.joinRequest) throw new Error("Request not found");

        const leaderName = dgroupData?.leaderName || member.joinRequest.leaderName;
        const dgroupLeaderId = dgroupData?.leaderId || dgroupData?.dgroupLeaderId || member.joinRequest.dgroupLeaderId || member.joinRequest.leaderId;

        await updateDoc(memberRef, {
          dgroupLeader: leaderName,
          dgroupLeaderId: dgroupLeaderId,
          joinRequest: null,
          'finalTags.isSeeker': false,
          'finalTags.isRegular': true,
          'finalTags.isFirstTimer': false
        });

        // 🚀 OPTIMIZATION: Local update
        const idx = members.value.findIndex(m => m.id === memberId);
        if (idx !== -1) {
           members.value[idx].dgroupLeader = leaderName;
           members.value[idx].dgroupLeaderId = dgroupLeaderId;
           members.value[idx].joinRequest = null;
           if (members.value[idx].finalTags) {
             members.value[idx].finalTags.isSeeker = false;
             members.value[idx].finalTags.isRegular = true;
             members.value[idx].finalTags.isFirstTimer = false;
           }
        }

        await notifStore.notifyMemberJoinApproved(authStore.branchId, memberId, leaderName);

        if (authStore.userRole === 'admin') {
          const memberName = member.displayName || "A member";
          await notifStore.notifyLeaderMemberAssigned(authStore.branchId, dgroupLeaderId, memberName, leaderName);
        }

      } else if (action === 'reject') {
        await updateDoc(memberRef, { joinRequest: null });
        
        // 🚀 OPTIMIZATION: Local update
        const idx = members.value.findIndex(m => m.id === memberId);
        if (idx !== -1) members.value[idx].joinRequest = null;

        await notifStore.notifyMemberJoinRejected(authStore.branchId, memberId);
      }

    } catch (error) {
      console.error("Error responding to request:", error);
      throw error;
    }
  }
  
  return { 
    members, activeMembers, archivedMembers, isLoading,
    pendingMembers,
    leaderNames, leaders, seekers, joinRequests,
    fetchMembers, registerNewMember, updateMember,
    archiveMember, restoreMember, purgeOldArchives,
    checkAndAutoRestore,
    fetchPendingRegistrations, approvePending, rejectPending,
    logMonitoringAction,
    removeDgroupMember,
    requestJoinDgroup, respondToJoinRequest,
    assignDgroupLeader
  }
})