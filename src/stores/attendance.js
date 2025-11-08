import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '../firebase'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where 
} from "firebase/firestore";

export const useAttendanceStore = defineStore('attendance', () => {
  // --- State ---
  const currentEventAttendees = ref([])
  const allAttendance = ref([]) // NEW: To store all historical records
  const isLoading = ref(false)

  // --- Actions ---

  /**
   * Fetches all attendance records for a specific event ID.
   */
  function fetchAttendanceForEvent(eventId) {
    if (!eventId) {
      currentEventAttendees.value = []
      return
    }
    
    this.isLoading = true;
    const attQuery = query(
      collection(db, "attendance"), 
      where("eventId", "==", eventId)
    );

    onSnapshot(attQuery, (querySnapshot) => {
      const attendees = [];
      querySnapshot.forEach((doc) => {
        attendees.push(doc.data());
      });
      currentEventAttendees.value = attendees;
      this.isLoading = false;
      console.log("Attendance store updated for event:", eventId);
    }, (error) => {
      console.error("Error fetching attendance: ", error);
      this.isLoading = false;
    });
  }
  
  /**
   * NEW: Fetches ALL attendance records for historical insights.
   */
  function fetchAllAttendance() {
    const allQuery = query(collection(db, "attendance"));
    
    onSnapshot(allQuery, (querySnapshot) => {
      const allRecords = [];
      querySnapshot.forEach((doc) => {
        allRecords.push(doc.data());
      });
      allAttendance.value = allRecords;
      console.log("Historical attendance loaded.");
    }, (error) => {
      console.error("Error fetching all attendance: ", error);
    });
  }

  /**
   * Marks a member's attendance by creating a new document.
   */
  async function markAttendance(memberId, eventId) {
    if (!memberId || !eventId) {
      console.error("Missing memberId or eventId");
      return;
    }

    const isAlreadyScanned = currentEventAttendees.value.some(
      att => att.memberId === memberId
    );
    
    if (isAlreadyScanned) {
      return { status: 'warning', message: 'Already marked present.' };
    }

    try {
      const newRecord = {
        memberId: memberId,
        eventId: eventId,
        timestamp: new Date()
      };
      await addDoc(collection(db, "attendance"), newRecord);
      return { status: 'success', message: 'Attendance recorded.' };
    } catch (error) {
      return { status: 'error', message: 'Database error.' };
    }
  }

  return { 
    currentEventAttendees, 
    allAttendance, // <-- Expose new state
    isLoading, 
    fetchAttendanceForEvent, 
    fetchAllAttendance, // <-- Expose new action
    markAttendance 
  }
})