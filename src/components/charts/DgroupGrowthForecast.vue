<template>
  <div class="dgroup-forecast-card">
    <div class="forecast-header">
      <div>
        <h3>D-Group Growth Projections</h3>
        <p class="forecast-subtitle">
          ML-powered seeker endorsement forecast | 
          Endorsement Rate: <span class="highlight">{{ endorsementRateDisplay }}</span>
        </p>
      </div>
    </div>

    <div class="current-stats">
      <div class="stat-box">
        <span class="stat-icon">Seekers</span>
        <div>
          <span class="stat-value">{{ currentSeekers }}</span>
          <span class="stat-label">Current Seekers</span>
        </div>
      </div>
      <div class="stat-box">
        <span class="stat-icon">Members</span>
        <div>
          <span class="stat-value">{{ currentMembers }}</span>
          <span class="stat-label">D-Group Members</span>
        </div>
      </div>
      <div class="stat-box">
        <span class="stat-icon">Time</span>
        <div>
          <span class="stat-value">{{ avgWeeksToEndorse }}</span>
          <span class="stat-label">Avg Weeks to Endorse</span>
        </div>
      </div>
    </div>

    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <div class="projection-summary">
      <h4>3-Month Projection</h4>
      <div class="projection-grid">
        <div class="projection-item">
          <span class="proj-label">Expected New Members</span>
          <span class="proj-value growth">+{{ projectedGrowth }}</span>
        </div>
        <div class="projection-item">
          <span class="proj-label">Projected Total</span>
          <span class="proj-value">{{ projectedTotal }}</span>
        </div>
        <div class="projection-item">
          <span class="proj-label">Growth Rate</span>
          <span class="proj-value growth">{{ growthRate }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Chart, registerables } from 'chart.js'
import { DgroupGrowthForecaster } from '../../utils/forecasting'

Chart.register(...registerables)

const props = defineProps({
  members: { type: Array, required: true },
  attendance: { type: Array, required: true }
})

const chartCanvas = ref(null)
let chartInstance = null
const forecaster = new DgroupGrowthForecaster()
const predictions = ref([])

const currentSeekers = computed(() => 
  props.members.filter(m => m.finalTags?.isSeeker && !m.dgroupLeader).length
)

const currentMembers = computed(() => 
  props.members.filter(m => m.dgroupLeader).length
)

const endorsementRateDisplay = computed(() => 
  `${(forecaster.conversionRate * 100).toFixed(0)}%`
)

const avgWeeksToEndorse = computed(() => 
  `${forecaster.avgTimeToConvert.toFixed(1)} wks`
)

const projectedGrowth = computed(() => {
  if (predictions.value.length === 0) return 0;
  const lastPrediction = predictions.value[predictions.value.length - 1];
  return lastPrediction.totalGrowth;
})

const projectedTotal = computed(() => {
  if (predictions.value.length === 0) return currentMembers.value;
  const lastPrediction = predictions.value[predictions.value.length - 1];
  return lastPrediction.members;
})

const growthRate = computed(() => {
  if (currentMembers.value === 0) return 0;
  return ((projectedGrowth.value / currentMembers.value) * 100).toFixed(0);
})

function runForecast() {
  // Analyze historical patterns
  forecaster.analyzeConversionPatterns(props.members, props.attendance);

  // Generate 12-week forecast
  predictions.value = forecaster.forecastGrowth(
    currentSeekers.value,
    currentMembers.value,
    12
  );

  renderChart();
}

function renderChart() {
  if (!chartCanvas.value) return;

  const ctx = chartCanvas.value.getContext('2d');

  const months = predictions.value.map(p => `Month ${p.month}`);
  const seekersData = predictions.value.map(p => p.seekers);
  const membersData = predictions.value.map(p => p.members);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Seekers (Not Yet Endorsed)',
          data: seekersData,
          backgroundColor: 'rgba(255, 193, 7, 0.7)',
          borderColor: '#FFC107',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'D-Group Members',
          data: membersData,
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: '#4CAF50',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 13, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 12 } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 5,
            font: { size: 12 }
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      }
    }
  });
}

onMounted(() => {
  runForecast();
})
</script>

<style scoped>
.dgroup-forecast-card {
  background: linear-gradient(135deg, #ffffff 0%, #f1f8f4 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.forecast-header {
  margin-bottom: 20px;
}

.dgroup-forecast-card h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
}

.forecast-subtitle {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.highlight {
  color: #4CAF50;
  font-weight: 700;
}

.current-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-box {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #f0f0f0;
  transition: all 0.3s ease;
}

.stat-box:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
}

.stat-icon {
  font-size: 14px;
  font-weight: 700;
  color: #2e7d32;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #2e7d32;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chart-container {
  height: 320px;
  margin-bottom: 24px;
}

.projection-summary {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #f0f0f0;
}

.projection-summary h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.projection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.projection-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.proj-label {
  font-size: 12px;
  color: #666;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
}

.proj-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.proj-value.growth {
  color: #4CAF50;
}

@media (max-width: 768px) {
  .current-stats {
    grid-template-columns: 1fr;
  }
}
</style>
