<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  initialFeature: { type: String, default: null }
})
const emit = defineEmits(['close'])

const scrollContainer = ref(null)
const selectedFeature = ref(null)

const features = {
  unite: { 
    title: 'Campus UNITE', 
    desc: 'Celebrating God’s faithfulness and ministry anniversary.', 
    longDesc: 'Our annual anniversary isn\'t just an event; it\s a movement. Once a year, students from across the country converge to celebrate what God is doing on our campuses. It\’s a dedicated night for collective worship and hearing the stories of lives changed, all centered around a singular mission: to see our nation transformed through the next generation.', 
    info: 'Happens around June - August, 2026', 
    img: '/unitesm.jpg',
    gallery: ['/unite1.jpg', '/unite2.jpg', '/unite3.jpg', '/unite4.jpg', '/unite5.jpg', '/unite6.jpg']
  },
  groups: { 
    title: 'DISCIPLESHIP GROUPS', 
    desc: 'Find a group of friends you can grow with.', 
    longDesc: 'Life is better when you don\'t have to navigate it alone. Dgroups are small circles of students who meet to share life, explore the Bible, and build the kind of friendships that make a big campus feel like home. Whether you\'re just starting your spiritual journey or looking for deep community, there\’s a place for you here.', 
    info: 'How to join: Head to the Dgroup section upon log in and tap Find a Dgroup to get started.', 
    img: '/group2.jpg',
    gallery: ['/dgroup1.jpg', '/dgroup2.jpg', '/dgroup3.jpg', '/dgroup4.jpg', '/dgroup5.jpg']
  },
  wknd: { 
    title: 'ELEVATE WKND', 
    desc: 'Unwind with us at our every other week gatherings!', 
    longDesc: 'Our youth gathering is a space crafted specifically for high schoolers, college students, and young professionals. It\’s more than just a service; it\’s a weekly opportunity to recharge through high-energy worship, find community with people in your same stage of life, and engage with messages that actually speak to your day-to-day.', 
    info: 'Hotel Supreme | 5:00PM onwards | Every other Saturday | 2026', 
    img: '/elevate logo.jpg',
    gallery: ['/wknd1.jpg', '/wknd2.jpg', '/wknd3.jpg', '/wknd4.jpg']
  }
}

// Logic to auto-open feature when prop changes or component opens
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.initialFeature && features[props.initialFeature]) {
    selectedFeature.value = features[props.initialFeature];
  }
});

function handleClose() { emit('close'); selectedFeature.value = null; }
function scrollToSection(id) { 
  const el = document.getElementById(id); 
  if (el) el.scrollIntoView({ behavior: 'smooth' }) 
}
function openFeature(key) { selectedFeature.value = features[key] }
function closeFeature() { selectedFeature.value = null }
</script>

