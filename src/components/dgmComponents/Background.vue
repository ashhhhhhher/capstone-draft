<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import AboutUs from './AboutUs.vue'; // Importing AboutUs component

const props = defineProps({ title: { type: String, default: 'HOMEPAGE' } });

const services = [
  {
    id: 'elevate',
    featureKey: 'unite', // Maps to AboutUs feature key
    badge: 'INTRODUCING',
    bgImage: '/unitesm.jpg',
    title: 'Elevating the',
    highlight: 'Next Generation',
    description: 'Empowering students through leadership, rooted in values, and committed to excellence.',
    contact: '09176573341',
    socials: '@ElevateBaguioPH',
    email: 'elevatebaguio00@gmail.com',
    color: '#D32F2F',
    accent: '#0d47a1'
  },
  {
    id: 'b1g',
    featureKey: 'groups', // Maps to AboutUs feature key
    badge: 'B1G Singles',
    bgImage: '/group2.jpg', 
    title: 'Be One with',
    highlight: 'God',
    description: 'A community where every student belongs. Experience faith, fun, and fellowship every week.',
    contact: '09776342733',
    socials: '@B1GBaguio',
    color: '#1e88e5',
    accent: '#ffd600'
  },
  {
    id: 'wknd',
    featureKey: 'wknd', // Maps to AboutUs feature key
    badge: 'WKND SERVICE',
    bgImage: '/hugs.jpg',
    title: 'Start your',
    highlight: 'WKND Right',
    description: 'Join our weekend gatherings for powerful worship and messages that resonate with your life.',
    schedule: 'Saturdays at 5PM',
    cta: 'Check out socials to be updated with future events',
    color: '#43a047',
    accent: '#ffffff'
  }
];

const currentIndex = ref(0);
const isAboutOpen = ref(false); // State for About Us visibility
const targetFeature = ref(null); // Which feature to open in AboutUs
let timer = null;

const startCycle = () => { timer = setInterval(() => { currentIndex.value = (currentIndex.value + 1) % services.length; }, 5000); };

onMounted(() => startCycle());
onUnmounted(() => clearInterval(timer));

const setSlide = (index) => { currentIndex.value = index; clearInterval(timer); startCycle(); };

// Functions to handle About Us navigation with deep-linking
const openAbout = () => { 
  targetFeature.value = services[currentIndex.value].featureKey;
  isAboutOpen.value = true; 
};
const closeAbout = () => { 
  isAboutOpen.value = false; 
  targetFeature.value = null; // Reset when closing
};
</script>

<template>
  <div class="hero-wrapper">
    <!-- Click event added to the main section -->
    <div class="elevate-hero-dark clickable-section" :style="{ backgroundImage: `url(${services[currentIndex].bgImage})` }" @click="openAbout">
      <div class="hero-overlay" :style="{ background: `linear-gradient(90deg, rgba(10,10,11,0.85) 0%, rgba(10,10,11,0.3) 100%), radial-gradient(circle at 20% 50%, ${services[currentIndex].color}33 0%, transparent 50%)` }"></div>
      <div class="hero-visual-accents">
        <div class="circle c1" :style="{ background: services[currentIndex].color }"></div>
        <div class="circle c2" :style="{ background: services[currentIndex].accent }"></div>
      </div>
      <div class="shimmer-container"><div class="shimmer"></div></div>
      <Transition name="hero-fade" mode="out-in">
        <div :key="currentIndex" class="hero-content">
          <div class="brand-badge" :style="{ color: services[currentIndex].color, borderColor: `${services[currentIndex].color}4d`, background: `${services[currentIndex].color}33` }">{{ services[currentIndex].badge }}</div>
          <h1 class="hero-title">{{ services[currentIndex].title }} <span class="text-highlight" :style="{ color: services[currentIndex].color }">{{ services[currentIndex].highlight }}</span></h1>
          <p class="hero-description">{{ services[currentIndex].description }}</p>
          
          <div class="info-details-container">
            <template v-if="services[currentIndex].id === 'wknd'">
              <div class="info-row"><span class="info-label">SCHEDULE</span> {{ services[currentIndex].schedule }}</div>
              <div class="info-row italic">{{ services[currentIndex].cta }}</div>
            </template>
            <template v-else>
              <div class="info-row" v-if="services[currentIndex].socials"><span class="info-label">SOCIALS</span> {{ services[currentIndex].socials }}</div>
              <div class="info-row" v-if="services[currentIndex].contact"><span class="info-label">CONTACT</span> {{ services[currentIndex].contact }}</div>
              <div class="info-row" v-if="services[currentIndex].email"><span class="info-label">EMAIL</span> {{ services[currentIndex].email }}</div>
            </template>
          </div>

          <div class="hero-footer-meta"><span class="location-tag">📍 BAGUIO</span><span class="dot"></span><span class="status-tag">Live Dashboard</span></div>
        </div>
      </Transition>
      <div class="hero-nav">
        <!-- Added .stop to prevent triggering openAbout when clicking dots -->
        <button v-for="(s, idx) in services" :key="s.id" @click.stop="setSlide(idx)" :class="['nav-dot', { active: currentIndex === idx }]" :style="currentIndex === idx ? { background: services[currentIndex].color } : {}"></button>
      </div>
    </div>

    <!-- AboutUs Component integration with initialFeature prop -->
    <AboutUs :isOpen="isAboutOpen" :initialFeature="targetFeature" @close="closeAbout" />
  </div>
