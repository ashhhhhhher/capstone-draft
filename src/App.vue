<script setup>
import { computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/dgmComponents/NavBar.vue'
import ChatBox from './components/ChatBox.vue'
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
    
    <!-- GLOBAL CHATBOX: Visible on all pages when logged in -->
    <ChatBox v-if="authStore.user" />
  </div>
</template>