<template>
  <transition name="slide-up">
    <div v-if="isOpen" class="about-view-overlay">
      <transition name="fade">
        <div v-if="selectedFeature" class="feature-modal-backdrop" @click.self="closeFeature">
          <div class="feature-modal-content premium-layout">
            <button class="modal-close-circle" @click="closeFeature">✕</button>
            <div class="modal-flex-container">
              <div class="modal-visual-pane">
                <div class="gallery-label"><span class="red-dash"></span> EXPERIENCE THE MOVEMENT</div>
                <div class="modal-gallery-wrapper custom-scrollbar">
                  <div v-for="(photo, index) in selectedFeature.gallery" :key="index" class="gallery-card-large">
                    <img :src="photo" alt="Gallery Image" />
                    <div class="card-number">0{{ index + 1 }}</div>
                  </div>
                </div>
                <div class="gallery-footer-info">
                  <div class="scroll-dots"><span class="dot active"></span><span class="dot"></span><span class="dot"></span></div>
                  <span class="hint-text">Scroll or Swipe to explore →</span>
                </div>
              </div>
              <div class="modal-info-pane">
                <div class="header-stack">
                  <h2 class="title-main">{{ selectedFeature.title.split(' ')[0] }}</h2>
                  <h2 class="title-sub">{{ selectedFeature.title.split(' ').slice(1).join(' ') }}</h2>
                  <div class="title-accent"></div>
                </div>
                <div class="scrollable-body-text custom-scrollbar">
                  <p class="premium-desc">{{ selectedFeature.longDesc }}</p>
                  <div class="premium-info-card">
                    <div class="icon-wrap">📍</div>
                    <div class="text-wrap"><span class="label">LOCATION & TIME</span><p>{{ selectedFeature.info }}</p></div>
                  </div>
                </div>
                <button class="btn-cta-red" @click="closeFeature">CLOSE PREVIEW</button>
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
          <div class="content-overlay black-tint">
            <blockquote class="bible-verse">"Go therefore and make disciples of all the nations..."</blockquote>
            <cite class="citation-red">— Matthew 28:19-20</cite>
          </div>
        </section>

        <section class="info-section white-bg">
          <div class="info-content">
            <h2 class="section-title">Life Connected</h2>
            <p class="section-desc">A community of people meeting together each week to talk about life, God, and to pray for one another.</p>
          </div>
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
.custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #D32F2F; border-radius: 10px; }
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
.what-we-do-grid { display: flex; flex-wrap: wrap; background: #000; width: 100%; }
.feature-col { flex: 1; min-width: 33.333%; min-height: 550px; background-size: cover; background-position: center; position: relative; cursor: pointer; transition: 0.5s cubic-bezier(0.2, 1, 0.3, 1); overflow: hidden; }
.feature-col:hover { flex-grow: 1.2; }
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
.mv-card h3 { color: #D32F2F; font-weight: 900; font-size: 2.2rem; margin-bottom: 25px; transition: 0.5s; text-transform: uppercase; }
.mv-card p { font-size: 1.1rem; line-height: 1.6; transition: 0.5s; }
.feature-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); z-index: 4000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.feature-modal-content.premium-layout { background: #fff; width: 100%; max-width: 1200px; height: 85vh; border-radius: 40px; overflow: hidden; position: relative; color: #000; box-shadow: 0 50px 100px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
.modal-close-circle { position: absolute; top: 30px; right: 30px; width: 50px; height: 50px; background: #fff; border: 1px solid #eee; border-radius: 50%; color: #000; font-size: 1.2rem; cursor: pointer; z-index: 50; transition: 0.3s; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
.modal-close-circle:hover { background: #D32F2F; color: #fff; transform: rotate(90deg); border-color: #D32F2F; }
.modal-flex-container { display: flex; height: 100%; width: 100%; flex-direction: row; overflow: hidden; }
.modal-visual-pane { flex: 1.5; background: #f9f9f9; padding: 60px; display: flex; flex-direction: column; border-right: 1px solid #eee; overflow: hidden; min-width: 0; }
.gallery-label { font-size: 11px; font-weight: 900; color: #D32F2F; letter-spacing: 4px; display: flex; align-items: center; gap: 15px; margin-bottom: 40px; flex-shrink: 0; }
.red-dash { width: 40px; height: 2px; background: #D32F2F; }
.modal-gallery-wrapper { flex: 1; display: flex; gap: 30px; overflow-x: auto; padding: 10px 0 30px; snap-type: x mandatory; }
.gallery-card-large { min-width: 450px; height: 100%; position: relative; border-radius: 30px; overflow: hidden; snap-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.15); transition: 0.5s; flex-shrink: 0; }
.gallery-card-large img { width: 100%; height: 100%; object-fit: cover; transition: 0.8s; }
.gallery-card-large:hover img { transform: scale(1.1); }
.card-number { position: absolute; top: 30px; left: 30px; background: #D32F2F; color: #fff; padding: 8px 15px; border-radius: 12px; font-weight: 900; font-size: 14px; box-shadow: 0 10px 20px rgba(211,47,47,0.3); }
.gallery-footer-info { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-shrink: 0; }
.scroll-dots { display: flex; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #ddd; }
.dot.active { width: 30px; border-radius: 10px; background: #D32F2F; }
.hint-text { font-size: 10px; font-weight: 800; color: #bbb; text-transform: uppercase; letter-spacing: 2px; }
.modal-info-pane { flex: 1; padding: 60px; display: flex; flex-direction: column; justify-content: flex-start; min-width: 0; overflow: hidden; }
.header-stack { margin-bottom: 30px; flex-shrink: 0; }
.title-main { font-size: 3.5rem; font-weight: 900; line-height: 0.9; text-transform: uppercase; }
.title-sub { font-size: 3.5rem; font-weight: 900; line-height: 0.9; color: #D32F2F; text-transform: uppercase; margin-top: 5px; }
.title-accent { width: 60px; height: 8px; background: #000; margin-top: 20px; border-radius: 4px; }
.scrollable-body-text { flex: 1; overflow-y: auto; padding-right: 15px; margin-bottom: 30px; }
.premium-desc { font-size: 1.15rem; line-height: 1.7; color: #666; font-weight: 500; margin-bottom: 30px; }
.premium-info-card { background: #fcfcfc; border: 1px solid #eee; padding: 25px; border-radius: 20px; display: flex; gap: 20px; align-items: center; }
.icon-wrap { font-size: 1.5rem; width: 50px; height: 50px; background: #fff0f0; display: flex; align-items: center; justify-content: center; border-radius: 15px; flex-shrink: 0; }
.text-wrap .label { display: block; font-size: 10px; font-weight: 900; color: #D32F2F; letter-spacing: 2px; margin-bottom: 5px; }
.text-wrap p { font-size: 1rem; font-weight: 700; color: #333; }
.btn-cta-red { width: 100%; padding: 22px; background: #D32F2F; color: #fff; border: none; border-radius: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; cursor: pointer; transition: 0.3s; box-shadow: 0 20px 40px rgba(211,47,47,0.2); flex-shrink: 0; margin-top: auto; }
.btn-cta-red:hover { background: #000; transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.contact-section { background: #0a0a0a; padding: 120px 5%; border-top: 1px solid #222; }
.contact-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 50px; }
.contact-card { background: #151515; padding: 40px; border: 1px solid #222; flex: 1; min-width: 250px; text-align: center; border-radius: 8px; }
.contact-card h4 { color: #D32F2F; margin-bottom: 10px; font-weight: 800; letter-spacing: 2px; }
.final-footer { background: #000; padding: 80px 20px; text-align: center; border-top: 1px solid #111; }
.footer-logo { max-width: 150px; margin-bottom: 20px; opacity: 0.8; }
.btn-close-large { background: transparent; color: #fff; padding: 15px 40px; border: 1px solid #D32F2F; cursor: pointer; margin-top: 40px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
.btn-close-large:hover { background: #D32F2F; }
@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 1024px) { .modal-flex-container { flex-direction: column; overflow-y: auto; } .modal-visual-pane { flex: none; height: 50vh; padding: 30px; border-right: none; border-bottom: 1px solid #eee; } .modal-info-pane { flex: none; padding: 40px 30px; overflow: visible; } .gallery-card-large { min-width: 300px; } .title-main, .title-sub { font-size: 2.5rem; } .feature-modal-content.premium-layout { height: 95vh; border-radius: 20px; } }
@media (min-width: 1025px) { .feature-col { min-width: 33.333%; } .modal-info-pane { max-height: 100%; } }
</style>