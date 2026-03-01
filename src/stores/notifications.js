import { defineStore } from 'pinia'
import { db } from '../firebase'
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore"
import { useAuthStore } from './auth'
import { ref, computed } from 'vue'

export const useNotificationsStore = defineStore('notifications', () => {

  // 🔹 Keep OLD naming for UI compatibility
  const localNotifications = ref([])

  const unreadCount = computed(() =>
    localNotifications.value.filter(n => !n.read).length
  )

  let unsubscribe = null

  // 🔹 Resolve correct notification collection based on role
  function getUserNotifCollection() {
  const authStore = useAuthStore()
  const { branchId, userRole, user, userProfile } = authStore

  if (!branchId || !user?.uid) return null

  // Admin: docId = authUid
  if (userRole === 'admin') {
    return collection(
      db,
      "branches",
      branchId,
      "dgms",
      user.uid,
      "notifications"
    )
  }

  // Member: docId = memberId
  if (!userProfile?.id) return null

  return collection(
    db,
    "branches",
    branchId,
    "members",
    userProfile.id,
    "notifications"
  )
}
  // 🔹 Initialize real-time listener
  function initUserNotifications() {
    const colRef = getUserNotifCollection()
    if (!colRef) return

    const q = query(colRef, orderBy("createdAt", "desc"))

    if (unsubscribe) unsubscribe()

    unsubscribe = onSnapshot(q, (snapshot) => {
      localNotifications.value = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        header: docSnap.data().header,
        body: docSnap.data().body,
        type: docSnap.data().type || 'info',
        focus: docSnap.data().reference || null,
        read: docSnap.data().read || false,
        createdAt: docSnap.data().createdAt
      }))
    })
  }

  // 🔹 Send notification to specific user
  async function sendToUser({
    branchId,
    targetUid,
    roleTarget, // "admin" | "member" | "dleader"
    type,
    header,
    body,
    reference = null
  }) {
    if (!branchId || !targetUid || !roleTarget) return

    const basePath =
      roleTarget === "admin"
        ? ["branches", branchId, "dgms", targetUid, "notifications"]
        : ["branches", branchId, "members", targetUid, "notifications"]

    const colRef = collection(db, ...basePath)

    await addDoc(colRef, {
      type,
      header,
      body,
      roleTarget,
      reference: reference || null,
      read: false,
      createdAt: serverTimestamp()
    })
  }

  // 🔹 Mark single notification as read
  async function markAsRead(notifId) {
    const authStore = useAuthStore()
    const { branchId, userRole, user } = authStore
    if (!branchId || !user?.uid) return

    const notifDoc =
      userRole === "admin"
        ? doc(db, "branches", branchId, "dgms", user.uid, "notifications", notifId)
        : doc(db, "branches", branchId, "members", user.uid, "notifications", notifId)

    await updateDoc(notifDoc, { read: true })
  }

  // 🔹 Keep old function name so AppHeader doesn't break
  async function clearLocalNotifications() {
    const unread = localNotifications.value.filter(n => !n.read)
    for (const n of unread) {
      await markAsRead(n.id)
    }
  }

async function notifyAdminsOfPending(branchId, newMemberId, displayName) {
  const dgmsRef = collection(db, "branches", branchId, "dgms");
  const snapshot = await getDocs(dgmsRef);

  for (const adminDoc of snapshot.docs) {
    await addDoc(
      collection(
        db,
        "branches",
        branchId,
        "dgms",
        adminDoc.id,
        "notifications"
      ),
      {
        type: "PENDING_MEMBER_REQUEST",
        header: "New Pending Member",
        body: `${displayName} is awaiting approval.`,
        roleTarget: "admin",
        focus: "matching",
        read: false,
        createdAt: serverTimestamp()
      }
    );
  }
}

async function notifyMemberApproved(branchId, memberId, displayName) {
  await sendToUser({
    branchId,
    targetUid: memberId,   // this now means memberId
    roleTarget: "member",
    type: "MEMBER_APPROVED",
    header: "You're Approved!",
    body: `Welcome ${displayName}! Your membership has been approved.`,
    focus: "memberDgroup"
  });
}

//DGROUP MATCHING NOTIFS FOR DLEADERS AND MEMBERS: REQUEST TO JOIN, APPROVAL, REJECTION
async function notifyLeaderOfJoinRequest(branchId, leaderMemberId, requesterName, dgroupName) {
  await sendToUser({
    branchId,
    targetUid: leaderMemberId,
    roleTarget: "member",
    type: "DGROUP_JOIN_REQUEST",
    header: "New DGroup Join Request",
    body: `${requesterName} has requested to join ${dgroupName}.`,
    focus: "leaderRequests"
  });
}

async function notifyMemberJoinApproved(branchId, memberId, leaderName) {
  await sendToUser({
    branchId,
    targetUid: memberId,
    roleTarget: "member",
    type: "DGROUP_JOIN_APPROVED",
    header: "Join Request Approved",
    body: `Welcome! You have been accepted into ${leaderName}'s DGroup.`,
    focus: "memberDgroup"
  });
}

async function notifyMemberJoinRejected(branchId, memberId) {
  await sendToUser({
    branchId,
    targetUid: memberId,
    roleTarget: "member",
    type: "DGROUP_REQUEST_REJECTED",
    header: "Join Request Declined",
    body: "Your request was declined. Please try another group or contact an admin.",
    focus: "matching"
  });
}

// Additional notification when a member is assigned to a DGroup by an admin not through requests
async function notifyLeaderMemberAssigned(branchId, leaderMemberId, memberName, dgroupName) {
  await sendToUser({
    branchId,
    targetUid: leaderMemberId,
    roleTarget: "member",
    type: "DGROUP_MEMBER_ASSIGNED",
    header: "New Member Assigned",
    body: `${memberName} has been added to your DGroup (${dgroupName}).`,
    focus: "leaderRequests"
  });
}
// also for force approve
async function notifyMemberAssigned(branchId, memberId, dgroupName) {
  await sendToUser({
    branchId,
    targetUid: memberId,
    roleTarget: "member",
    type: "DGROUP_MEMBER_ASSIGNED",
    header: "You’ve Been Assigned to a DGroup",
    body: `You have been added to ${dgroupName}.`,
    focus: "memberDgroup"
  });
}

async function notifyAdminsMatchingPending(branchId, memberId, memberName) {
  const dgmsRef = collection(db, "branches", branchId, "dgms");
  const snapshot = await getDocs(dgmsRef);

  for (const adminDoc of snapshot.docs) {
    await sendToUser({
      branchId,
      targetUid: adminDoc.id, // admin authUid
      roleTarget: "admin",
      type: "DGROUP_MATCHING_PENDING",
      header: "Member Needs DGroup Matching",
      body: `${memberName} is waiting to be matched to a DGroup.`,
      focus: "matching"
    });
  }
}

  return {
    localNotifications,
    unreadCount,
    initUserNotifications,
    sendToUser,
    markAsRead,
    clearLocalNotifications,
    notifyAdminsOfPending,
    notifyMemberApproved,
    notifyLeaderOfJoinRequest,
    notifyMemberJoinApproved,
    notifyMemberJoinRejected,
    notifyLeaderMemberAssigned,
    notifyMemberAssigned,
    notifyAdminsMatchingPending
  }
})