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

      <!-- Scrollable body: place the slotted content here so it can scroll
           independently of the footer text. -->
      <div class="modal-body">
        <slot></slot>
      </div>

      <!-- Small helper text at the bottom telling users how to close the modal -->
      <div class="modal-footer">click outside to close</div>

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
  z-index: 4000; /* raised to ensure modal sits above other overlays */
  padding: 20px;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  padding-bottom: 19px;
  position: relative;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);

  /* --- SCROLLING  --- */
  max-height: 90vh; 
  display: flex;
  flex-direction: column; 
  overflow: hidden; 
}

/* Make the modal body (the slotted content wrapper) fill available space and scroll if needed. */
.modal-content > .modal-body {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0; /* allow child to shrink and enable internal scrolling */
  overflow: auto; /* allow the slotted content to scroll */
}


.modal-content.modal-default {
  width: 100%;
  max-width: 960px;
  box-sizing: border-box;
}

.modal-content.modal-xl {
  max-width: 1100px; /* or whatever XL means */
}

/* Make sure close button is always above slotted content */
.modal-footer {
  font-size: 12px;
  color: #777;
  text-align: center;
  padding-top: 5px;
  margin-top: 5px;
  user-select: none;
}

/* For very tall content, ensure modal is vertically centered but scrollable */
@media (max-height: 600px) {
  .modal-overlay {
    align-items: flex-start;
    padding-top: 28px;
    padding-bottom: 28px;
  }
}
</style>