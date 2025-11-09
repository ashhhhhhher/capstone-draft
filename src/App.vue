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
const userRole = computed(() => authStore.userRole)

// Show Nav Bar only on admin pages
const showNav = computed(() => {
  return route.name !== 'login' && 
         route.name !== 'signup' &&
         userRole.value === 'admin'
})

// --- FIX: Watch for both user and branchId ---
watch(() => [authStore.user, authStore.branchId], ([newUser, newBranchId]) => {
  if (newUser && newBranchId) {
    console.log(`User logged in to branch: ${newBranchId}. Fetching data...`)
    // Fetch data for the determined branch
    membersStore.fetchMembers()
    eventsStore.fetchEvents()
    attendanceStore.fetchAllAttendance()
  }
}, { immediate: true })

// Watch for the currentEvent to be loaded
watch(() => eventsStore.currentEvent, (newEvent, oldEvent) => {
  if (newEvent && authStore.userRole === 'admin') {
    console.log("Current event set. Fetching attendance for:", newEvent.id)
    attendanceStore.fetchAttendanceForEvent(newEvent.id)
  }
}, { immediate: true })
</script>

<template>
  <!-- 
    The router now handles the redirect, but we still ensure 
    the app doesn't show garbage while data loads.
  -->
  <div v-if="!isAuthReady" class="loading-container">
    <div class="spinner"></div>
    <p>Loading Authentication...</p>
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