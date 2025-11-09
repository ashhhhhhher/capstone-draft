import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { useAuthStore } from './auth'; // Import Auth Store

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
      // CRITICAL: Use the dynamic branch path
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
        
        const todayEvent = events.find(e => e.date === todayStr);

        if (todayEvent) {
          this.currentEvent = todayEvent;
          console.log("Current Event: Found event for today:", todayEvent.name);
        } else {
          this.currentEvent = null;
          console.log("Current Event: No event scheduled for today.");
        }
        
        this.isLoading = false;
        
        console.log("Events store updated from Firebase.");
      }, (error) => {
        console.error("Error fetching events: ", error);
        this.isLoading = false;
      });
    }
  }
})