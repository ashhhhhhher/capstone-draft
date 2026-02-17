<script setup>
import { defineProps, defineEmits, ref } from 'vue'
const props = defineProps({ isOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close'])
const scrollContainer = ref(null)
function handleClose() { emit('close') }
function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <transition name="slide-up">
    <div v-if="isOpen" class="about-view-overlay">
      <nav class="about-internal-nav">
        <button class="nav-back-circle" @click="handleClose" title="Go Back">←</button>
        <div class="nav-links">
          <button @click="scrollToSection('hero')">Home</button>
          <button @click="scrollToSection('mission-vision')">Mission & Vision</button>
          <button @click="scrollToSection('whatwedo')">What We Do</button>
        </div>
      </nav>
      
      <div class="about-scroll-container" ref="scrollContainer">
        <section id="hero" class="hero-section" style="background-image: url('/northwest.jpg')">
          <div class="content-overlay">
            <img src="/elevate word.PNG" alt="ELEVATE" class="hero-logo" />
            <p class="hero-text">ELEVATE is a nationwide student movement which aims to take students to the next <span class="highlight-red">LEVEL</span>.<br><br>Our desire is for every student to experience a <span class="highlight-red">L</span>ife <span class="highlight-red">E</span>mpowered through <span class="highlight-red">V</span>alues, <span class="highlight-red">E</span>xcellence, and <span class="highlight-red">L</span>eadership!</p>
            <div class="scroll-indicator" @click="scrollToSection('mission-vision')">↓</div>
          </div>
        </section>

        <section id="mission-vision" class="mission-vision-section">
          <div class="mv-container">
            <div class="mv-card"><h3>Our Mission</h3><p>To honor God and make Christ-committed students who will make Christ-committed students.</p></div>
            <div class="mv-card"><h3>Our Vision</h3><p>To see a movement of millions of Christ-committed students transforming lives and nations.</p></div>
          </div>
        </section>

        <section class="verse-section" style="background-image: url('/bible.jpg')">
          <div class="content-overlay dark-mode"><blockquote class="bible-verse">"Go therefore and make disciples of all the nations, baptizing them in the name of the Father and the Son and the Holy Spirit..."</blockquote><cite class="citation-red">Matthew 28:19-20</cite></div>
        </section>

        <section class="info-section" style="background-image: url('/hugs.jpg')">
          <div class="content-overlay"><h2 class="section-title">Life Connected</h2><p class="section-desc">We’re a community of people, just like you meeting together each week to talk about life, God, and to pray for one another.</p></div>
        </section>

        <div id="whatwedo" class="divider-header"><h2>WHAT WE DO</h2></div>

        <section class="what-we-do-grid">
          <div class="feature-col" style="background-image: url('/elevate logo.jpg')"><div class="col-overlay"><h3 class="feature-title">ELEVATE WKND</h3><p class="feature-desc">Unwind with us at our weekly gathering of high school and college students!</p></div></div>
          <div class="feature-col" style="background-image: url('/group2.jpg')"><div class="col-overlay"><h3 class="feature-title">DISCIPLESHIP GROUPS</h3><p class="feature-desc">Find a group of friends who you can laugh, learn, and be yourself with.</p></div></div>
          <div class="feature-col" style="background-image: url('/unitesm.jpg')"><div class="col-overlay"><h3 class="feature-title">Campus UNITE</h3><p class="feature-desc">Celebrates God’s faithfulness and marks the anniversary of the Elevate ministry.</p></div></div>
        </section>

        <section class="final-footer">
          <div class="footer-content"><img src="/elevate word.PNG" alt="ELEVATE" class="footer-logo" /><p class="footer-tagline">A nationwide student movement taking students to the next LEVEL.</p><p class="copyright">© 2026 ELEVATE. All rights reserved.</p></div>
          <button class="btn-close-large" @click="handleClose">Back to Dashboard</button>
        </section>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.about-view-overlay { position: fixed; inset: 0; background: #000; z-index: 3000; overflow: hidden; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; }
.about-scroll-container { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
.about-internal-nav { position: absolute; top: 0; left: 0; right: 0; z-index: 3100; height: 70px; display: flex; align-items: center; padding: 0 30px; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.1); justify-content: space-between; }
.nav-back-circle { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.3s; }
.nav-back-circle:hover { background: #D32F2F; border-color: #D32F2F; }
.nav-links { display: flex; gap: 20px; }
.nav-links button { background: none; border: none; color: rgba(255,255,255,0.7); font-weight: 600; cursor: pointer; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; }
.nav-links button:hover { color: #D32F2F; }
.hero-section, .verse-section, .info-section { min-height: 100vh; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; position: relative; }
.content-overlay { background: rgba(0,0,0,0.6); padding: 40px; text-align: center; color: white; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.hero-logo { max-width: 500px; width: 80%; margin-bottom: 20px; }
.hero-text { font-size: 1.3rem; max-width: 800px; line-height: 1.6; }
.highlight-red { color: #D32F2F; font-weight: 800; }
.bible-verse { font-size: 1.5rem; font-style: italic; max-width: 800px; margin-bottom: 20px; }
.citation-red { color: #D32F2F; font-weight: bold; font-size: 1.2rem; }
.section-title { font-size: 3rem; color: #D32F2F; margin-bottom: 15px; text-transform: uppercase; }
.divider-header { background: #000; padding: 60px 20px; text-align: center; color: #D32F2F; }
.divider-header h2 { font-size: 2.5rem; letter-spacing: 4px; }
.what-we-do-grid { display: flex; flex-wrap: wrap; background: #000; width: 100%; }
.feature-col { flex: 1; min-width: 300px; min-height: 500px; background-size: cover; background-position: center; position: relative; transition: flex-grow 0.3s; border-right: 1px solid rgba(255,255,255,0.05); }
.feature-col:hover { flex-grow: 1.2; }
.col-overlay { background: rgba(0,0,0,0.7); inset: 0; position: absolute; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 30px; color: white; text-align: center; opacity: 0.9; transition: opacity 0.3s; }
.feature-col:hover .col-overlay { opacity: 1; background: rgba(0,0,0,0.5); }
.feature-title { font-size: 2rem; margin-bottom: 10px; }
.mission-vision-section { background: #111; padding: 120px 20px; color: white; text-align: center; border-bottom: 1px solid #222; }
.mv-container { display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; max-width: 1000px; margin: 0 auto; }
.mv-card { background: #1a1a1a; padding: 50px 40px; border-radius: 16px; flex: 1; min-width: 300px; border: 1px solid #333; transition: 0.3s; }
.mv-card:hover { border-color: #D32F2F; transform: translateY(-5px); }
.mv-card h3 { color: #D32F2F; margin-bottom: 15px; text-transform: uppercase; font-size: 1.5rem; }
.final-footer { background: #000; padding: 80px 20px; text-align: center; color: white; }
.footer-logo { max-width: 200px; margin-bottom: 20px; }
.btn-close-large { background: #222; color: white; padding: 14px 40px; border: 1px solid #444; border-radius: 30px; cursor: pointer; margin-top: 30px; transition: 0.3s; font-weight: 600; }
.btn-close-large:hover { background: #D32F2F; border-color: #D32F2F; }
.scroll-indicator { margin-top: 30px; font-size: 2rem; animation: bounce 2s infinite; color: rgba(255,255,255,0.5); cursor: pointer; }
@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.4s ease, opacity 0.4s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>