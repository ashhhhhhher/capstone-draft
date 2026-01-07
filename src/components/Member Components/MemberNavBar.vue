<script setup>
import { RouterLink } from 'vue-router'
import { Home, Calendar, Users, User } from 'lucide-vue-next'
</script>

<template>
  <nav class="navbar">
    <RouterLink to="/member-dashboard" class="nav-link" active-class="active" exact-active-class="active">
      <Home :size="18" />
      <span>Home</span>
    </RouterLink>

    <RouterLink to="/member/attendance" class="nav-link" active-class="active" exact-active-class="active">
      <Calendar :size="18" />
      <span>Attendance</span>
    </RouterLink>

    <RouterLink to="/member/dgroup" class="nav-link" active-class="active" exact-active-class="active">
      <Users :size="18" />
      <span>Dgroup</span>
    </RouterLink>

    <RouterLink to="/member/profile" class="nav-link" active-class="active" exact-active-class="active">
      <User :size="18" />
      <span>Profile</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: #ffffff;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #90A4AE;
  font-size: 10px;
}

/* highlight using explicit "active" class from RouterLink */
.nav-link.active {
  color: #0D47A1;
}

/* retain fallback selector if router injects router-link-exact-active */
.nav-link.router-link-exact-active {
  color: #0D47A1;
}
</style>
