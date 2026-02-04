<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { watch, ref } from 'vue'

const authStore = useAuthStore()
const router = useRouter()

// State to toggle the About page
const showAbout = ref(false)

function logout() {
    authStore.logout()
    router.push({ name: 'login' })
}

// If the admin approves the account while the user is logged in, redirect them
watch(() => authStore.userRole, (newRole) => {
    if (newRole === 'member') {
        router.push({ name: 'memberHome' })
    }
})
</script>

<template>
    <div class="approval-container">
        
        <!-- DEFAULT VIEW: Pending Message -->
        <div v-if="!showAbout" class="pending-view">
            <div class="card">
                <h2>Account Pending Approval</h2>
                <p>Please wait for the DGM head to approve your account. You will be notified once approved.</p>
                <p class="muted">You will not be able to access member features until your account is approved.</p>
                
                <div class="actions">
                    <button class="btn-about" @click="showAbout = true">
                        <span>About Us</span>
                        <span class="arrow">→</span>
                    </button>
                    <button class="btn-logout" @click="logout">Sign Out</button>
                </div>
            </div>
        </div>

        <!-- ABOUT VIEW: Long Page Design -->
        <div v-else class="about-view">
            <!-- Navigation Header -->
            <nav class="about-nav">
                <button class="nav-back" @click="showAbout = false">← Back to Status</button>
            </nav>

            <!-- SECTION 1: HERO (Crowd) -->
            <section class="hero-section" style="background-image: url('/northwest.jpg')">
                <div class="content-overlay">
                    <img src="/elevate word.PNG" alt="ELEVATE" class="hero-logo" />
                    <p class="hero-text">
                        ELEVATE is a nationwide student movement which aims to take students to the next <span class="highlight-red">LEVEL</span>. 
                        <br><br>
                        Our desire is for every student to experience a <span class="highlight-red">L</span>ife <span class="highlight-red">E</span>mpowered through <span class="highlight-red">V</span>alues, <span class="highlight-red">E</span>xcellence, and <span class="highlight-red">L</span>eadership!
                    </p>
                    <div class="scroll-indicator">↓</div>
                </div>
            </section>

            <!-- SECTION 2: VERSE (Bible) -->
            <section class="verse-section" style="background-image: url('/bible.jpg')">
                <div class="content-overlay dark-mode">
                    <blockquote class="bible-verse">
                        "Go therefore and make disciples of all the nations, baptizing them in the name of the Father and the Son and the Holy Spirit, teaching them to observe all that I commanded you; and lo, I am with you always, even to the end of the age."
                    </blockquote>
                    <cite class="citation-red">Matthew 28:19-20</cite>
                </div>
            </section>

            <!-- SECTION 3: LIFE CONNECTED (Hugs) -->
            <section class="info-section" style="background-image: url('/hugs.jpg')">
                <div class="content-overlay">
                    <h2 class="section-title">Life Connected</h2>
                    <p class="section-desc">
                        We’re a community of people, just like you meeting together each week to talk about life, God, and to pray for one another.
                    </p>
                </div>
            </section>

            <!-- SECTION 4: WHAT WE DO HEADER -->
            <div class="divider-header">
                <h2>WHAT WE DO</h2>
            </div>

            <!-- SECTION 5-7: WHAT WE DO COLUMNS (Merged) -->
            <section class="what-we-do-grid">
                <!-- Column 1: WKND -->
                <div class="feature-col" style="background-image: url('/elevate logo.jpg')">
                    <div class="col-overlay">
                        <h3 class="feature-title">ELEVATE WKND</h3>
                        <p class="feature-desc">
                            Unwind with us at our weekly gathering of high school and college students! At our youth services, listen to life-changing messages and find a community who cares for you.
                        </p>
                    </div>
                </div>

                <!-- Column 2: GROUPS -->
                <div class="feature-col" style="background-image: url('/group2.jpg')">
                    <div class="col-overlay">
                        <h3 class="feature-title">ELEVATE GROUPS</h3>
                        <p class="feature-desc">
                            Find a group of friends who you can laugh, learn, and be yourself with. Here, you can make new friends, find a mentor and grow deeper in your relationship with Jesus!
                        </p>
                    </div>
                </div>

                <!-- Column 3: UNITE -->
                <div class="feature-col" style="background-image: url('/unitesm.jpg')">
                    <div class="col-overlay">
                        <h3 class="feature-title">Campus UNITE</h3>
                        <p class="feature-desc">
                            Celebrates God’s faithfulness, marks the anniversary of the Elevate ministry, designed to unite students from various campuses, featuring worship, messages, and fellowship.
                        </p>
                    </div>
                </div>
            </section>

            <!-- SECTION 8: MISSION & VISION -->
            <section class="mission-vision-section">
                <div class="mv-container">
                    <div class="mv-card">
                        <h3>Our Mission</h3>
                        <p>To honor God and make Christ-committed students who will make Christ-committed students.</p>
                    </div>
                    <div class="mv-card">
                        <h3>Our Vision</h3>
                        <p>To see a movement of millions of Christ-committed students meeting in small groups; transforming lives, families, campuses, communities, and nations for the glory of God.</p>
                    </div>
                </div>
            </section>

            <!-- SECTION 9: FOOTER -->
            <section class="final-footer">
                <div class="footer-content">
                    <img src="/elevate word.PNG" alt="ELEVATE" class="footer-logo" />
                    <p class="footer-tagline">A nationwide student movement taking students to the next LEVEL.</p>
                    <div class="footer-divider-line"></div>
                    <p class="copyright">© 2026 ELEVATE. All rights reserved.</p>
                </div>
                <div class="footer-actions">
                    <button class="btn-logout-large" @click="logout">Sign Out</button>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
