import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db, storage } from '../firebase'
import { 
  collection, 
  setDoc, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  where,
  getDoc
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { useAuthStore } from './auth'; 

export const useEventsStore = defineStore('events', {
  state: () => ({
    currentEvent: null, 
    allEvents: [],
    isLoading: true
  }),
  actions: {
    getEventCollection() {
      const authStore = useAuthStore();
      if (!authStore.branchId) {
          console.error("Branch ID not available. Cannot fetch events.");
          return collection(db, "events_error");
      }
      return collection(db, "branches", authStore.branchId, "events");
    },

    // 🚀 OPTIMIZATION: Replaced onSnapshot with getDocs and caching
    async fetchEvents(force = false) {
      if (!force && this.allEvents.length > 0) {
        this.isLoading = false;
        return; 
      }

      this.isLoading = true;
      try {
        const eventsQuery = query(
          this.getEventCollection(), 
          orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(eventsQuery);
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
        
        this.cleanupOldEventImages(); 
      } catch (error) {
        console.error("Error fetching events: ", error);
      } finally {
        this.isLoading = false;
      }
    },

    async createEvent(eventData) {
      try {
        const authStore = useAuthStore()
        if (!authStore.branchId) throw new Error('Missing branchId')

        let prefix = 'EVENT'
        if (eventData.eventType === 'service') {
          prefix = 'WKND'
        } else if (eventData.eventType === 'b1g_event') {
          prefix = 'B1G'
        } else if (eventData.eventType === 'ccf_event') {
          prefix = 'CCFE'
        }

        const cleanDate = eventData.date.replace(/-/g, '')
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
        const eventId = `${prefix}_${cleanDate}_${randomSuffix}`

        const eventRef = doc(this.getEventCollection(), eventId)

        const newEventObj = {
          ...eventData,
          id: eventId 
        };

        await setDoc(eventRef, newEventObj)
        
        // 🚀 OPTIMIZATION: Push to local array to avoid refetching
        this.allEvents.unshift(newEventObj);
        
        // Sort to maintain descending order if we just unshifted
        this.allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Set as current event if it's today
        const todayStr = new Date().toISOString().split('T')[0];
        if (newEventObj.date === todayStr) {
          this.currentEvent = newEventObj;
        }

        console.log('Event created with ID:', eventId)
      } catch (error) {
        console.error('Error creating event:', error)
      }
    },
    
    async updateEvent(eventId, eventData) {
      try {
        const eventRef = doc(this.getEventCollection(), eventId);
        await updateDoc(eventRef, eventData);
        
        // 🚀 OPTIMIZATION: Update local state immediately
        const index = this.allEvents.findIndex(e => e.id === eventId);
        if (index !== -1) {
          this.allEvents[index] = { ...this.allEvents[index], ...eventData };
        }

        if (this.currentEvent && this.currentEvent.id === eventId) {
          this.currentEvent = { ...this.currentEvent, ...eventData };
        }

        console.log("Event updated: ", eventId);
      } catch (error) {
        console.error("Error updating event: ", error);
      }
    },
    
    async deleteEvent(eventId) {
      try {
        const eventRef = doc(this.getEventCollection(), eventId);
        await deleteDoc(eventRef);

        // 🚀 OPTIMIZATION: Remove from local array
        this.allEvents = this.allEvents.filter(e => e.id !== eventId);
        if (this.currentEvent && this.currentEvent.id === eventId) {
           this.currentEvent = null;
        }

        console.log("Event deleted: ", eventId);
      } catch (error) {
        console.error("Error deleting event: ", error);
      }
    },

    async endEvent(eventId) {
      try {
        const authStore = useAuthStore();
        if (!authStore.branchId) throw new Error('Missing branchId.');
        if (!eventId) throw new Error('No eventId provided.');

        const eventRef = doc(this.getEventCollection(), eventId);
        
        const updates = {
          ended: true,
          endedAt: serverTimestamp(),
          endedBy: authStore.user?.uid || null,
          endedReason: 'manual'
        };

        await updateDoc(eventRef, updates);
        
        // 🚀 OPTIMIZATION: Update local state immediately
        const index = this.allEvents.findIndex(e => e.id === eventId);
        if (index !== -1) {
          this.allEvents[index].ended = true;
        }
        if (this.currentEvent && this.currentEvent.id === eventId) {
           this.currentEvent = null; // Clear the live event
        }
        
        await this.checkAndRevokeInactiveVolunteers(authStore.branchId);

        console.log("Event ended successfully: ", eventId);
        return true;
      } catch (error) {
        console.error("Error ending event: ", error);
        throw error; 
      }
    },

    async checkAndRevokeInactiveVolunteers(branchId) {
      console.log("Starting Volunteer Revocation Check...");
      const today = new Date().toISOString().split('T')[0];
      
      const last5Events = this.allEvents
        .filter(e => e.eventType === 'service' && e.date <= today)
        .sort((a, b) => new Date(b.date) - new Date(a.date)) 
        .slice(0, 5);

      if (last5Events.length < 5) {
        console.log("Not enough past events to enforce revocation yet.");
        return;
      }

      const membersRef = collection(db, "branches", branchId, "members");
      const membersSnap = await getDocs(query(membersRef, where("status", "!=", "archived")));
      
      const volunteers = [];
      membersSnap.forEach(docSnap => {
        const m = docSnap.data();
        if (m.finalTags && m.finalTags.isVolunteer) {
          volunteers.push(m);
        }
      });

      for (const vol of volunteers) {
        let missedConsecutive = 0;

        for (const ev of last5Events) {
          const attendanceRef = doc(db, "branches", branchId, "events", ev.id, "attendance", vol.id);
          const attSnap = await getDoc(attendanceRef);

          let served = false;
          if (attSnap.exists()) {
            const data = attSnap.data();
            if (data.ministry && data.ministry !== 'N/A') {
              served = true;
            }
          }

          if (!served) {
            missedConsecutive++;
          } else {
            break; 
          }
        }

        if (missedConsecutive >= 5) {
          console.warn(`Revoking volunteer tag for ${vol.firstName} ${vol.lastName} (Missed 5 consecutive)`);
          const memberRef = doc(db, "branches", branchId, "members", vol.id);
          const updates = {
            "finalTags.isVolunteer": false,
            "finalTags.volunteerMinistry": []
          };
          if (!vol.finalTags.isDgroupLeader) {
            updates["finalTags.isRegular"] = true;
          }
          await updateDoc(memberRef, updates);
        }
      }
      console.log("Revocation check complete.");
    },

    async cleanupOldEventImages() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const pastEventsWithImages = this.allEvents.filter(e => {
        return e.date < todayStr && e.photoURL && e.photoURL.startsWith('https');
      });

      if (pastEventsWithImages.length === 0) return;

      for (const event of pastEventsWithImages) {
        try {
          const imageRef = storageRef(storage, event.photoURL);
          try {
            await deleteObject(imageRef)
          } catch (error) {
            if (error.code !== 'storage/object-not-found') {
              console.error('Failed to delete image:', error)
            }
          }
          const eventRef = doc(this.getEventCollection(), event.id);
          await updateDoc(eventRef, { photoURL: '' });
          
          // Update local state
          const idx = this.allEvents.findIndex(e => e.id === event.id);
          if (idx !== -1) this.allEvents[idx].photoURL = '';
        } catch (error) {
          console.warn(`Failed to cleanup image for ${event.name}:`, error);
        }
      }
    }
  }
})