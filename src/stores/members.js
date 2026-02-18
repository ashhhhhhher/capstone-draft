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
import { useNotificationsStore } from './notifications';

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
  const pendingMembers = ref([])
  const isLoading = ref(true)

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
  
  // Enhanced Leaders computed property (From Updated Version)
  const leaders = computed(() => {
    return activeMembers.value.filter(m => m.finalTags.isDgroupLeader).map(l => ({
      ...l,
      // Ensure arrays exist for matching/analytics
      dgroupDetails: {
        interests: l.dgroupDetails?.interests || [],
        meetingTime: l.dgroupDetails?.meetingTime || 'Anytime'
      }
    }))
  })
  
  const seekers = computed(() => {
    return activeMembers.value.filter(m => m.finalTags.isSeeker)
  })

  // New: Members requesting to join a specific leader
  const joinRequests = computed(() => {
    return activeMembers.value.filter(m => m.joinRequest && m.joinRequest.status === 'pending')
  })

  // --- PATH HELPERS (RESTORED TO PREVIOUS LOGIC) ---
  // This was the cause of the empty list. We switched back to 'branches' 
  // instead of 'artifacts' to match your existing data.

  const getMemberCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
        // Return a dummy collection or handle error if branchId isn't ready
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

  function fetchMembers() {
    this.isLoading = true;
    
    // Ensure we have a valid collection before querying
    const colRef = getMemberCollection();
    // Safety check: if auth isn't ready, retry or wait (handled by auth listener usually)
    
    const membersQuery = query(colRef);

    onSnapshot(membersQuery, (querySnapshot) => {
      const allMembers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Ensure ID is set from doc.id if missing inside the data
        if (!data.id) data.id = doc.id;

        // Default values for stability
        if (!data.status) data.status = 'active';
        if (!data.monitoringState) data.monitoringState = { msgSentDate: null, leaderNotifiedDate: null };
        
        if (data.status === 'pending') {
          console.warn(`Skipping member ${data.id} with status 'pending' found in members collection`);
          return;
        }

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
        if (!data.id) data.id = doc.id;
        list.push(data);
      });
      pendingMembers.value = list;
    }, (error) => {
      // It's okay if this fails permissions on public view, just log it
      console.log('Fetching pending registrations (may require admin):', error.code);
    })
  }
  
  async function registerNewMember(memberData) {
    const authStore = useAuthStore();
    memberData.authUid = null; 
    memberData.status = 'active'; 
    memberData.monitoringState = { msgSentDate: null, leaderNotifiedDate: null }; 

    try {
      // Use provided ID or generate one
      const docId = memberData.id || `mem-${Date.now()}`;
      memberData.id = docId;
      
      const memberRef = doc(getMemberCollection(), docId);
      await setDoc(memberRef, memberData);
      
      if (authStore.sendCreationEmail) {
        await authStore.sendCreationEmail(memberData.email);
      }
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
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      // Ensure the transferred record becomes active immediately on approval.
      data.status = 'active';
      if (!data.monitoringState) data.monitoringState = { msgSentDate: null, leaderNotifiedDate: null };

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

      await deleteDoc(pendingRef);

      // Best-effort cleanup of Auth user if it's the current user
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
    } catch (error) {
      console.error("Error updating member: ", error);
    }
  }

  async function archiveMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, { 
        status: 'archived',
        archivedAt: new Date().toISOString()
      });
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
      } catch (error) {
        console.error(`Failed to delete member ${m.id}:`, error);
      }
    }
  }

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

  async function removeDgroupMember(memberId) {
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      await updateDoc(memberRef, {
        dgroupLeader: '',
        dgroupId: null,
        'finalTags.isSeeker': false,
        'finalTags.isRegular': false
      });
    } catch (error) {
      console.error("Error removing member from Dgroup:", error);
      throw error;
    }
  }

// --- Assign Dgroup Leader (DOES NOT modify dgroupId) ---
async function assignDgroupLeader(memberId, leaderId) {
  try {
    const memberRef = doc(getMemberCollection(), memberId);

    // Remove leader
    if (!leaderId) {
      await updateDoc(memberRef, {
        dgroupLeader: ''
      });
      return;
    }

    // Find leader locally first
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

    // Promotion logic (keep yours intact)
    let member = members.value.find(m => m.id === memberId);
    if (!member) {
      try {
        const memberSnap = await getDoc(doc(getMemberCollection(), memberId));
        if (memberSnap.exists()) member = memberSnap.data();
      } catch (e) {
        console.warn('Could not fetch member:', e);
      }
    }

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

  } catch (error) {
    console.error('Error assigning dgroup leader:', error);
    throw error;
  }
}


  // --- NEW FEATURE: Join Request Logic (Now using correct Paths) ---

  // 1. Request to Join (Seeker Side)
  async function requestJoinDgroup(memberId, dgroupData, preferences) {
    const notifStore = useNotificationsStore();
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      
      // Update member with preferences and the request
      await updateDoc(memberRef, {
        seekerPreferences: preferences, // Save analytics data
        joinRequest: {
          // prefer explicit leader id (dgroupLeaderId) instead of relying on a group code
          dgroupLeaderId: dgroupData.leaderId || dgroupData.dgroupLeaderId || null,
          leaderId: dgroupData.leaderId,
          leaderName: dgroupData.leaderName,
          dgroupName: dgroupData.dgroupName,
          status: 'pending',
          requestedAt: new Date().toISOString()
        },
        'finalTags.isSeeker': true // Mark as seeker in the interim
      });

      // Notify Leader
      if (dgroupData.leaderId) {
        if(notifStore && notifStore.sendNotification) {
          await notifStore.sendNotification(
            dgroupData.leaderId, 
            'New DGroup Join Request', 
            'A member has requested to join your DGroup. Please review.', 
            'info'
          );
        }
      }
    } catch (error) {
      console.error("Error requesting join:", error);
      throw error;
    }
  }

  // 2. Respond to Request (Leader/Admin Side)
  async function respondToJoinRequest(memberId, action, dgroupData = null) {
    // action: 'approve' | 'reject'
    const notifStore = useNotificationsStore();
    
    try {
      const memberRef = doc(getMemberCollection(), memberId);
      
      if (action === 'approve') {
        // Find member to get request details if dgroupData not passed
        const member = members.value.find(m => m.id === memberId);
        if (!member || !member.joinRequest) throw new Error("Request not found");

        const leaderName = dgroupData?.leaderName || member.joinRequest.leaderName;
        // prefer leader id (dgroupLeaderId) as the canonical pointer to the leader
        const dgroupLeaderId = dgroupData?.leaderId || dgroupData?.dgroupLeaderId || member.joinRequest.dgroupLeaderId || member.joinRequest.leaderId;

        await updateDoc(memberRef, {
          dgroupLeader: leaderName,
          dgroupLeaderId: dgroupLeaderId,
          joinRequest: null,
          'finalTags.isSeeker': false,
          'finalTags.isRegular': true,
          'finalTags.isFirstTimer': false
        });


        if (notifStore && notifStore.sendNotification) {
          await notifStore.sendNotification(
            memberId,
            'Join Request Approved',
            `Welcome! You have been accepted into ${leaderName}'s Dgroup.`,
            'success'
          );
        }

      } else if (action === 'reject') {
        await updateDoc(memberRef, {
          joinRequest: null // Just clear the request, remains a seeker
        });

        if (notifStore && notifStore.sendNotification) {
          await notifStore.sendNotification(
            memberId,
            'Join Request Declined',
            `Your request to join the Dgroup was declined. Please try another group or contact an admin.`,
            'warning'
          );
        }
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