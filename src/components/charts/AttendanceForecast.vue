<script setup>
import { computed, ref, onMounted } from 'vue'
import BarChart from './BarChart.vue'
import { AttendanceForecaster, prepareAttendanceData } from '../../utils/forecasting'
import dayjs from 'dayjs'

const props = defineProps({
  events: Array,
  attendance: Array,
  forecastPeriods: { type: Number, default: 3 },
  isBiWeekly: { type: Boolean, default: true }
})

const emit = defineEmits(['forecast-ready'])

// State
const forecaster = ref(new AttendanceForecaster())
const forecastData = ref(null)
const isLoading = ref(true)
const error = ref(null)

// Chart options
const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top' },
    datalabels: {
      formatter: (value) => value > 0 ? Math.round(value) : '',
      color: '#333',
      font: { weight: 'bold', size: 12 }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  }
})

// Generate next service dates
const generateNextServiceDates = (lastEventDate, periods, biWeekly = true) => {
  const dates = []
  let currentDate = dayjs(lastEventDate)
  const interval = biWeekly ? 14 : 7 // days
  
  for (let i = 1; i <= periods; i++) {
    currentDate = currentDate.add(interval, 'day')
    dates.push(currentDate.format('YYYY-MM-DD'))
  }
  return dates
}

// Prepare chart data
const chartData = computed(() => {
  if (!forecastData.value) return null
  
  const historicalLabels = forecastData.value.historical.map(h => 
    dayjs(h.date).format('MMM DD')
  )
  const forecastLabels = forecastData.value.predictions.map(p => 
    dayjs(p.date).format('MMM DD')
  )
  
  const historicalData = forecastData.value.historical.map(h => h.attendance)
  const forecastedData = forecastData.value.predictions.map(p => Math.round(p.predicted))
  
  return {
    labels: [...historicalLabels, ...forecastLabels],
    datasets: [
      {
        label: 'Historical Attendance',
        backgroundColor: '#1976D2',
        borderColor: '#1976D2',
        data: [...historicalData, ...Array(forecastedData.length).fill(null)]
      },
      {
        label: 'Forecasted Attendance',
        backgroundColor: '#FF9800',
        borderColor: '#FF9800',
        borderDash: [5, 5],
        data: [...Array(historicalData.length).fill(null), ...forecastedData]
      }
    ]
  }
})

// Train model and generate predictions
const generateForecast = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    // Prepare historical data
    const historicalData = prepareAttendanceData(props.events, props.attendance)
    
    if (historicalData.length < 3) {
      throw new Error('Need at least 3 events with attendance data for forecasting')
    }
    
    // Train model
    forecaster.value.train(historicalData)
    
    // Get last event date
    const lastEvent = historicalData[historicalData.length - 1]
    const lastDate = lastEvent.date
    
    // Generate future dates
    const futureDates = generateNextServiceDates(lastDate, props.forecastPeriods, props.isBiWeekly)
    
    // Generate predictions
    const predictions = futureDates.map(date => ({
      date,
      predicted: forecaster.value.forecast(date)
    }))
    
    forecastData.value = {
      historical: historicalData.slice(-5), // Show last 5 historical points
      predictions
    }
    
    // Emit forecast data for parent component use
    emit('forecast-ready', {
      predictions,
      avgPredicted: predictions.reduce((sum, p) => sum + p.predicted, 0) / predictions.length
    })
    
  } catch (err) {
    error.value = err.message
    console.error('Forecasting error:', err)
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  generateForecast()
})

// Watch for data changes
const dataKey = computed(() => 
  `${props.events.length}-${props.attendance.length}`
)

// Re-generate when data changes
const refreshForecast = () => {
  if (props.events.length > 0 && props.attendance.length > 0) {
    generateForecast()
  }
}

// Watch for prop changes
const prevDataKey = ref(dataKey.value)
const checkDataChanges = () => {
  if (dataKey.value !== prevDataKey.value) {
    prevDataKey.value = dataKey.value
    refreshForecast()
  }
}

// Check on each render
onMounted(() => {
  const interval = setInterval(checkDataChanges, 1000)
  return () => clearInterval(interval)
})
</script>

<template>
  <div class="forecast-container">
    <div class="forecast-header">
      <h3>Attendance Forecast</h3>
    </div>
    
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Generating forecast...</p>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="refreshForecast" class="retry-btn">Retry</button>
    </div>
    
    <!-- Chart -->
    <div v-else-if="chartData" class="chart-wrapper">
      <BarChart 
        :chartData="chartData" 
        :chartOptions="chartOptions"
        style="height: 300px;"
      />
      
      <!-- Forecast Summary -->
      <div class="forecast-summary">
        <div class="summary-grid">
          <div 
            v-for="(prediction, index) in forecastData.predictions" 
            :key="prediction.date"
            class="prediction-item"
          >
            <div class="prediction-date">
              {{ dayjs(prediction.date).format('MMM DD, YYYY') }}
            </div>
            <div class="prediction-value">
              {{ Math.round(prediction.predicted) }} attendees
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forecast-container {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}

.forecast-header {
  margin-bottom: 20px;
  text-align: center;
}

.forecast-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.forecast-subtitle {
  margin: 0;
  font-size: 14px;
  color: #546E7A;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px 20px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E3F2FD;
  border-top: 3px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state p {
  color: #D32F2F;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 8px 16px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.chart-wrapper {
  position: relative;
}

.forecast-summary {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #ECEFF1;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.prediction-item {
  background: linear-gradient(135deg, #FFF3E0 0%, #FFFFFF 100%);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  border: 1px solid #FFE0B2;
}

.prediction-date {
  font-size: 14px;
  color: #F57C00;
  font-weight: 600;
  margin-bottom: 4px;
}

.prediction-value {
  font-size: 20px;
  font-weight: 700;
  color: #E65100;
}
</style>