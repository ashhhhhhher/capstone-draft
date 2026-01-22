import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db, storage } from '../firebase'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
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

    // --- END EVENT & VOLUNTEER REVOCATION LOGIC ---
    async endEvent(eventId) {
      try {
        const authStore = useAuthStore();
        if (!authStore.branchId) throw new Error('Missing branchId.');
        if (!eventId) throw new Error('No eventId provided.');

        // 1. Mark event as ended
        const eventRef = doc(this.getEventCollection(), eventId);
        await updateDoc(eventRef, {
          ended: true,
          endedAt: serverTimestamp(),
          endedBy: authStore.user?.uid || null,
          endedReason: 'manual'
        });
        
        // 2. TRIGGER VOLUNTEER REVOCATION CHECK
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
      
      // A. Get last 5 'service' events (descending date)
      // Note: We need to use the fetched allEvents state to ensure we get the correct sorted list
      // Filter for ended events or events with dates in the past
      const today = new Date().toISOString().split('T')[0];
      
      const last5Events = this.allEvents
        .filter(e => e.eventType === 'service' && e.date <= today)
        .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
        .slice(0, 5);

      if (last5Events.length < 5) {
        console.log("Not enough past events to enforce revocation yet.");
        return;
      }

      // B. Get all members who are currently tagged as Volunteers
      const membersRef = collection(db, "branches", branchId, "members");
      // Note: Firestore doesn't support deep query on object fields easily without index, 
      // getting all active members is safer then filtering in JS for this batch operation
      const membersSnap = await getDocs(query(membersRef, where("status", "!=", "archived")));
      
      const volunteers = [];
      membersSnap.forEach(docSnap => {
        const m = docSnap.data();
        if (m.finalTags && m.finalTags.isVolunteer) {
          volunteers.push(m);
        }
      });

      console.log(`Checking ${volunteers.length} volunteers for inactivity...`);

      // C. Check each volunteer
      for (const vol of volunteers) {
        let missedConsecutive = 0;

        // Iterate through the last 5 events (Newest -> Oldest)
        for (const ev of last5Events) {
          // Check attendance doc for this event/member
          const attendanceRef = doc(db, "branches", branchId, "events", ev.id, "attendance", vol.id);
          const attSnap = await getDoc(attendanceRef);

          let served = false;
          if (attSnap.exists()) {
            const data = attSnap.data();
            // They served if ministry is defined and NOT 'N/A'
            if (data.ministry && data.ministry !== 'N/A') {
              served = true;
            }
          }

          if (!served) {
            missedConsecutive++;
          } else {
            // If they served in this event, the streak of inactivity is broken
            break; 
          }
        }

        // D. Revoke if missed 5 consecutive times
        if (missedConsecutive >= 5) {
          console.warn(`Revoking volunteer tag for ${vol.firstName} ${vol.lastName} (Missed 5 consecutive)`);
          
          const memberRef = doc(db, "branches", branchId, "members", vol.id);
          
          // Logic: 
          // 1. Remove isVolunteer
          // 2. Clear volunteerMinistry
          // 3. If they are NOT a Dgroup Leader, set isRegular = true
          // 4. If they ARE a Dgroup Leader, just leave isRegular = false (DL takes precedence)
          
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

    // --- NEW: CLEANUP LOGIC ---
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
        this.cleanupOldEventImages(); 

      }, (error) => {
        console.error("Error fetching events: ", error);
        this.isLoading = false;
      });
    }
  }
})