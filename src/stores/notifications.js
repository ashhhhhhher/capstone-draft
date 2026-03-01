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
    const { branchId, userRole, user } = authStore

    if (!branchId || !user?.uid) return null

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

    // members + dleaders
    return collection(
      db,
      "branches",
      branchId,
      "members",
      user.uid,
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


  return {
    localNotifications,
    unreadCount,
    initUserNotifications,
    sendToUser,
    markAsRead,
    clearLocalNotifications,
    notifyAdminsOfPending
  }
})