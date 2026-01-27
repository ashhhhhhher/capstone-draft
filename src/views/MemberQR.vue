<script setup>
import { ref, computed } from 'vue'
import QrcodeVue from 'vue-qrcode'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const memberProfile = computed(() => authStore.userProfile)

const qrCodeValue = computed(() => memberProfile.value?.id || authStore.user?.uid)
const lifeStage = computed(() => memberProfile.value?.finalTags?.ageCategory || 'General')

</script>

<template>
  <div class="qr-page">
    <div class="qr-card">
      <div class="card-header">
        <div class="org-logo">WKND</div>
        <span class="category-tag" :class="lifeStage.toLowerCase()">{{ lifeStage }}</span>
      </div>

      <div class="qr-wrapper">
        <QrcodeVue :value="qrCodeValue" :size="260" level="H" />
      </div>

      <div class="member-details">
        <h2>{{ memberProfile?.firstName }} {{ memberProfile?.lastName }}</h2>
        <p class="uid">{{ memberProfile?.id || 'Loading ID...' }}</p>
      </div>
    </div>

    <p class="help-text">Present this code at the registration desk to check in.</p>
  </div>
</template>

<style scoped>
.qr-page { display: flex; flex-direction: column; align-items: center; padding-top: 20px; }

.qr-card { background: white; width: 100%; max-width: 320px; border-radius: 24px; padding: 30px 20px; box-shadow: 0 10px 30px rgba(25, 118, 210, 0.15); text-align: center; margin-bottom: 30px; position: relative; border: 1px solid #E3F2FD; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.org-logo { font-weight: 900; font-size: 18px; color: #1976D2; letter-spacing: -1px; }
.category-tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; }
.category-tag.elevate { background: #E3F2FD; color: #1976D2; }
.category-tag.b1g { background: #FFF3E0; color: #F57C00; }

.qr-wrapper { margin: 0 auto 20px; padding: 10px; background: white; display: inline-block; }
.member-details h2 { margin: 0 0 6px 0; font-size: 22px; color: #263238; }
.uid { margin: 0; color: #90A4AE; font-family: monospace; font-size: 14px; letter-spacing: 1px; }

.help-text { margin-top: 20px; font-size: 13px; color: #90A4AE; max-width: 250px; text-align: center; }
</style>