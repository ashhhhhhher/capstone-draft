<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  forecastData: Object, // { predictions: [], avgPredicted: number }
  safetyBuffer: { type: Number, default: 1.2 }, // 20% buffer
  volunteerRatio: { type: Number, default: 4.5 } // 1 volunteer per 4.5 attendees
})

// Computed recommendations
const recommendations = computed(() => {
  if (!props.forecastData?.predictions) return null
  
  const predictions = props.forecastData.predictions
  const maxPredicted = Math.max(...predictions.map(p => p.predicted))
  const avgPredicted = props.forecastData.avgPredicted
  
  // Venue capacity with safety buffer
  const recommendedCapacity = Math.ceil(maxPredicted * props.safetyBuffer)
  
  // Volunteer needs
  const volunteersForMax = Math.ceil(maxPredicted / props.volunteerRatio)
  const volunteersForAvg = Math.ceil(avgPredicted / props.volunteerRatio)
  
  return {
    maxExpected: Math.round(maxPredicted),
    avgExpected: Math.round(avgPredicted),
    recommendedCapacity,
    capacityBuffer: Math.round((recommendedCapacity - maxPredicted)),
    volunteersForMax,
    volunteersForAvg,
    volunteerDetails: predictions.map(p => ({
      date: p.date,
      attendance: Math.round(p.predicted),
      volunteers: Math.ceil(p.predicted / props.volunteerRatio)
    }))
  }
})

// Capacity status indicator
const capacityStatus = computed(() => {
  if (!recommendations.value) return 'unknown'
  
  const buffer = recommendations.value.capacityBuffer
  const bufferPercent = (buffer / recommendations.value.maxExpected) * 100
  
  if (bufferPercent >= 20) return 'good'
  if (bufferPercent >= 10) return 'moderate' 
  return 'tight'
})

const capacityStatusColor = computed(() => {
  switch (capacityStatus.value) {
    case 'good': return '#2E7D32'
    case 'moderate': return '#F57C00'
    case 'tight': return '#D32F2F'
    default: return '#546E7A'
  }
})
</script>

<template>
  <div class="recommendations-container">
    <div class="section-header">
      <h3>Event Planning Recommendations</h3>
      <p class="section-subtitle">Venue capacity and volunteer staffing insights</p>
    </div>
    
    <div v-if="!recommendations" class="no-data-state">
      <p>Waiting for attendance forecast data...</p>
    </div>
    
    <div v-else class="recommendations-grid">
      
      <!-- Venue Capacity Card -->
      <div class="recommendation-card capacity-card">
        <div class="card-header">
          <h4>🏢 Venue Capacity</h4>
          <div 
            class="status-badge"
            :style="{ backgroundColor: capacityStatusColor, color: 'white' }"
          >
            {{ capacityStatus.toUpperCase() }}
          </div>
        </div>
        
        <div class="metric-row">
          <div class="metric">
            <span class="metric-label">Recommended Capacity</span>
            <span class="metric-value primary">{{ recommendations.recommendedCapacity }}</span>
          </div>
        </div>
        
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Max Expected</span>
            <span class="detail-value">{{ recommendations.maxExpected }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Safety Buffer</span>
            <span class="detail-value">+{{ recommendations.capacityBuffer }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Avg Expected</span>
            <span class="detail-value">{{ recommendations.avgExpected }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Buffer %</span>
            <span class="detail-value">{{ Math.round(((recommendations.capacityBuffer / recommendations.maxExpected) * 100)) }}%</span>
          </div>
        </div>
      </div>
      
      <!-- Volunteer Staffing Card -->
      <div class="recommendation-card volunteer-card">
        <div class="card-header">
          <h4>👥 Volunteer Staffing</h4>
          <div class="ratio-badge">
            1:{{ volunteerRatio }} ratio
          </div>
        </div>
        
        <div class="metric-row">
          <div class="metric">
            <span class="metric-label">Volunteers Needed</span>
            <span class="metric-value primary">{{ recommendations.volunteersForMax }}</span>
          </div>
        </div>
        
        <div class="volunteer-breakdown">
          <div class="breakdown-header">
            <span>Service Schedule</span>
          </div>
          <div class="breakdown-list">
            <div 
              v-for="detail in recommendations.volunteerDetails" 
              :key="detail.date"
              class="breakdown-item"
            >
              <span class="service-date">
                {{ new Date(detail.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                }) }}
              </span>
              <span class="service-attendance">{{ detail.attendance }} attendees</span>
              <span class="service-volunteers">{{ detail.volunteers }} volunteers</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
    
    <!-- Planning Tips -->
    <div v-if="recommendations" class="planning-tips">
      <h4>💡 Planning Tips</h4>
      <ul>
        <li v-if="capacityStatus === 'tight'">
          <strong>Tight Capacity:</strong> Consider booking a larger venue or adding overflow seating options.
        </li>
        <li v-if="capacityStatus === 'good'">
          <strong>Good Buffer:</strong> Your recommended capacity provides comfortable room for growth.
        </li>
        <li>
          <strong>Volunteer Recruitment:</strong> Aim for {{ recommendations.volunteersForMax }} volunteers, 
          with {{ Math.ceil(recommendations.volunteersForMax * 1.1) }} including backup coverage.
        </li>
        <li>
          <strong>Early Preparation:</strong> Book venues and confirm volunteers at least 2 weeks in advance.
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.recommendations-container {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.section-header {
  margin-bottom: 24px;
  text-align: center;
}

.section-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.section-subtitle {
  margin: 0;
  font-size: 14px;
  color: #546E7A;
}

.no-data-state {
  text-align: center;
  padding: 40px 20px;
  color: #78909C;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .recommendations-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.recommendation-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #E3F2FD;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.status-badge, .ratio-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.ratio-badge {
  background: #E3F2FD;
  color: #1976D2;
}

.metric-row {
  margin-bottom: 20px;
}

.metric {
  text-align: center;
}

.metric-label {
  display: block;
  font-size: 14px;
  color: #546E7A;
  margin-bottom: 4px;
}

.metric-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
}

.metric-value.primary {
  color: #1976D2;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-item {
  text-align: center;
  padding: 8px;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 6px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #546E7A;
  margin-bottom: 2px;
}

.detail-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.volunteer-breakdown {
  margin-top: 12px;
}

.breakdown-header {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ECEFF1;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.breakdown-item {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  align-items: center;
}

.service-date {
  font-weight: 600;
  color: #333;
}

.service-attendance {
  color: #546E7A;
  text-align: center;
}

.service-volunteers {
  color: #1976D2;
  font-weight: 600;
  text-align: right;
}

.planning-tips {
  background: linear-gradient(135deg, #E8F5E8 0%, #F1F8E9 100%);
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid #4CAF50;
}

.planning-tips h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2E7D32;
}

.planning-tips ul {
  margin: 0;
  padding-left: 20px;
}

.planning-tips li {
  margin-bottom: 8px;
  color: #333;
  line-height: 1.4;
}

.planning-tips li:last-child {
  margin-bottom: 0;
}
</style>