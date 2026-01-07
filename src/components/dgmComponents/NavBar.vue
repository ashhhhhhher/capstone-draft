<script setup>
import { RouterLink } from 'vue-router'
import { Home, Users, PlusSquare, BarChart2, QrCode } from 'lucide-vue-next'
</script>

<template>
  <nav class="navbar">
    <RouterLink to="/" class="nav-link">
      <Home />
      <span>Home</span>
    </RouterLink>
    <RouterLink to="/members" class="nav-link">
      <Users />
      <span>Members</span>
    </RouterLink>

    <RouterLink to="/scan" class="qr-scan-btn">
      <QrCode :size="32" />
    </RouterLink>

    <RouterLink to="/register" class="nav-link">
      <PlusSquare />
      <span>Register</span>
    </RouterLink>
    <RouterLink to="/insights" class="nav-link">
      <BarChart2 />
      <span>Insights</span>
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

/* This style will apply to the active page link */
.nav-link.router-link-exact-active {
  color: #0D47A1; 
}

.qr-scan-btn {
  background-color: #1976D2; /* Our main blue color */
  color: white;
  border: none;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-20px); /* Lifts the button up */
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
  cursor: pointer;
}

/* This will make the QR button "active" when you are on the /scan page */
.qr-scan-btn.router-link-exact-active {
   box-shadow: 0 6px 16px rgba(25, 118, 210, 0.6);
}
</style>