import { defineStore } from 'pinia'
import { db } from '../firebase'
import { collection, addDoc } from "firebase/firestore";
import { useAuthStore } from './auth';

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
        recipientId: recipientId, // The Member's ID (Q-XXXXXX)
        title: title,
        message: message,
        type: type, // 'warning', 'info', 'alert'
        isRead: false,
        createdAt: new Date()
      });
      console.log(`Notification sent to ${recipientId}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  return { sendNotification }
})