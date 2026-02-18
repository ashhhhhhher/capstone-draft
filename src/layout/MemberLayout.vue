<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/dgmComponents/AppHeader.vue'
import { Home, Users, QrCode, CalendarCheck } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { name: 'Home', path: '/member/home', icon: Home },
  { name: 'Dgroup', path: '/member/dgroup', icon: Users },
  { name: 'Attendance', path: '/member/attendance', icon: CalendarCheck },
  { name: 'My QR', path: '/member/qr', icon: QrCode },
]

function handleNav(item) { router.push(item.path) }
function isActive(path) { return route.path === path }
</script>

<template>
  <div class="member-layout">
    <div class="fixed-header"><AppHeader /></div>
    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in"><component :is="Component" /></transition>
      </RouterView>
    </main>

    <nav class="bottom-nav">
      <div class="nav-container">
        <div v-for="item in navItems" :key="item.name" class="nav-item" :class="{ active: isActive(item.path) }" @click="handleNav(item)">
          <div class="icon-wrapper">
            <component :is="item.icon" :size="22" :stroke-width="isActive(item.path) ? 2.5 : 2" />
          </div>
          <span class="nav-label">{{ item.name }}</span>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.member-layout { min-height: 100vh; background-color: #f8fafc; padding-bottom: 75px; padding-top: 64px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 1050; }
.main-content { max-width: 1200px; margin: 0 auto; padding: 20px; }
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 75px; background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; justify-content: center; border-top: 1px solid rgba(0, 0, 0, 0.05); z-index: 1000; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.03); }
.nav-container { display: flex; width: 100%; max-width: 100%; justify-content: space-evenly; align-items: center; padding: 0 10px; }
.nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex: 1; height: 100%; position: relative; max-width: 120px; }
.icon-wrapper { padding: 4px 12px; border-radius: 12px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; }
.nav-item:active .icon-wrapper { transform: scale(0.9); background: rgba(25, 118, 210, 0.05); }
.nav-item.active { color: #1976D2; }
.nav-item.active .icon-wrapper { background: rgba(25, 118, 210, 0.08); transform: translateY(-2px); }
.nav-item.active .nav-label { font-weight: 700; color: #1976D2; }
.nav-label { font-size: 11px; font-weight: 600; margin-top: 2px; letter-spacing: 0.01em; transition: all 0.3s ease; white-space: nowrap; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (min-width: 768px) { .nav-container { max-width: 800px; } }
</style>