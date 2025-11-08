<script setup>
import { Bar } from 'vue-chartjs'
// ChartJS registration is now in main.js, so this is clean.

defineProps({
  chartData: {
    type: Object,
    required: true
  },
  chartOptions: {
    type: Object,
    default: () => ({
      responsive: true,
      maintainAspectRatio: false
    })
  }
})
</script>

<template>
  <Bar
    :data="chartData"
    :options="chartOptions"
  />
</template>