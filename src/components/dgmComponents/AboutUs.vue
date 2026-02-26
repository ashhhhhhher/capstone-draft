<script setup>
import { ref } from 'vue'

const props = defineProps({ isOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const scrollContainer = ref(null)
const selectedFeature = ref(null)

const features = {
  wknd: { title: 'ELEVATE WKND', desc: 'Unwind with us at our every other week gatherings!', longDesc: 'Our youth gathering! A service designed for high school, college students and singles to experience awesome worship, meet new friends, and hear life-changing messages.', info: 'Hotel Supreme | 5:00PM onwards', img: '/elevate logo.jpg' },
  groups: { title: 'DISCIPLESHIP GROUPS', desc: 'Find a group of friends you can grow with.', longDesc: 'Join a Dgroup! A Dgroup is a small group of students who meet to talk about life, study the Bible, and support one another. Where "big" services become "personal" friendships. No matter where you are in your journey.', info: 'Join by simply going to the Dgroup section and clicking on the "Find a Dgroup" button', img: '/group2.jpg' },
  unite: { title: 'Campus UNITE', desc: 'Celebrating God’s faithfulness and ministry anniversary.', longDesc: 'Campus Unite is the massive annual anniversary celebration of Elevate! It brings together students from different campuses for a night of worship, powerful testimonies, and a shared vision to transform our nation. Our biggest event of the year with a purpose that lasts.', info: 'Happens around June - August', img: '/unitesm.jpg' }
}

function handleClose() { emit('close') }
function scrollToSection(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }) }
function openFeature(key) { selectedFeature.value = features[key] }
function closeFeature() { selectedFeature.value = null }
</script>

