<script setup>
import { computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { useAuthStore } from './stores/auth'
import { useMembersStore } from './stores/members'
import { useEventsStore } from './stores/events'
import { useAttendanceStore } from './stores/attendance'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const eventsStore = useEventsStore()
const attendanceStore = useAttendanceStore()

const route = useRoute()

const isAuthReady = computed(() => authStore.isAuthReady)
const showNav = computed(() => route.name !== 'login')

// Watch for the user to log in
watch(() => authStore.user, (newUser, oldUser) => {
  if (newUser && !oldUser) {
    // User has just logged in
    console.log("User logged in! Fetching data...")
    membersStore.fetchMembers()
    eventsStore.fetchEvents()
    attendanceStore.fetchAllAttendance() // <-- ADD THIS LINE
  }
}, { immediate: true })

// Watch for the currentEvent to be loaded
watch(() => eventsStore.currentEvent, (newEvent, oldEvent) => {
  if (newEvent) {
    // As soon as we know the current event, fetch its attendance
    console.log("Current event set. Fetching attendance for:", newEvent.id)
    attendanceStore.fetchAttendanceForEvent(newEvent.id)
  }
}, { immediate: true })
</script>

<template>
  <div v-if="!isAuthReady" class="loading-container">
    <div class="spinner"></div>
    <p>Loading Your Dashboard...</p>
  </div>

  <div v-else class="app-wrapper">
    <main class="main-content">
      <RouterView />
    </main>
    <NavBar v-if="showNav" />
  </div>
</template>

<style>
/* (Your global styles are all the same) */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f4f7f9;
  color: #0D47A1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #CFD8DC;
  border-top-color: #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-container p {
  margin-top: 20px;
  font-size: 16px;
  font-weight: 500;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>