import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db, storage } from '../firebase' // Add storage import
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage"; // Add storage functions
import { useAuthStore } from './auth'; 

export const useEventsStore = defineStore('events', {
  state: () => ({
    currentEvent: null, 
    allEvents: [],
    isLoading: true
  }),
  actions: {
    // Helper to get the correct Firestore collection path
    getEventCollection() {
      const authStore = useAuthStore();
      if (!authStore.branchId) {
          console.error("Branch ID not available. Cannot fetch events.");
          return collection(db, "events_error");
      }
      return collection(db, "branches", authStore.branchId, "events");
    },
    
    async createEvent(eventData) {
      try {
        await addDoc(this.getEventCollection(), eventData);
        console.log("Event created");
      } catch (error) {
        console.error("Error creating event: ", error);
      }
    },
    
    async updateEvent(eventId, eventData) {
      try {
        const eventRef = doc(this.getEventCollection(), eventId);
        await updateDoc(eventRef, eventData);
        console.log("Event updated: ", eventId);
      } catch (error) {
        console.error("Error updating event: ", error);
      }
    },
    
    async deleteEvent(eventId) {
      try {
        const eventRef = doc(this.getEventCollection(), eventId);
        await deleteDoc(eventRef);
        console.log("Event deleted: ", eventId);
      } catch (error) {
        console.error("Error deleting event: ", error);
      }
    },

    async endEvent(eventId) {
      try {
        const authStore = useAuthStore();
        if (!authStore.branchId) {
          const err = new Error('Missing branchId in auth store — cannot update event document.');
          console.error(err);
          throw err;
        }
        if (!eventId) {
          const err = new Error('No eventId provided to endEvent.');
          console.error(err);
          throw err;
        }

        const eventRef = doc(this.getEventCollection(), eventId);
        await updateDoc(eventRef, {
          ended: true,
          endedAt: serverTimestamp(),
          endedBy: authStore.user?.uid || null,
          endedReason: 'manual'
        });
        console.log("Event ended: ", eventId);
        return true;
      } catch (error) {
        console.error("Error ending event (rethrowing): ", error);
        throw error; 
      }
    },

    // --- NEW: CLEANUP LOGIC ---
    async cleanupOldEventImages() {
      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Filter for past events that still have a photoURL
      const pastEventsWithImages = this.allEvents.filter(e => {
        return e.date < todayStr && e.photoURL && e.photoURL.startsWith('https');
      });

      if (pastEventsWithImages.length === 0) return;

      console.log(`Cleaning up images for ${pastEventsWithImages.length} past events...`);

      for (const event of pastEventsWithImages) {
        try {
          // 1. Delete from Storage
          const imageRef = storageRef(storage, event.photoURL);
          await deleteObject(imageRef);
          
          // 2. Update Firestore Doc to remove the URL
          const eventRef = doc(this.getEventCollection(), event.id);
          await updateDoc(eventRef, { photoURL: '' });
          
          console.log(`Deleted image for past event: ${event.name}`);
        } catch (error) {
          console.warn(`Failed to cleanup image for ${event.name}:`, error);
        }
      }
    },

    fetchEvents() {
      this.isLoading = true;
      const eventsQuery = query(
        this.getEventCollection(), 
        orderBy("date", "desc")
      );

      onSnapshot(eventsQuery, (querySnapshot) => {
        const events = [];
        querySnapshot.forEach((doc) => {
          events.push({ id: doc.id, ...doc.data() });
        });
        
        this.allEvents = events; 
        
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        const todayEvent = events.find(e => e.date === todayStr && !e.ended);

        if (todayEvent) {
          this.currentEvent = todayEvent;
        } else {
          this.currentEvent = null;
        }
        
        this.isLoading = false;
        
        // Run cleanup whenever events are fetched/updated
        this.cleanupOldEventImages(); 

      }, (error) => {
        console.error("Error fetching events: ", error);
        this.isLoading = false;
      });
    }
  }
})