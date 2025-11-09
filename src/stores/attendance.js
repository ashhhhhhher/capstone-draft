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
import { useAuthStore } from './auth'; // Import Auth Store


export const useAttendanceStore = defineStore('attendance', () => {
  // --- State ---
  const currentEventAttendees = ref([])
  const allAttendance = ref([])
  const isLoading = ref(false)

  // Helper to get the correct Firestore collection path
  const getAttendanceCollection = () => {
    const authStore = useAuthStore();
    if (!authStore.branchId) {
        console.error("Branch ID not available. Cannot fetch attendance.");
        return collection(db, "attendance_error");
    }
    // CRITICAL: Use the dynamic branch path
    return collection(db, "branches", authStore.branchId, "attendance");
  };

  // --- Actions ---

  /**
   * Fetches attendance records for a specific event ID within the branch.
   */
  function fetchAttendanceForEvent(eventId) {
    if (!eventId) {
      currentEventAttendees.value = []
      return
    }
    
    this.isLoading = true;
    const attQuery = query(
      getAttendanceCollection(), // Use the branch-aware collection
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
   * Fetches ALL attendance records for historical insights within the branch.
   */
  function fetchAllAttendance() {
    const allQuery = query(getAttendanceCollection());
    
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
   * Marks a member's attendance by creating a new document in the branch.
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
      await addDoc(getAttendanceCollection(), newRecord);
      
      return { status: 'success', message: 'Attendance recorded.' };

    } catch (error) {
      return { status: 'error', message: 'Database error.' };
    }
  }

  return { 
    currentEventAttendees, 
    allAttendance,
    isLoading, 
    fetchAttendanceForEvent, 
    fetchAllAttendance,
    markAttendance 
  }
})