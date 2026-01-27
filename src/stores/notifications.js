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

  //Sends an in-app notification to a specific user (Member or Leader)//
  async function sendNotification(recipientId, title, message, type = 'info') {
    const colRef = getNotifCollection();
    if (!colRef) return;

    try {
      await addDoc(colRef, {
        recipientId: recipientId, // The Member's ID (Q-XXXXXX) or 'admin'
        title: title,
        message: message,
        type: type, // 'warning', 'info', 'alert'
        isRead: false,
        createdAt: new Date().toISOString()
      });
      console.log(`Notification sent to ${recipientId}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  // --- CLEANUP LOGIC (Delete > 7 days old) ---
  async function cleanupOldNotifications() {
    const colRef = getNotifCollection();
    if (!colRef) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoThreshold = sevenDaysAgo.toISOString();

    try {
      // Query notifications where createdAt < threshold
      const q = query(colRef, where("createdAt", "<", isoThreshold));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      if (snapshot.size > 0) {
        console.log(`Cleaned up ${snapshot.size} old notifications.`);
      }
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
    }
  }

  // ---- Local in-app notification list (for UI) ----
  const localNotifications = ref([]) // { id, header, body, count, focus }
  const unreadCount = computed(() => localNotifications.value.length)

  // --- ADMIN: Real-time listener for Seekers ---
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
        const existingIndex = localNotifications.value.findIndex(n => n.id === 'seeker-alert');
        const notifData = {
          id: 'seeker-alert',
          header: 'DGroup Matching Needed',
          body: `${count} seeker(s) are waiting to be matched to a DGroup.`,
          count: count,
          focus: 'matching', 
          type: 'alert'
        };

        if (existingIndex > -1) {
          localNotifications.value[existingIndex] = notifData;
        } else {
          localNotifications.value.push(notifData);
        }
      } else {
        localNotifications.value = localNotifications.value.filter(n => n.id !== 'seeker-alert');
      }
    });
  }

  // --- MEMBER: Listeners for Dgroup Assignment & Absence ---
  let memberUnsub = null;

  async function initMemberListeners(userId) {
    const authStore = useAuthStore();
    if (!authStore.branchId) return;

    // A. DGroup Assignment Listener
    const memberDocRef = doc(db, "branches", authStore.branchId, "members", userId);
    
    // Store previous leader to detect changes
    // We assume initial load shouldn't trigger "New Assignment" notification unless we want to persist it.
    // For this session-based approach, we track changes.
    let previousLeader = authStore.userProfile?.dgroupLeader || null; 
    let isFirstRun = true;

    if (memberUnsub) memberUnsub();

    memberUnsub = onSnapshot(memberDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentLeader = data.dgroupLeader;

        if (!isFirstRun && currentLeader && currentLeader !== previousLeader) {
           const notifData = {
              id: `assign-${Date.now()}`,
              header: 'New DGroup Assignment',
              body: `You have been added to ${currentLeader}'s Dgroup!`,
              focus: 'memberDgroup',
              type: 'success'
           };
           // Add to top
           localNotifications.value.unshift(notifData);
        }
        
        previousLeader = currentLeader;
        isFirstRun = false;
      }
    });

    // B. Absence Check (One-time check on load)
    await checkMemberAbsence(userId, authStore.branchId);
  }

  async function checkMemberAbsence(userId, branchId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const eventsRef = collection(db, "branches", branchId, "events");
      
      // Get last 3 service events
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

      // Check attendance for these 3 events
      for (const eventId of last3Events) {
        const attRef = doc(db, "branches", branchId, "events", eventId, "attendance", userId);
        const attSnap = await getDoc(attRef);
        if (!attSnap.exists()) {
          missedCount++;
        }
      }

      if (missedCount >= 3) {
        const notifData = {
          id: 'absence-check',
          header: 'We Miss You!',
          body: `It looks like you haven't attended the last few WKND services. We hope to see you soon!`,
          focus: 'memberAttendance', // Or a relevant route
          type: 'info'
        };
        // Avoid dupes
        if (!localNotifications.value.find(n => n.id === 'absence-check')) {
           localNotifications.value.push(notifData);
        }
      }

    } catch (error) {
      console.error("Error checking absence:", error);
    }
  }

  function setLocalNotifications(items = []) {
    localNotifications.value = items.slice()
  }

  function clearLocalNotifications() {
    localNotifications.value = []
  }

  return { 
    sendNotification, 
    localNotifications, 
    setLocalNotifications, 
    clearLocalNotifications, 
    unreadCount,
    cleanupOldNotifications,
    initSeekerListener,
    initMemberListeners
  }
})