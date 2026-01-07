<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/DGM Components/AppHeader.vue'
import { Home, Users, QrCode, CalendarCheck } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { name: 'Home', path: '/member/home', icon: Home },
  { name: 'Dgroup', path: '/member/dgroup', icon: Users },
  { name: 'Attendance', path: '/member/attendance', icon: CalendarCheck },
  { name: 'My QR', path: '/member/qr', icon: QrCode },
]

function isActive(path) {
  return route.path === path
}
</script>

<template>
  <div class="member-layout">
    <div class="fixed-header">
      <AppHeader />
    </div>

    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <nav class="bottom-nav">
      <div 
        v-for="item in navItems" 
        :key="item.name"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        @click="router.push(item.path)"
      >
        <component :is="item.icon" :size="24" :stroke-width="isActive(item.path) ? 2.5 : 2" />
        <span class="nav-label">{{ item.name }}</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.member-layout {
  min-height: 100vh;
  background-color: #F5F7FA;
  padding-bottom: 80px; 
  padding-top: 80px; 
}

.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

/* UPDATED: Increased max-width for Desktop View */
.main-content {
  max-width: 1200px; /* Changed from 600px to 1200px */
  margin: 0 auto;
  padding: 0 20px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: white;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 15px rgba(0,0,0,0.08);
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #90A4AE;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  height: 100%;
}

.nav-item.active {
  color: #1976D2;
}

.nav-label {
  font-size: 11px;
  margin-top: 4px;
  font-weight: 600;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>