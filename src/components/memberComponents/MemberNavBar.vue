<script setup>
import { RouterLink } from 'vue-router'
import { Home, Calendar, Users, User } from 'lucide-vue-next'
</script>

<template>
  <nav class="navbar">
    <RouterLink to="/member-dashboard" class="nav-link" active-class="active">
      <Home :size="20" /><span>Home</span>
    </RouterLink>
    <RouterLink to="/member/attendance" class="nav-link" active-class="active">
      <Calendar :size="20" /><span>Attendance</span>
    </RouterLink>
    <RouterLink to="/member/dgroup" class="nav-link" active-class="active">
      <Users :size="20" /><span>Dgroup</span>
    </RouterLink>
    <RouterLink to="/member/profile" class="nav-link" active-class="active">
      <User :size="20" /><span>Profile</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.navbar { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background-color: #ffffff; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1); z-index: 1000; }
.nav-link { display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: #90A4AE; font-size: 10px; border: none; background: none; cursor: pointer; flex: 1; gap: 4px; transition: color 0.2s; }
.nav-link.active { color: #0D47A1; }
.nav-link.router-link-exact-active { color: #0D47A1; }
</style>