</template>

<style scoped>
.hero-wrapper { padding: 24px 32px 0 32px; width: 100%; box-sizing: border-box; }
.elevate-hero-dark { position: relative; width: 100%; min-height: 380px; background-size: cover; background-position: center; border-radius: 24px; display: flex; align-items: center; padding: 40px; overflow: hidden; color: #fff; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #1e1e20; box-sizing: border-box; transition: background-image 1s ease-in-out; }
.clickable-section { cursor: pointer; transition: transform 0.3s ease, background-image 1s ease-in-out; }
.clickable-section:hover { transform: translateY(-2px); }
.hero-overlay { position: absolute; inset: 0; z-index: 1; transition: background 1s ease; }
.shimmer-container { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.shimmer { position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); animation: sweep 4s infinite; }
.hero-content { position: relative; z-index: 10; max-width: 100%; width: 100%; }
.brand-badge { display: inline-block; padding: 4px 10px; font-size: 9px; font-weight: 900; letter-spacing: 2.5px; border-radius: 4px; margin-bottom: 12px; transition: all 0.5s ease; border: 1px solid; backdrop-filter: blur(4px); }
.hero-title { font-size: clamp(24px, 5vw, 32px); font-weight: 800; letter-spacing: -0.5px; margin: 8px 0; line-height: 1.1; text-shadow: 0 2px 10px rgba(0,0,0,0.6); }
.text-highlight { transition: color 0.5s ease; }
.hero-description { font-size: clamp(14px, 2vw, 15px); color: #f4f4f5; line-height: 1.5; max-width: 480px; margin-top: 12px; text-shadow: 0 1px 5px rgba(0,0,0,0.6); }
.info-details-container { margin-top: 20px; display: flex; flex-direction: column; gap: 6px; }
.info-row { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 10px; }
.info-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; width: 70px; }
.italic { font-style: italic; color: rgba(255,255,255,0.7); font-size: 12px; }
.hero-footer-meta { margin-top: 24px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 10px; font-weight: 700; color: #d4d4d8; text-transform: uppercase; letter-spacing: 1px; }
.dot { width: 4px; height: 4px; background: #71717a; border-radius: 50%; }
.hero-visual-accents .circle { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; z-index: 2; pointer-events: none; transition: background 1s ease; }
.c1 { width: 250px; height: 250px; top: -10%; right: -5%; }
.c2 { width: 200px; height: 200px; bottom: -5%; right: 15%; }
.hero-nav { position: absolute; bottom: 25px; right: 40px; display: flex; gap: 10px; z-index: 20; }
.nav-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.2); border: none; cursor: pointer; transition: all 0.3s ease; padding: 0; }
.nav-dot.active { transform: scale(1.4); }
@keyframes sweep { 100% { left: 200%; } }
.hero-fade-enter-active, .hero-fade-leave-active { transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.hero-fade-enter-from { opacity: 0; transform: translateY(10px); }
.hero-fade-leave-to { opacity: 0; transform: translateY(-10px); }
@media (max-width: 1024px) { .hero-wrapper { padding: 20px 24px 0 24px; } .elevate-hero-dark { padding: 32px; min-height: 280px; } }
@media (max-width: 768px) { .hero-wrapper { padding: 16px 16px 0 16px; } .elevate-hero-dark { padding: 24px; border-radius: 20px; } .hero-nav { right: 50%; transform: translateX(50%); bottom: 20px; } }
@media (max-width: 480px) { .hero-wrapper { padding: 12px 12px 0 12px; } .elevate-hero-dark { padding: 20px; min-height: 300px; } }
</style>