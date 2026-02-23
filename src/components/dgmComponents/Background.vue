<script setup>
defineProps({ title: { type: String, default: 'DGM HOME' } })
</script>

<template>
  <div class="hero-wrapper">
    <div class="elevate-hero-dark">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="brand-badge">INTRODUCING</div>
        <div class="logo-area">
          <img src="/elevate word.PNG" alt="ELEVATE" class="hero-logo" />
          <div class="shimmer"></div>
        </div>
        <h1 class="hero-title">Elevating the <span class="text-red">Next Generation</span></h1>
        <p class="hero-description">
          Empowering students through leadership, rooted in values, and committed to excellence.
        </p>
        <div class="hero-footer-meta">
          <span class="location-tag">📍 BAGUIO</span>
          <span class="dot"></span>
          <span class="status-tag">Live Dashboard</span>
        </div>
      </div>
      <div class="hero-visual-accents">
        <div class="circle c1"></div>
        <div class="circle c2"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-wrapper { padding: 24px 32px 0 32px; width: 100%; box-sizing: border-box; }
.elevate-hero-dark { position: relative; width: 100%; min-height: 240px; height: auto; background: #0a0a0b; border-radius: 24px; display: flex; align-items: center; padding: 40px; overflow: hidden; color: #fff; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 1px solid #1e1e20; box-sizing: border-box; }
.hero-overlay { position: absolute; inset: 0; background: radial-gradient(circle at 20% 50%, rgba(211, 47, 47, 0.12) 0%, transparent 50%); z-index: 1; }
.hero-content { position: relative; z-index: 10; max-width: 100%; animation: slideIn 0.8s ease-out; }
.brand-badge { display: inline-block; padding: 4px 10px; background: rgba(211, 47, 47, 0.2); border: 1px solid rgba(211, 47, 47, 0.3); color: #ff5252; font-size: 9px; font-weight: 900; letter-spacing: 2.5px; border-radius: 4px; margin-bottom: 8px; }
.logo-area { position: relative; margin-bottom: 4px; display: inline-block; }
.hero-logo { height: clamp(32px, 5vw, 48px); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.1)); width: auto; }
.shimmer { position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent); animation: sweep 3s infinite; }
.hero-title { font-size: clamp(20px, 4vw, 24px); font-weight: 800; letter-spacing: -0.5px; margin: 4px 0; line-height: 1.1; }
.text-red { color: #D32F2F; }
.hero-description { font-size: clamp(13px, 2vw, 14px); color: #a1a1aa; line-height: 1.4; max-width: 420px; margin-top: 8px; }
.hero-footer-meta { margin-top: 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 1px; }
.dot { width: 4px; height: 4px; background: #3f3f46; border-radius: 50%; }
.hero-visual-accents .circle { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.25; z-index: 2; pointer-events: none; }
.c1 { width: clamp(150px, 30vw, 220px); height: clamp(150px, 30vw, 220px); background: #D32F2F; top: -10%; right: -5%; }
.c2 { width: clamp(100px, 20vw, 160px); height: clamp(100px, 20vw, 160px); background: #0d47a1; bottom: -5%; right: 15%; }
@keyframes sweep { 100% { left: 200%; } }
@keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 1024px) { .hero-wrapper { padding: 20px 24px 0 24px; } .elevate-hero-dark { padding: 32px; min-height: 220px; } }
@media (max-width: 768px) { .hero-wrapper { padding: 16px 16px 0 16px; } .elevate-hero-dark { padding: 24px; border-radius: 20px; } .hero-content { text-align: left; } .hero-footer-meta { margin-top: 16px; } }
@media (max-width: 480px) { .hero-wrapper { padding: 12px 12px 0 12px; } .elevate-hero-dark { padding: 20px; min-height: 200px; border-radius: 16px; } .hero-description { max-width: 100%; } .hero-visual-accents .circle { opacity: 0.15; } }
</style>