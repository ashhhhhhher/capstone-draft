<script setup>
defineProps({
  title: String,
  subtitle: String,
  description: String,
  detailedDesc: String,
  image: String
})
</script>

<template>
  <div class="discovery-card" :style="{ backgroundImage: `url(${image})` }">
    <div class="card-overlay">
      <div class="content-front">
        <span class="hero-subtitle">{{ subtitle }}</span>
        <h2 class="hero-title">{{ title }}</h2>
        <p class="hero-desc">{{ description }}</p>
      </div>

      <div class="content-detail">
        <h3 class="detail-title">{{ title }}</h3>
        <div class="divider"></div>
        <p class="detail-text">{{ detailedDesc }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discovery-card { position: relative; min-height: 260px; border-radius: 20px; overflow: hidden; background-size: cover; background-position: center; transition: all 0.5s ease; cursor: default; }
.card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%); padding: 24px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: white; }
.content-front { transition: all 0.5s ease; opacity: 1; }
.hero-subtitle { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 8px; text-transform: uppercase; display: block; }
.hero-title { font-size: 32px; font-weight: 900; margin: 0 0 8px 0; }
.hero-desc { font-size: 14px; line-height: 1.4; opacity: 0.9; max-width: 240px; margin: 0 auto; }
/* Changed to 0.8 opacity and added backdrop blur for smoothness */
.content-detail { position: absolute; inset: 0; padding: 30px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); opacity: 0; transform: translateY(15px); transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1); }
.discovery-card:hover .content-front { opacity: 0; transform: translateY(-10px); }
.discovery-card:hover .content-detail { opacity: 1; transform: translateY(0); }
.detail-title { font-size: 20px; color: #1a1a1a; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; }
.divider { width: 40px; height: 3px; background: #1976D2; margin-bottom: 16px; border-radius: 2px; }
.detail-text { font-size: 15px; line-height: 1.6; color: #263238; font-weight: 600; }
</style>