<script setup>
defineProps({ isOpen: Boolean });
defineEmits(['close']);
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <button class="close-btn" @click="$emit('close')">&times;</button>
        <header class="modal-header">
          <h2>About CCF</h2>
          <p>Christ's Commission Fellowship</p>
        </header>
        <div class="scroll-area">
          <section class="info-section">
            <h3>Our Mission</h3>
            <p>To honor God and make Christ-committed followers who will make Christ-committed followers.</p>
          </section>
          <section class="info-section">
            <h3>WKND Services</h3>
            <p>Join us for our worship services! Visit our main center or any satellite location for a time of worship and biblical teaching.</p>
          </section>
          <section class="info-section highlight b1g">
            <h3>B1G (Be One with God)</h3>
            <p>The singles ministry of CCF, dedicated to reaching single professionals for Christ.</p>
          </section>
          <section class="info-section highlight elevate">
            <h3>Elevate</h3>
            <p>Our youth ministry that empowers the next generation to live for Jesus and influence their world.</p>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.modal-content { background: white; width: 100%; max-width: 450px; max-height: 80vh; border-radius: 24px; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.close-btn { position: absolute; top: 15px; right: 20px; border: none; background: none; font-size: 28px; cursor: pointer; color: #90A4AE; }
.modal-header { padding: 30px 20px 15px; text-align: center; border-bottom: 1px solid #f0f0f0; }
.modal-header h2 { margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 800; }
.modal-header p { margin: 4px 0 0; color: #1976D2; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.scroll-area { padding: 10px 25px 30px; overflow-y: auto; }
.info-section { margin-top: 20px; }
.info-section h3 { font-size: 15px; color: #333; margin-bottom: 6px; border-left: 3px solid #1976D2; padding-left: 10px; font-weight: 700; }
.info-section p { font-size: 13px; line-height: 1.6; color: #546E7A; margin: 0; }
.highlight.b1g h3 { border-color: #FBC02D; }
.highlight.elevate h3 { border-color: #E91E63; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>