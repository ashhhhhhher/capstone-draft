<script setup>
import { ref } from 'vue'
import { BookOpen, Users, Heart, Star, CheckCircle, X, ChevronRight } from 'lucide-vue-next'

const showModal = ref(false)
const expectations = [
  { 
    title: 'Why should I join?', 
    desc: 'Because we weren\'t meant to do life alone. Find a community where you can belong, grow, and be supported.',
    icon: Users,
    img: 'https://i1.wp.com/www.ccf.org.ph/wp-content/uploads/2020/06/Banner-04-02-1.jpg?fit=1920%2C952&ssl=1'
  },
  { 
    title: 'What to expect?', 
    desc: 'A safe space for honest conversations, studying God\'s Word, and life-on-life accountability with friends.',
    icon: Heart,
    img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQuQXMZrSNXGcI-AiThW6P6FYt2DV1HKZidag&s',
    hasCovenant: true
  },
  { 
    title: 'How do I start?', 
    desc: 'Start by committing to the journey. We grow as we follow Jesus together and eventually lead others to do the same.',
    icon: BookOpen,
    img: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=400&q=80'
  }
]

const covenantPoints = [
  { title: 'CONFIDENTIALITY (PROVERBS 11:13)', text: 'I will ensure that everything shared in the Dgroup stays only within the Dgroup.' },
  { title: 'HONESTY (PROVERBS 12:22)', text: 'I will be open and honest with my DLeader and fellow members.' },
  { title: 'RESPECT (PHILIPPIANS 2:4, HEBREWS 13:17)', text: 'I will respect my Dgroup by regularly attending and participating in Dgroup meetings.' },
  { title: 'INTERCESSION (EPHESIANS 6:18)', text: 'I will regularly pray for my DLeader and fellow members.' },
  { title: 'SPIRITUAL GROWTH (HEBREWS 10:24-25)', text: 'I will have no other purpose for joining a Dgroup except to grow spiritually.' },
  { title: 'TIMOTHIES (2 TIMOTHY 2:2)', text: 'I will have it as my goal to disciple others and start a Dgroup.' }
]
</script>

<template>
  <div class="overview-container">
    <div class="header-section">
      <Star :size="32" class="star-icon" />
      <h2>What is a Dgroup?</h2>
      <p>A Dgroup is a small group of people who meet regularly to help one another follow Jesus through a process of spiritual multiplication.</p>
    </div>

    <div class="expectations-wrapper">
      <div v-for="(item, index) in expectations" :key="item.title" class="card-wrapper">
        <div class="expect-card">
          <div class="card-img-wrapper">
            <img :src="item.img" :alt="item.title" class="card-img" />
            <div class="icon-badge"><component :is="item.icon" :size="20" /></div>
          </div>
          <div class="card-body">
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <button v-if="item.hasCovenant" class="covenant-btn" @click="showModal = true">View Covenant</button>
          </div>
        </div>
        <div v-if="index < expectations.length - 1" class="sequence-arrow">
          <ChevronRight :size="32" />
        </div>
      </div>
    </div>

    <div class="commitment-footer">
      <CheckCircle :size="18" />
      <span>Helping people follow Jesus. One life at a time.</span>
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <button class="close-btn" @click="showModal = false"><X :size="24" /></button>
          <h3 class="modal-title">DISCIPLESHIP COVENANT</h3>
          <div class="covenant-list">
            <div v-for="point in covenantPoints" :key="point.title" class="point-item">
              <h6>{{ point.title }}</h6>
              <p>{{ point.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.overview-container { padding: 40px 20px; max-width: 1100px; margin: 0 auto; }
.header-section { text-align: center; margin-bottom: 60px; }
.header-section h2 { color: #1976D2; font-size: 28px; margin: 12px 0; font-weight: 800; }
.header-section p { color: #546E7A; font-size: 16px; max-width: 650px; margin: 0 auto; line-height: 1.6; }
.star-icon { color: #FBC02D; margin: 0 auto; }
.expectations-wrapper { display: flex; align-items: stretch; justify-content: space-between; gap: 16px; position: relative; }
.card-wrapper { display: flex; align-items: center; flex: 1; gap: 16px; }
.expect-card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #ECEFF1; display: flex; flex-direction: column; overflow: visible; transition: transform 0.3s ease; width: 100%; height: 100%; }
.expect-card:hover { transform: translateY(-8px); }
.card-img-wrapper { position: relative; height: 160px; width: 100%; }
.card-img { width: 100%; height: 100%; object-fit: cover; border-radius: 20px 20px 0 0; }
.icon-badge { position: absolute; bottom: -22px; right: 20px; background: #1976D2; color: white; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 10; }
.card-body { padding: 36px 20px 24px; flex-grow: 1; display: flex; flex-direction: column; text-align: left; }
.card-body h4 { margin: 0 0 12px 0; color: #1565C0; font-size: 20px; font-weight: 800; }
.card-body p { margin: 0; color: #78909C; font-size: 14px; line-height: 1.6; flex-grow: 1; }
.sequence-arrow { color: #BBDEFB; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.covenant-btn { margin-top: 16px; padding: 12px; background: #1976D2; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; }
.commitment-footer { margin-top: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #90A4AE; font-size: 14px; font-style: italic; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
.modal-content { background: white; padding: 40px; border-radius: 24px; max-width: 600px; width: 92%; position: relative; max-height: 85vh; overflow-y: auto; }
.modal-title { color: #1976D2; margin: 0 0 24px 0; font-size: 22px; font-weight: 800; border-bottom: 2px solid #E3F2FD; padding-bottom: 12px; }
.point-item { margin-bottom: 20px; text-align: left; }
.point-item h6 { color: #1565C0; margin: 0 0 4px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; }
.point-item p { margin: 0; color: #455A64; font-size: 14px; line-height: 1.5; }
.close-btn { position: absolute; top: 20px; right: 20px; background: #F5F7F8; border: none; color: #90A4AE; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
@media (max-width: 900px) { .expectations-wrapper { flex-direction: column; align-items: center; gap: 40px; } .card-wrapper { flex-direction: column; width: 100%; } .sequence-arrow { transform: rotate(90deg); margin-top: -20px; } }
</style>