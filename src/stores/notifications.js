import { defineStore } from 'pinia'
import { db } from '../firebase'
import { collection, addDoc, query, where, getDocs, deleteDoc, onSnapshot, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { useAuthStore } from './auth';
import { ref, computed } from 'vue';

export const useNotificationsStore = defineStore('notifications', () => {
  
  // Helper to get collection based on branch
  const getNotifCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) return null;
    return collection(db, "branches", authStore.branchId, "notifications");
  };

  // Sends an in-app notification
  async function sendNotification(recipientId, title, message, type = 'info', focus = null) {
    const colRef = getNotifCollection();
    if (!colRef) return;

    try {
      await addDoc(colRef, {
        recipientId: recipientId, 
        title: title,
        message: message,
        type: type, 
        focus: focus, 
        isRead: false,
        createdAt: new Date().toISOString()
      });
      console.log(`Notification sent to ${recipientId}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  async function cleanupOldNotifications() {
    const colRef = getNotifCollection();
    if (!colRef) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoThreshold = sevenDaysAgo.toISOString();

    try {
      const q = query(colRef, where("createdAt", "<", isoThreshold));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
    }
  }

  // ---- Local in-app notification list ----
  const localNotifications = ref([]) 
  const unreadCount = computed(() => localNotifications.value.length)

  // Helper to inject system/state notifications (e.g. from AppHeader)
  function addSystemNotification(notifObj) {
    const existingIndex = localNotifications.value.findIndex(n => n.id === notifObj.id);
    if (existingIndex > -1) {
      // Update existing
      localNotifications.value[existingIndex] = { ...notifObj, isFirestore: false };
    } else {
      // Add new to top
      localNotifications.value.unshift({ ...notifObj, isFirestore: false });
    }
  }

  function removeSystemNotification(id) {
    localNotifications.value = localNotifications.value.filter(n => n.id !== id);
  }

  // --- GENERAL LISTENER (Firestore) ---
  let userNotifsUnsub = null;

  // Updated to accept memberId to ensure we catch notifications sent to "mem-123"
  function initUserNotifications(authUid, memberId = null) {
    const colRef = getNotifCollection();
    if (!colRef) return;

    // Build list of IDs to listen for
    const idsToCheck = [authUid];
    if (memberId && memberId !== authUid) idsToCheck.push(memberId);

    const q = query(
      colRef, 
      where("recipientId", "in", idsToCheck)
    );

    if (userNotifsUnsub) userNotifsUnsub();

    userNotifsUnsub = onSnapshot(q, (snapshot) => {
      const dbNotifs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          header: data.title,       
          body: data.message,       
          type: data.type || 'info',
          focus: data.focus || null,
          isFirestore: true,        
          createdAt: data.createdAt
        };
      });

      // Sort by newest first
      dbNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Merge: Keep System Notifs + New Firestore Notifs
      const systemNotifs = localNotifications.value.filter(n => !n.isFirestore);
      localNotifications.value = [...systemNotifs, ...dbNotifs];
    });
  }

  // --- ADMIN LISTENER (Seekers) ---
  let seekersUnsub = null;
  function initSeekerListener() {
    const authStore = useAuthStore();
    if (!authStore.branchId || authStore.userRole !== 'admin') return; 

    const membersRef = collection(db, "branches", authStore.branchId, "members");
    const q = query(membersRef, where("finalTags.isSeeker", "==", true));

    if (seekersUnsub) seekersUnsub();

    seekersUnsub = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      if (count > 0) {
        addSystemNotification({
          id: 'seeker-alert',
          header: 'DGroup Matching Needed',
          body: `${count} seeker(s) are waiting to be matched to a DGroup.`,
          focus: 'matching', 
          type: 'alert'
        });
      } else {
        removeSystemNotification('seeker-alert');
      }
    });
  }

  // --- MEMBER LISTENER (Absence Only) ---
  // Note: "New Assignment" is now handled by Firestore notifications (initUserNotifications)
  // We keep Absence Check as it's a computed logic, not a stored message.
  
  async function initMemberListeners(userId) {
    const authStore = useAuthStore();
    if (!authStore.branchId) return;
    await checkMemberAbsence(userId, authStore.branchId);
  }

  async function checkMemberAbsence(userId, branchId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const eventsRef = collection(db, "branches", branchId, "events");
      
      const qEvents = query(
        eventsRef, 
        where("eventType", "==", "service"),
        where("date", "<=", today),
        orderBy("date", "desc"),
        limit(3)
      );
      
      const eventSnaps = await getDocs(qEvents);
      if (eventSnaps.empty) return;

      const last3Events = eventSnaps.docs.map(d => d.id);
      let missedCount = 0;

      for (const eventId of last3Events) {
        const attRef = doc(db, "branches", branchId, "events", eventId, "attendance", userId);
        const attSnap = await getDoc(attRef);
        if (!attSnap.exists()) {
          missedCount++;
        }
      }

      if (missedCount >= 3) {
        addSystemNotification({
          id: 'absence-check',
          header: 'We Miss You!',
          body: `It looks like you haven't attended the last few WKND services. We hope to see you soon!`,
          focus: 'memberAttendance',
          type: 'info'
        });
      }
    } catch (error) {
      console.error("Error checking absence:", error);
    }
  }

  async function clearLocalNotifications() {
    const colRef = getNotifCollection();
    const dbNotifs = localNotifications.value.filter(n => n.isFirestore);
    if (colRef && dbNotifs.length > 0) {
      for (const n of dbNotifs) {
        try { await deleteDoc(doc(colRef, n.id)); } catch(e) {}
      }
    }
    localNotifications.value = []
  }

  return { 
    sendNotification, 
    localNotifications, 
    addSystemNotification,
    removeSystemNotification,
    clearLocalNotifications, 
    unreadCount,
    cleanupOldNotifications,
    initSeekerListener,
    initMemberListeners,
    initUserNotifications
  }
})