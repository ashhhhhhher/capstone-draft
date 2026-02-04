<script setup>
import { BookOpen, Users, Heart, Star, CheckCircle } from 'lucide-vue-next'

const expectations = [
  { 
    title: 'Weekly Gathering', 
    desc: 'Expect regular time to meet, share life, and study God\'s word together with your group.',
    icon: Users,
    img: 'https://images.unsplash.com/photo-1529070532901-ba8c3009f71c?auto=format&fit=crop&w=400&q=80'
  },
  { 
    title: 'Safe Community', 
    desc: 'A place of confidentiality and grace where you can be your authentic self.',
    icon: Heart,
    img: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80'
  },
  { 
    title: 'Spiritual Growth', 
    desc: 'Intentional discipleship focused on following Jesus and making Him known through Bible reading.',
    icon: BookOpen,
    img: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=400&q=80'
  }
]
</script>

<template>
  <div class="overview-container">
    <div class="header-section">
      <Star :size="32" class="star-icon" />
      <h2>What is a Dgroup?</h2>
      <p>A Dgroup, short for discipleship group, is a small group of people that meet regularly,
share their lives with each other, study the Bible together, and are accountable to each
other, all in the pursuit of being more Christ-like.</p>
    </div>

    <div class="expectations-grid">
      <div v-for="item in expectations" :key="item.title" class="expect-card">
        <div class="card-img-wrapper">
          <img :src="item.img" :alt="item.title" class="card-img" @error="(e) => e.target.src = 'https://via.placeholder.com/300x150'" />
          <div class="icon-badge"><component :is="item.icon" :size="20" /></div>
        </div>
        <div class="card-body">
          <h4>{{ item.title }}</h4>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>

    <div class="commitment-footer">
      <CheckCircle :size="18" />
      <span>No perfect people allowed. Just a journey together.</span>
    </div>
  </div>
</template>

<style scoped>
.overview-container { padding: 40px 20px; max-width: 1000px; margin: 0 auto; }
.header-section { text-align: center; margin-bottom: 40px; }
.header-section h2 { color: #1976D2; font-size: 28px; margin: 12px 0; }
.header-section p { color: #546E7A; font-size: 16px; max-width: 600px; margin: 0 auto; }
.star-icon { color: #FBC02D; }
.expectations-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.expect-card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #ECEFF1; display: flex; flex-direction: column; }
.card-img-wrapper { position: relative; height: 160px; width: 100%; }
.card-img { width: 100%; height: 100%; object-fit: cover; }
.icon-badge { position: absolute; bottom: -20px; right: 20px; background: #1976D2; color: white; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.card-body { padding: 32px 20px 24px; flex-grow: 1; }
.card-body h4 { margin: 0 0 12px 0; color: #263238; font-size: 18px; }
.card-body p { margin: 0; color: #78909C; font-size: 14px; line-height: 1.6; }
.commitment-footer { margin-top: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #90A4AE; font-size: 14px; font-style: italic; }
@media (max-width: 768px) { .expectations-grid { grid-template-columns: 1fr; } }
</style>