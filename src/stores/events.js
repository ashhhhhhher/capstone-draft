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

export const useEventsStore = defineStore('events', {
  state: () => ({
    currentEvent: null, 
    allEvents: [],
    isLoading: true
  }),
  actions: {
    async createEvent(eventData) {
      try {
        await addDoc(collection(db, "events"), eventData);
        console.log("Event created");
      } catch (error) {
        console.error("Error creating event: ", error);
      }
    },
    
    
    async updateEvent(eventId, eventData) {
      try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, eventData);
        console.log("Event updated: ", eventId);
      } catch (error) {
        console.error("Error updating event: ", error);
      }
    },
    
  
    async deleteEvent(eventId) {
      try {
        const eventRef = doc(db, "events", eventId);
        await deleteDoc(eventRef);
        console.log("Event deleted: ", eventId);
        // Note: This does not delete associated attendance records.
        // That requires a more complex backend function.
      } catch (error) {
        console.error("Error deleting event: ", error);
      }
    },
    
    fetchEvents() {
      this.isLoading = true;
      const eventsQuery = query(
        collection(db, "events"), 
        orderBy("date", "desc")
      );

      onSnapshot(eventsQuery, (querySnapshot) => {
        const events = [];
        querySnapshot.forEach((doc) => {
          events.push({ id: doc.id, ...doc.data() });
        });
        
        this.allEvents = events;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        let eventToSet = null;
        const todayStr = today.toISOString().split('T')[0];
        const todayEvent = events.find(e => e.date === todayStr);

        if (todayEvent) {
          eventToSet = todayEvent;
        } else {
          const upcomingEvent = [...events].reverse().find(e => new Date(e.date + 'T00:00:00') > today);
          if (upcomingEvent) {
            eventToSet = upcomingEvent;
          } else {
            eventToSet = events[0] || null;
          }
        }
        this.currentEvent = eventToSet;
        this.isLoading = false;
      }, (error) => {
        console.error("Error fetching events: ", error);
        this.isLoading = false;
      });
    }
  }
})