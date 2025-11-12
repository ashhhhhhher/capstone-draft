<template>
  <div class="volunteer-forecast-card">
    <div class="forecast-header">
      <div>
        <h3>Volunteer Availability Predictor</h3>
        <p class="forecast-subtitle">
          ML-based pattern recognition | Consistency Score: 
          <span class="highlight">{{ overallConsistency }}%</span>
        </p>
      </div>
      <div class="controls">
        <div class="date-picker">
          <label>Predict for:</label>
          <input 
            type="date" 
            v-model="targetDate"
            @change="updatePrediction"
            :min="minDate"
            class="date-input"
          />
        </div>
        <div class="ministry-filter">
          <label>Ministry:</label>
          <select v-model="selectedMinistry" @change="updatePrediction" class="ministry-select">
            <option value="">All Ministries</option>
            <option v-for="ministry in ministries" :key="ministry" :value="ministry">
              {{ ministry }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="summary-stats">
      <div class="stat-card">
        <span class="stat-icon">Total</span>
        <div>
          <span class="stat-value">{{ totalVolunteers }}</span>
          <span class="stat-label">Total Volunteers</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">Consistent</span>
        <div>
          <span class="stat-value">{{ highConsistency }}</span>
          <span class="stat-label">High Consistency</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">Available</span>
        <div>
          <span class="stat-value">{{ likelyAvailable }}</span>
          <span class="stat-label">Likely Available</span>
        </div>
      </div>
    </div>

    <!-- Ministry Breakdown -->
    <div v-if="!selectedMinistry && ministryAvailability.length > 0" class="ministry-breakdown">
      <h4>Ministry Availability Overview</h4>
      <div class="ministry-grid">
        <div 
          v-for="ministry in ministryAvailability" 
          :key="ministry.ministry"
          class="ministry-card"
          @click="selectedMinistry = ministry.ministry; updatePrediction()"
        >
          <div class="ministry-header">
            <span class="ministry-name">{{ ministry.ministry }}</span>
            <span class="ministry-count">{{ ministry.likelyAvailable }}/{{ ministry.totalVolunteers }}</span>
          </div>
          <div class="ministry-bar">
            <div 
              class="ministry-fill" 
              :style="{ width: `${ministry.availabilityRate}%` }"
              :class="{ 
                'high': ministry.availabilityRate >= 70,
                'medium': ministry.availabilityRate >= 40 && ministry.availabilityRate < 70,
                'low': ministry.availabilityRate < 40
              }"
            ></div>
          </div>
          <span class="ministry-percentage">{{ ministry.availabilityRate.toFixed(0) }}% available</span>
        </div>
      </div>
    </div>

    <div class="predictions-container">
      <h4>Predicted Availability for {{ formattedDate }}
        <span v-if="selectedMinistry" class="filter-badge">{{ selectedMinistry }}</span>
      </h4>
      
      <div v-if="availabilityPredictions.length === 0" class="no-data">
        <p>No volunteer data available{{ selectedMinistry ? ` for ${selectedMinistry}` : '' }}.</p>
      </div>

      <div v-else class="volunteer-list">
        <div 
          v-for="prediction in availabilityPredictions" 
          :key="prediction.volunteerId"
          class="volunteer-item"
          :class="consistencyClass(prediction.reliability)"
        >
          <div class="volunteer-info">
            <div class="volunteer-name-row">
              <span class="volunteer-name">{{ prediction.name }}</span>
              <div class="badges">
                <span class="badge consistency" :class="prediction.reliability">
                  {{ prediction.reliability.toUpperCase() }}
                </span>
                <span 
                  v-if="prediction.isLikelyAvailable" 
                  class="badge available"
                >
                  LIKELY
                </span>
              </div>
            </div>
            <div class="ministry-tags">
              <span 
                v-for="ministry in prediction.ministries" 
                :key="ministry"
                class="ministry-tag"
              >
                {{ ministry }}
              </span>
            </div>
          </div>
          <div class="probability-bar">
            <div class="probability-indicator">
              <div 
                class="probability-fill"
                :style="{ width: `${prediction.probability * 100}%` }"
              ></div>
            </div>
            <span class="probability-text">
              {{ (prediction.probability * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="insights-section">
      <h4>Key Insights</h4>
      <div class="insight-grid">
        <div class="insight-item">
          <span class="insight-icon">Stats</span>
          <p>Average attendance rate: <strong>{{ avgAttendanceRate }}%</strong></p>
        </div>
        <div class="insight-item">
          <span class="insight-icon">Top</span>
          <p>Most consistent: <strong>{{ mostConsistent }}</strong></p>
        </div>
        <div class="insight-item">
          <span class="insight-icon">Info</span>
          <p>Predictions improve with more historical data</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { VolunteerPredictor } from '../../utils/forecasting'
import dayjs from 'dayjs'

const props = defineProps({
  members: { type: Array, required: true },
  attendance: { type: Array, required: true },
  events: { type: Array, required: true }
})

const predictor = new VolunteerPredictor()
const targetDate = ref(dayjs().add(7, 'day').format('YYYY-MM-DD'))
const selectedMinistry = ref('')
const availabilityPredictions = ref([])
const ministryAvailability = ref([])
const summary = ref(null)

const minDate = computed(() => dayjs().format('YYYY-MM-DD'))

const formattedDate = computed(() => 
  dayjs(targetDate.value).format('MMM DD, YYYY (ddd)')
)

const volunteers = computed(() => 
  props.members.filter(m => m.finalTags?.isVolunteer)
)

const ministries = computed(() => {
  const allMinistries = new Set()
  volunteers.value.forEach(v => {
    if (v.finalTags?.volunteerMinistry) {
      v.finalTags.volunteerMinistry.forEach(m => allMinistries.add(m))
    }
  })
  return Array.from(allMinistries).sort()
})

const totalVolunteers = computed(() => summary.value?.total || 0)

const highConsistency = computed(() => summary.value?.highReliability || 0)

const likelyAvailable = computed(() => 
  availabilityPredictions.value.filter(p => p.isLikelyAvailable).length
)

const overallConsistency = computed(() => {
  if (!summary.value) return '—';
  return (summary.value.averageAttendanceRate * 100).toFixed(0);
})

const avgAttendanceRate = computed(() => {
  if (!summary.value) return '—';
  return (summary.value.averageAttendanceRate * 100).toFixed(0);
})

const mostConsistent = computed(() => {
  if (!summary.value || summary.value.mostReliable.length === 0) return 'N/A';
  return summary.value.mostReliable[0].name;
})

function consistencyClass(reliability) {
  return `consistency-${reliability}`;
}

function updatePrediction() {
  availabilityPredictions.value = predictor.predictAvailability(
    targetDate.value, 
    selectedMinistry.value || null
  );
  
  // Update ministry availability overview
  if (!selectedMinistry.value) {
    ministryAvailability.value = predictor.getMinistryAvailability(targetDate.value);
  }
}

function initialize() {
  if (volunteers.value.length === 0) {
    console.warn('No volunteers found');
    return;
  }

  // Analyze patterns
  predictor.analyzePatterns(volunteers.value, props.attendance, props.events);
  
  // Get summary
  summary.value = predictor.getSummary();
  
  // Initial prediction
  updatePrediction();
}

onMounted(() => {
  initialize();
})
</script>

<style scoped>
.volunteer-forecast-card {
  background: linear-gradient(135deg, #ffffff 0%, #f3f4ff 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.forecast-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.volunteer-forecast-card h3 {
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
  color: #1976D2;
  font-weight: 700;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-picker label,
.ministry-filter label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.ministry-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input,
.ministry-select {
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.date-input:hover,
.date-input:focus,
.ministry-select:hover,
.ministry-select:focus {
  border-color: #1976D2;
  outline: none;
}

.ministry-select {
  min-width: 150px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #f0f0f0;
  transition: all 0.3s ease;
}

.stat-card:hover {
  border-color: #1976D2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
}

.stat-icon {
  font-size: 14px;
  font-weight: 700;
  color: #1976D2;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #1976D2;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.predictions-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 2px solid #f0f0f0;
}

.predictions-container h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-badge {
  background: #1976D2;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.ministry-breakdown {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 2px solid #f0f0f0;
}

.ministry-breakdown h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.ministry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.ministry-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.ministry-card:hover {
  background: #e3f2fd;
  border-color: #1976D2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
}

.ministry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.ministry-name {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.ministry-count {
  font-size: 14px;
  font-weight: 600;
  color: #1976D2;
}

.ministry-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.ministry-fill {
  height: 100%;
  transition: width 0.5s ease;
  border-radius: 4px;
}

.ministry-fill.high {
  background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);
}

.ministry-fill.medium {
  background: linear-gradient(90deg, #FF9800 0%, #FFB74D 100%);
}

.ministry-fill.low {
  background: linear-gradient(90deg, #f44336 0%, #e57373 100%);
}

.ministry-percentage {
  font-size: 12px;
  color: #666;
  font-weight: 600;
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.volunteer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.volunteer-item {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px;
  border-left: 4px solid #ddd;
  transition: all 0.3s ease;
}

.volunteer-item:hover {
  background: #e3f2fd;
  transform: translateX(4px);
}

.volunteer-item.consistency-high {
  border-left-color: #4CAF50;
}

.volunteer-item.consistency-medium {
  border-left-color: #FF9800;
}

.volunteer-item.consistency-low {
  border-left-color: #f44336;
}

.volunteer-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.volunteer-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.volunteer-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.ministry-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ministry-tag {
  background: #e3f2fd;
  color: #1976D2;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.consistency.high {
  background: #c8e6c9;
  color: #2e7d32;
}

.badge.consistency.medium {
  background: #ffe0b2;
  color: #ef6c00;
}

.badge.consistency.low {
  background: #ffcdd2;
  color: #c62828;
}

.badge.available {
  background: #1976D2;
  color: white;
}

.probability-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.probability-indicator {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.probability-fill {
  height: 100%;
  background: linear-gradient(90deg, #1976D2 0%, #42A5F5 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.probability-text {
  font-size: 14px;
  font-weight: 700;
  color: #1976D2;
  min-width: 45px;
  text-align: right;
}

.insights-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #f0f0f0;
}

.insights-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.insight-icon {
  font-size: 12px;
  font-weight: 700;
  color: #1976D2;
  text-transform: uppercase;
}

.insight-item p {
  margin: 0;
  font-size: 13px;
  color: #666;
}

.insight-item strong {
  color: #333;
  font-weight: 700;
}

@media (max-width: 768px) {
  .forecast-header {
    flex-direction: column;
  }
  
  .controls {
    width: 100%;
    flex-direction: column;
  }
  
  .date-picker,
  .ministry-filter {
    width: 100%;
  }
  
  .date-input,
  .ministry-select {
    flex: 1;
  }
  
  .ministry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
