<script setup>
import { Doughnut } from 'vue-chartjs'
// We no longer need to import or register ChartJS here

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
  <Doughnut
    :data="chartData"
    :options="chartOptions"
  />
</template>