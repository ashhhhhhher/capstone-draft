<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: String // 'default' or 'xl'
})

const emit = defineEmits(['close'])

const modalSizeClass = computed(() => {
  if (props.size === 'xl') {
    return 'modal-xl'
  }
  return 'modal-default'
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    
    <div class="modal-content" :class="modalSizeClass">
      
      <button class="close-btn" @click="emit('close')">
        &times;
      </button>

      <!-- 
        The <slot /> will be filled by MemberDetailsModal.
        The styles below force the slotted component to
        fill the modal and respect the max-height.
      -->
      <slot></slot>

    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  position: relative;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  
  /* --- SCROLLING  --- */
  max-height: 90vh; 
  display: flex;
  flex-direction: column; 
  overflow: hidden; 
}

/* This targets the <slot> and makes its content (MemberDetailsModal) grow */
.modal-content > :slotted(*) {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden; 
}

.modal-content.modal-default {
  width: 90%;
  max-width: 500px;
}
.modal-content.modal-xl {
  width: 95%;
  max-width: 900px;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  z-index: 10;
}
</style>