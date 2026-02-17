<script setup>
defineProps({
  title: { type: String, default: 'WKND' },
  subtitle: { type: String, default: 'Every Other Week Services' },
  description: { type: String, default: 'Experience the energy of our weekend gatherings.' },
  detailedDesc: { type: String, default: 'Join us for WKND services every other week as we gather for worship, teaching, and fellowship. It’s a space to recharge and connect with the community.' },
  image: String
})
</script>

<template>
  <div class="discovery-card" :style="{ backgroundImage: `url(${image})` }">
    <div class="card-overlay">
      <!-- Front Content -->
      <div class="content-front">
        <span class="hero-subtitle">{{ subtitle }}</span>
        <h2 class="hero-title">{{ title }}</h2>
        <p class="hero-desc">{{ description }}</p>
      </div>

      <!-- Detail Content (Visible on Hover/Interaction) -->
      <div class="content-detail">
        <h3 class="detail-title">{{ title }}</h3>
        <div class="divider"></div>
        <p class="detail-text">{{ detailedDesc }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discovery-card { position: relative; width: 100%; height: 400px; border-radius: 20px; background-size: cover; background-position: center; overflow: hidden; cursor: pointer; transition: transform 0.3s ease; }
.discovery-card:hover { transform: translateY(-5px); }
.card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 10%, rgba(0,0,0,0.2) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 30px; transition: background 0.3s ease; }
.discovery-card:hover .card-overlay { background: rgba(0,0,0,0.85); }
.content-front { transition: opacity 0.3s ease, transform 0.3s ease; }
.discovery-card:hover .content-front { opacity: 0; transform: translateY(-20px); }
.hero-subtitle { color: #D32F2F; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
.hero-title { color: white; font-size: 32px; font-weight: 800; margin: 5px 0; }
.hero-desc { color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.4; }
.content-detail { position: absolute; inset: 30px; display: flex; flex-direction: column; justify-content: center; opacity: 0; transform: translateY(20px); transition: all 0.3s ease; }
.discovery-card:hover .content-detail { opacity: 1; transform: translateY(0); }
.detail-title { color: white; font-size: 24px; font-weight: 700; margin-bottom: 10px; }
.divider { width: 40px; height: 3px; background: #D32F2F; margin-bottom: 15px; }
.detail-text { color: white; font-size: 15px; line-height: 1.6; }
</style>