<script setup>
import { RouterLink } from 'vue-router'
import { Home, Users, LayoutGrid, BarChart2, QrCode } from 'lucide-vue-next'
</script>

<template>
  <nav class="navbar">
    <div class="nav-container">
      <RouterLink to="/" class="nav-link">
        <div class="icon-wrapper"><Home :size="20" /></div>
        <span>Home</span>
      </RouterLink>
      <RouterLink to="/members" class="nav-link">
        <div class="icon-wrapper"><Users :size="20" /></div>
        <span>Members</span>
      </RouterLink>
      <div class="center-action">
        <RouterLink to="/scan" class="qr-scan-btn">
          <QrCode :size="26" stroke-width="2.5" />
          <div class="pulse-ring"></div>
        </RouterLink>
      </div>
      <RouterLink to="/dgroups" class="nav-link">
        <div class="icon-wrapper"><LayoutGrid :size="20" /></div>
        <span>DGroups</span>
      </RouterLink>
      <RouterLink to="/insights" class="nav-link">
        <div class="icon-wrapper"><BarChart2 :size="20" /></div>
        <span>Insights</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar { position: fixed; bottom: 0; left: 0; right: 0; height: 75px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); display: flex; justify-content: center; border-top: 1px solid rgba(0, 0, 0, 0.05); z-index: 1000; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.03); }
.nav-container { display: flex; width: 100%; justify-content: space-around; align-items: center; padding: 0 8px; }
.nav-link { display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: #94a3b8; font-size: 10px; font-weight: 700; gap: 4px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex: 1; height: 100%; position: relative; }
.icon-wrapper { padding: 8px 14px; border-radius: 24px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; }
.nav-link:active .icon-wrapper { transform: scale(0.85); background: rgba(37, 99, 235, 0.08); }
.nav-link.router-link-exact-active { color: #2563eb; }
.nav-link.router-link-exact-active .icon-wrapper { background: rgba(37, 99, 235, 0.12); transform: translateY(-4px); animation: bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.center-action { position: relative; flex: 1.2; height: 100%; display: flex; align-items: center; justify-content: center; }
.qr-scan-btn { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; transform: translateY(-28px); box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35); transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: 2; }
.qr-scan-btn:active { transform: translateY(-22px) scale(0.92); }
.pulse-ring { position: absolute; top: 50%; left: 50%; width: 56px; height: 56px; transform: translate(-50%, -50%); border-radius: 18px; background: rgba(37, 99, 235, 0.3); animation: pulse 2.5s infinite; z-index: -1; }
@keyframes bounce { 0%, 100% { transform: translateY(-4px); } 50% { transform: translateY(-10px); } }
@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; } 100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; } }
</style>