<template>
  <transition name="slide-up">
    <div v-if="isOpen" class="about-view-overlay">
      <transition name="fade">
        <div v-if="selectedFeature" class="feature-modal-backdrop" @click.self="closeFeature">
          <div class="feature-modal-content">
            <button class="modal-close" @click="closeFeature">✕</button>
            <div class="modal-scroll-area">
              <div class="modal-body">
                <h2 class="highlight-red">{{ selectedFeature.title }}</h2>
                <div class="modal-divider"></div>
                <p class="modal-long-desc">{{ selectedFeature.longDesc }}</p>
                <div class="modal-info-box"><p><strong>DETAILS:</strong> {{ selectedFeature.info }}</p></div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <nav class="about-internal-nav">
        <button class="nav-back-circle" @click="handleClose">←</button>
        <div class="nav-links">
          <button @click="scrollToSection('hero')">Home</button>
          <button @click="scrollToSection('mission-vision')">Mission</button>
          <button @click="scrollToSection('whatwedo')">Programs</button>
          <button @click="scrollToSection('contact')">Contact</button>
        </div>
      </nav>
      
      <div class="about-scroll-container" ref="scrollContainer">
        <section id="hero" class="hero-section" style="background-image: url('/northwest.jpg')">
          <div class="content-overlay dark-grad">
            <img src="/elevate word.PNG" alt="ELEVATE" class="hero-logo" />
            <p class="hero-text">Taking students to the next <span class="highlight-red">LEVEL</span> through <br><span class="white-box-text">Values, Excellence, and Leadership.</span></p>
            <div class="scroll-indicator" @click="scrollToSection('mission-vision')">↓</div>
          </div>
        </section>

        <section id="mission-vision" class="mission-vision-section">
          <div class="mv-container">
            <div class="mv-card white-theme">
              <div class="mv-inner">
                <h3>Our Mission</h3>
                <p>To honor God and make Christ-committed students who will make Christ-committed students.</p>
                <div class="mv-hover-accent"></div>
              </div>
            </div>
            <div class="mv-card white-theme">
              <div class="mv-inner">
                <h3>Our Vision</h3>
                <p>To see a movement of millions of Christ-committed students transforming lives and nations.</p>
                <div class="mv-hover-accent"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="verse-section" style="background-image: url('/bible.jpg')">
          <div class="content-overlay black-tint"><blockquote class="bible-verse">"Go therefore and make disciples of all the nations..."</blockquote><cite class="citation-red">— Matthew 28:19-20</cite></div>
        </section>

        <section class="info-section white-bg">
          <div class="info-content"><h2 class="section-title">Life Connected</h2><p class="section-desc">A community of people meeting together each week to talk about life, God, and to pray for one another.</p></div>
        </section>

        <div id="whatwedo" class="divider-header"><h2>WHAT WE DO</h2><span class="red-line"></span></div>

        <section class="what-we-do-grid">
          <div v-for="(f, k) in features" :key="k" class="feature-col" :style="{ backgroundImage: `url('${f.img}')` }" @click="openFeature(k)">
            <div class="col-overlay-static"><h3 class="feature-title">{{ f.title }}</h3><p class="feature-desc">{{ f.desc }}</p></div>
            <div class="col-overlay-hover"><span class="view-btn">View Details</span></div>
          </div>
        </section>

        <section id="contact" class="contact-section">
          <div class="contact-container">
            <h2 class="section-title white-text">Contact Us</h2>
            <div class="contact-grid">
              <div class="contact-card"><h4>EMAIL</h4><p>elevatebaguio00@gmail.com</p></div>
              <div class="contact-card"><h4>SOCIALS</h4><p>@ElevateBaguioPH</p></div>
              <div class="contact-card"><h4>CONTACT</h4><p>0917 657 3341</p></div>
            </div>
          </div>
        </section>

        <section class="final-footer">
          <img src="/elevate word.PNG" alt="ELEVATE" class="footer-logo" />
          <p class="footer-tagline">© 2026 ELEVATE. Nationwide Student Movement.</p>
          <button class="btn-close-large" @click="handleClose">Return to Dashboard</button>
        </section>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.about-view-overlay { position: fixed; inset: 0; background: #0a0a0a; z-index: 3000; overflow: hidden; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; color: #fff; }
.about-scroll-container { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
.about-internal-nav { position: absolute; top: 0; left: 0; right: 0; z-index: 3100; height: 80px; display: flex; align-items: center; padding: 0 5%; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); justify-content: space-between; }
.nav-back-circle { width: 45px; height: 45px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; cursor: pointer; backdrop-filter: blur(5px); transition: 0.3s; display: flex; align-items: center; justify-content: center; }
.nav-back-circle:hover { background: #D32F2F; border-color: #D32F2F; transform: scale(1.1); }
.nav-links { display: flex; gap: 25px; }
.nav-links button { background: none; border: none; color: #aaa; font-weight: 700; cursor: pointer; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
.nav-links button:hover { color: #fff; }
.hero-section, .verse-section { min-height: 100vh; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
.dark-grad { background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.9)); padding: 40px; text-align: center; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.black-tint { background: rgba(0,0,0,0.7); width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; }
.hero-logo { max-width: 450px; width: 80%; margin-bottom: 30px; }
.hero-text { font-size: 1.4rem; max-width: 800px; line-height: 1.8; color: #ddd; }
.highlight-red { color: #D32F2F; }
.white-box-text { background: #fff; color: #000; padding: 2px 10px; font-weight: 900; margin-top: 10px; display: inline-block; }
.bible-verse { font-size: 1.8rem; font-style: italic; max-width: 800px; margin-bottom: 20px; font-weight: 300; text-align: center; }
.citation-red { color: #D32F2F; font-weight: 800; font-size: 1.2rem; }
.info-section.white-bg { background: #fff; color: #000; padding: 120px 20px; text-align: center; }
.section-title { font-size: 3rem; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; margin-bottom: 20px; }
.section-title.white-text { color: #fff; }
.divider-header { background: #0a0a0a; padding: 100px 20px 40px; text-align: center; }
.divider-header h2 { font-size: 2.5rem; font-weight: 900; color: #fff; }
.red-line { display: block; width: 60px; height: 4px; background: #D32F2F; margin: 20px auto; }
.what-we-do-grid { display: flex; flex-wrap: wrap; background: #000; }
.feature-col { flex: 1; min-width: 300px; min-height: 550px; background-size: cover; background-position: center; position: relative; cursor: pointer; transition: 0.5s cubic-bezier(0.2, 1, 0.3, 1); overflow: hidden; }
.feature-col:hover { flex-grow: 1.3; }
.col-overlay-static { inset: 0; position: absolute; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); display: flex; flex-direction: column; justify-content: flex-end; padding: 50px 30px; transition: 0.4s; z-index: 1; }
.col-overlay-hover { inset: 0; position: absolute; background: rgba(211, 47, 47, 0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: 0.4s; z-index: 2; }
.feature-col:hover .col-overlay-hover { opacity: 1; }
.feature-title { font-size: 1.8rem; font-weight: 900; color: #fff; margin-bottom: 5px; }
.view-btn { border: 2px solid #fff; padding: 12px 30px; font-size: 0.8rem; text-transform: uppercase; font-weight: 800; color: #fff; transition: 0.3s; }
.view-btn:hover { background: #fff; color: #D32F2F; }
.mission-vision-section { background: #0f0f0f; padding: 120px 5%; overflow: hidden; }
.mv-container { display: flex; flex-wrap: wrap; gap: 40px; max-width: 1200px; margin: 0 auto; perspective: 1000px; }
.mv-card { flex: 1; min-width: 300px; position: relative; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.mv-card.white-theme { background: #fff; color: #000; border-radius: 12px; border: 1px solid #eee; overflow: hidden; cursor: default; }
.mv-inner { padding: 80px 40px; position: relative; z-index: 2; transition: 0.5s; text-align: center; }
.mv-hover-accent { position: absolute; bottom: 0; left: 0; width: 100%; height: 0; background: #D32F2F; transition: 0.5s ease; z-index: -1; opacity: 0.05; }
.mv-card:hover { transform: translateY(-20px) rotateX(5deg); box-shadow: 0 30px 60px rgba(0,0,0,0.4), 0 0 20px rgba(211, 47, 47, 0.2); border-color: #D32F2F; }
.mv-card:hover .mv-hover-accent { height: 100%; opacity: 0.1; }
.mv-card:hover h3 { transform: scale(1.1); }
.mv-card h3 { color: #D32F2F; font-weight: 900; font-size: 2.2rem; margin-bottom: 25px; transition: 0.5s; text-transform: uppercase; }
.mv-card p { font-size: 1.1rem; line-height: 1.6; transition: 0.5s; }
.contact-section { background: #0a0a0a; padding: 120px 5%; border-top: 1px solid #222; }
.contact-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 50px; }
.contact-card { background: #151515; padding: 40px; border: 1px solid #222; flex: 1; min-width: 250px; text-align: center; border-radius: 8px; }
.contact-card h4 { color: #D32F2F; margin-bottom: 10px; font-weight: 800; letter-spacing: 2px; }
.final-footer { background: #000; padding: 80px 20px; text-align: center; border-top: 1px solid #111; }
.footer-logo { max-width: 150px; margin-bottom: 20px; opacity: 0.8; }
.btn-close-large { background: transparent; color: #fff; padding: 15px 40px; border: 1px solid #D32F2F; cursor: pointer; margin-top: 40px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
.btn-close-large:hover { background: #D32F2F; }
.feature-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); z-index: 4000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.feature-modal-content { background: #111; width: 100%; max-width: 700px; max-height: 85vh; border: 1px solid #333; position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; }
.modal-scroll-area { overflow-y: auto; padding: 60px 40px; }
.modal-close { position: absolute; top: 20px; right: 20px; background: none; border: none; color: #666; font-size: 1.5rem; cursor: pointer; z-index: 10; transition: 0.2s; }
.modal-close:hover { color: #D32F2F; }
.modal-divider { width: 40px; height: 3px; background: #D32F2F; margin: 15px auto 30px; }
.modal-long-desc { font-size: 1.1rem; line-height: 1.8; color: #bbb; text-align: center; }
.modal-info-box { background: #000; padding: 25px; margin-top: 40px; border-left: 3px solid #D32F2F; }
.scroll-indicator { margin-top: 40px; font-size: 2rem; animation: bounce 2s infinite; color: #D32F2F; cursor: pointer; }
@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 768px) { .section-title { font-size: 2.2rem; } .hero-text { font-size: 1.1rem; } .modal-scroll-area { padding: 40px 20px; } .feature-col { min-height: 400px; } .mv-card:hover { transform: translateY(-10px); } }
</style>