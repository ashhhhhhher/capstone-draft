<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  required: { type: Boolean, default: false },
  // optional override for min attribute (YYYY-MM-DD). If null -> no min; if undefined -> default to today
  min: { type: [String, null], default: undefined },
  // optional override for max attribute (YYYY-MM-DD). If null -> no max
  max: { type: [String, null], default: null }
})
const emit = defineEmits(['update:modelValue'])

// Compute today's date in local timezone (YYYY-MM-DD)
const tzOffsetMs = new Date().getTimezoneOffset() * 60000
const todayStr = new Date(Date.now() - tzOffsetMs).toISOString().split('T')[0]
const minDate = computed(() => {
  if (props.min === null) return undefined
  if (props.min !== undefined) return props.min
  return todayStr
})

const valueRef = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function onInput(e) {
  valueRef.value = e.target.value
}
</script>

<template>
  <input
    type="date"
    :value="valueRef"
    @input="onInput"
    :min="minDate"
    :max="props.max || undefined"
    :required="props.required"
    class="date-input"
  />
</template>

<style scoped>
.date-input { width: 95%; padding: 8px; border-radius: 6px; border: 1px solid #E0E0E0 }
</style>
