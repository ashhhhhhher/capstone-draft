<script setup>
import { RouterLink } from 'vue-router'
import { Home, Calendar, Users, User } from 'lucide-vue-next'
</script>

<template>
  <nav class="navbar">
    <div class="nav-container">
      <RouterLink to="/member-dashboard" class="nav-link">
        <div class="icon-wrapper"><Home :size="20" /></div>
        <span>Home</span>
      </RouterLink>
      
      <RouterLink to="/member/attendance" class="nav-link">
        <div class="icon-wrapper"><Calendar :size="20" /></div>
        <span>Attendance</span>
      </RouterLink>

      <RouterLink to="/member/dgroup" class="nav-link">
        <div class="icon-wrapper"><Users :size="20" /></div>
        <span>Dgroup</span>
      </RouterLink>

      <RouterLink to="/member/profile" class="nav-link">
        <div class="icon-wrapper"><User :size="20" /></div>
        <span>Profile</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar { position: fixed; bottom: 0; left: 0; right: 0; height: 75px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(15px); display: flex; justify-content: center; border-top: 1px solid rgba(0, 0, 0, 0.04); z-index: 1000; padding-bottom: env(safe-area-inset-bottom); }
.nav-container { display: flex; width: 100%; justify-content: space-around; align-items: center; padding: 0 5px; }
.nav-link { display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: #64748b; font-size: 10px; font-weight: 600; gap: 4px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex: 1; height: 100%; }
.icon-wrapper { padding: 6px 12px; border-radius: 20px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; }
.nav-link:active .icon-wrapper { transform: scale(0.9); background: rgba(37, 99, 235, 0.05); }
.nav-link.router-link-exact-active { color: #2563eb; }
.nav-link.router-link-exact-active .icon-wrapper { background: rgba(37, 99, 235, 0.1); transform: translateY(-2px); animation: bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes bounce { 0%, 100% { transform: translateY(-2px); } 50% { transform: translateY(-6px); } }
</style>