/* GENERAL LAYOUT */
.approval-container {
    width: 100%;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
}

/* PENDING VIEW STYLES */
.pending-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: #f8f9fa;
}

.card {
    background: white;
    padding: 32px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    max-width: 500px;
    width: 90%;
    text-align: center;
}

.card h2 {
    color: #1a1a1a;
    margin-bottom: 16px;
}

.card p {
    color: #4a4a4a;
    line-height: 1.6;
    margin-bottom: 12px;
}

.muted {
    color: #607D8B;
    font-size: 0.9rem;
    font-style: italic;
    margin-bottom: 24px;
}

.actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.btn-about {
    background: #D32F2F; 
    color: white;
    border: none;
    padding: 14px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s, background 0.2s;
}

.btn-about:hover {
    transform: translateY(-2px);
    background: #b71c1c;
}

.btn-logout {
    background: transparent;
    color: #D32F2F;
    border: 2px solid #ffebee;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
}

.btn-logout:hover {
    background: #ffebee;
}

/* ABOUT VIEW (LONG PAGE) STYLES */
.about-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: #000;
    overflow-y: auto;
    z-index: 100;
    scroll-behavior: smooth;
}

.about-nav {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1000;
}

.nav-back {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.3s;
}

.nav-back:hover {
    background: rgba(0, 0, 0, 0.9);
}

/* SECTIONS COMMON */
section {
    min-height: 100vh;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.content-overlay {
    background: rgba(0, 0, 0, 0.6);
    padding: 40px;
    border-radius: 0;
    width: 100%;
    height: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: white;
}

/* HERO UPDATES */
.hero-logo {
    max-width: 600px; 
    width: 90%;
    margin-bottom: 30px;
}

.hero-text {
    font-size: 1.5rem;
    max-width: 800px;
    line-height: 1.8;
}

.highlight-red {
    color: #D32F2F; 
    font-weight: 800;
}

.scroll-indicator {
    margin-top: 40px;
    font-size: 2.5rem;
    color: rgba(255, 255, 255, 0.7);
    animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

/* BIBLE VERSE */
.bible-verse {
    font-size: 1.5rem;
    font-style: italic;
    max-width: 800px;
    margin-bottom: 20px;
    line-height: 1.8;
}

.citation-red {
    font-weight: bold;
    font-size: 1.2rem;
    color: #D32F2F; 
}

/* TITLES AND TEXT */
.section-title, .feature-title {
    font-size: 3rem;
    font-weight: 800;
    margin-bottom: 20px;
    text-transform: uppercase;
}

.section-desc, .feature-desc {
    font-size: 1.2rem;
    max-width: 600px;
    line-height: 1.6;
}

/* WHAT WE DO GRID LAYOUT */
.what-we-do-grid {
    display: flex;
    flex-direction: row; 
    min-height: 10vh; 
    width: 100%;
    background: #000;
}

.feature-col {
    flex: 1;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    transition: flex-grow 0.3s ease;
    border-right: 1px solid rgba(255,255,255,0.1);
}

.feature-col:last-child {
    border-right: none;
}

.feature-col:hover {
    flex-grow: 1.2; 
}

.col-overlay {
    background: rgba(0, 0, 0, 0.7); 
    padding: 30px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    opacity: 0.8;
    transition: opacity 0.3s;
    color: white;
}

.feature-col:hover .col-overlay {
    opacity: 1;
    background: rgba(0, 0, 0, 0.6);
}

.feature-col .feature-title {
    font-size: 2rem;
}

.feature-col .feature-desc {
    font-size: 1rem;
    max-width: 90%;
}


/* DARK SECTIONS (DIVIDER & MISSION) */
.divider-header {
    background: #000;
    color: white;
    padding: 80px 20px;
    text-align: center;
    min-height: auto;
    height: auto;
}

.divider-header h2 {
    font-size: 3rem;
    letter-spacing: 4px;
    color: #D32F2F;
}

.mission-vision-section {
    min-height: auto;
    background: #111;
    padding: 100px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.mv-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 40px;
    max-width: 1000px;
    width: 100%;
}

.mv-card {
    flex: 1;
    min-width: 300px;
    background: #222; 
    padding: 40px;
    border-radius: 12px;
    border: 1px solid #333;
    text-align: center;
}

.mv-card h3 {
    color: #D32F2F;
    font-size: 1.5rem;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.mv-card p {
    color: #e0e0e0; 
    font-size: 1.1rem;
    line-height: 1.6;
}

/* FOOTER SECTION */
.final-footer {
    background: #000;
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
}

.footer-content {
    margin-bottom: 40px;
}

.footer-logo {
    width: 150px;
    margin-bottom: 24px;
}

.footer-tagline {
    color: #ccc;
    font-size: 1.1rem;
    margin-bottom: 20px;
}

.footer-divider-line {
    width: 60px;
    height: 1px;
    background-color: #444;
    margin: 20px auto;
}

.copyright {
    color: #666;
    font-size: 0.9rem;
}

.btn-logout-large {
    background: #222;
    color: white;
    padding: 16px 48px;
    border: 1px solid #444;
    font-size: 1rem;
    border-radius: 30px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.3s, border-color 0.3s;
}

.btn-logout-large:hover {
    background: #D32F2F;
    border-color: #D32F2F;
}

/* RESPONSIVE */
@media (max-width: 768px) {
    .section-title { font-size: 2rem; }
    .bible-verse { font-size: 1.1rem; }
    .content-overlay { padding: 20px; }
    
    /* Stack columns on mobile */
    .what-we-do-grid {
        flex-direction: column;
        min-height: auto;
    }
    .feature-col {
        min-height: 50vh;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.1);
    }
}
</style>