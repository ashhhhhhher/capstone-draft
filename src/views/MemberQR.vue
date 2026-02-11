<script setup>
import { ref, computed } from 'vue'
import QrcodeVue from 'vue-qrcode'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const memberProfile = computed(() => authStore.userProfile)

const qrCodeValue = computed(
  () => memberProfile.value?.id || authStore.user?.uid || 'no-id-found'
)

const lifeStage = computed(
  () => memberProfile.value?.finalTags?.ageCategory || 'General'
)

// ── Download Logic 
const cardRef = ref(null)
const isDownloading = ref(false)

async function downloadCard() {
  if (!cardRef.value || isDownloading.value) return
  isDownloading.value = true

  try {
    const { default: html2canvas } = await import('html2canvas')

    const canvas = await html2canvas(cardRef.value, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const link = document.createElement('a')
    const name = memberProfile.value?.firstName
      ? `${memberProfile.value.firstName}-${memberProfile.value.lastName}-qr`
      : 'wknd-qr-card'

    link.href = canvas.toDataURL('image/png')
    link.download = `${name}.png`
    link.click()
  } catch (err) {
    console.error('QR card download failed:', err)
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="qr-page">

    <!-- QR CARD  -->
    <div class="qr-card" ref="cardRef">
      <div class="card-header">
        <div class="org-logo">WKND</div>
        <span
          class="category-tag"
          :class="lifeStage.toLowerCase()"
        >
          {{ lifeStage }}
        </span>
      </div>

      <div class="qr-wrapper">
        <QrcodeVue
          :value="qrCodeValue"
          render-as="svg"
          level="H"
          class="qr-code-svg"
        />
      </div>

      <div class="member-details">
        <h2>
          {{ memberProfile?.firstName }}
          {{ memberProfile?.lastName }}
        </h2>
        <p class="uid">
          {{ memberProfile?.id || 'Loading ID...' }}
        </p>
      </div>
    </div>

    <!-- DOWNLOAD BUTTON  -->
    <button
      class="download-btn"
      :disabled="isDownloading"
      @click="downloadCard"
    >
      <span v-if="!isDownloading">Download QR</span>
      <span v-else>Saving…</span>
    </button>

    <p class="help-text">
      Present this code at the registration desk to check in.
    </p>
  </div>
</template>

<style>
/* ── Page */
.qr-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}

/* ── Card */
.qr-card {
  background: white;
  width: 100%;
  max-width: 320px;
  border-radius: 24px;
  padding: 30px 20px;
  text-align: center;
  margin-bottom: 20px;
  border: 1px solid #E3F2FD;
  box-shadow: 0 10px 30px rgba(25, 118, 210, 0.15);
}

/* ── Header  */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.org-logo {
  font-weight: 900;
  font-size: 18px;
  color: #1976D2;
  letter-spacing: -1px;
}

.category-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
}

.category-tag.elevate {
  background: #E3F2FD;
  color: #1976D2;
}

.category-tag.b1g {
  background: #FFF3E0;
  color: #F57C00;
}

.category-tag.general {
  background: #F3E5F5;
  color: #7B1FA2;
}

/* ── QR  */
.qr-wrapper {
  margin: 0 auto 20px;
  padding: 10px;
  background: white;
  width: 90%;
  max-width: 260px;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-code-svg {
  width: 100%;
  height: 100%;
}

/* ── Member Details  */
.member-details h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: #263238;
}

.uid {
  margin: 0;
  color: #90A4AE;
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 1px;
}

/* ── Button */
.download-btn {
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 14px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 16px;
  box-shadow: 0 4px 14px rgba(25, 118, 210, 0.35);
}

.download-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ── Help Text  */
.help-text {
  font-size: 13px;
  color: #90A4AE;
  max-width: 250px;
  text-align: center;
}
</style>
