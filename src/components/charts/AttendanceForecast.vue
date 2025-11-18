<script setup>
import { computed, ref, onMounted } from 'vue'
import BarChart from './BarChart.vue'
import { AttendanceForecaster, prepareAttendanceData } from '../../utils/forecasting'
import dayjs from 'dayjs'

const props = defineProps({
  events: Array,
  attendance: Array
})

const emit = defineEmits(['forecast-ready'])

const forecaster = ref(new AttendanceForecaster())
const forecastData = ref(null)
const isLoading = ref(true)

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top' },
    datalabels: { display: false }
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 1 } }
  }
})

const chartData = computed(() => {
  if (!forecastData.value) return null
  
  const historical = forecastData.value.historical.map(h => ({
    label: dayjs(h.date).format('MMM DD'),
    value: h.attendance
  }))
  
  const predictions = forecastData.value.predictions.map(p => ({
    label: dayjs(p.date).format('MMM DD'),
    value: Math.round(p.predicted)
  }))
  
  return {
    labels: [...historical.map(h => h.label), ...predictions.map(p => p.label)],
    datasets: [
      {
        label: 'Historical',
        backgroundColor: '#1976D2',
        data: [...historical.map(h => h.value), ...Array(predictions.length).fill(null)]
      },
      {
        label: 'Forecast',
        backgroundColor: '#FF9800',
        borderDash: [5, 5],
        data: [...Array(historical.length).fill(null), ...predictions.map(p => p.value)]
      }
    ]
  }
})

const generateForecast = async () => {
  try {
    isLoading.value = true
    
    const historicalData = prepareAttendanceData(props.events, props.attendance)
    
    if (historicalData.length === 0) {
      const samplePredictions = [
        { date: dayjs().add(14, 'days').format('YYYY-MM-DD'), predicted: 25 },
        { date: dayjs().add(28, 'days').format('YYYY-MM-DD'), predicted: 28 },
        { date: dayjs().add(42, 'days').format('YYYY-MM-DD'), predicted: 30 }
      ]
      
      forecastData.value = { historical: [], predictions: samplePredictions }
      emit('forecast-ready', { predictions: samplePredictions })
      return
    }
    
    forecaster.value.train(historicalData)
    
    const lastDate = historicalData[historicalData.length - 1].date
    const predictions = []
    
    for (let i = 1; i <= 3; i++) {
      const futureDate = dayjs(lastDate).add(i * 14, 'days').format('YYYY-MM-DD')
      predictions.push({
        date: futureDate,
        predicted: forecaster.value.forecast(futureDate)
      })
    }
    
    forecastData.value = {
      historical: historicalData.slice(-3),
      predictions
    }
    
    emit('forecast-ready', { predictions })
    
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  generateForecast()
})
</script>

<template>
  <div class="forecast-card">
    <h3>Attendance Forecast</h3>
    
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Generating forecast...</p>
    </div>
    
    <div v-else-if="chartData" class="chart-container">
      <BarChart 
        :chartData="chartData" 
        :chartOptions="chartOptions"
        style="height: 180px;"
      />
    </div>
  </div>
</template>

<style scoped>
.forecast-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.forecast-card h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #E3F2FD;
  border-top: 2px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading p {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.chart-container {
  position: relative;
}
</style>
