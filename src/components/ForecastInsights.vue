<script setup>
import { computed } from 'vue'

const props = defineProps({
  forecastData: Object
})

const insights = computed(() => {
  if (!props.forecastData?.predictions) return null
  
  const predictions = props.forecastData.predictions
  const maxAttendance = Math.max(...predictions.map(p => p.predicted))
  
  return {
    venueCapacity: Math.ceil(maxAttendance * 1.2), // 20% buffer
    volunteers: Math.ceil(maxAttendance / 4.5), // 1 volunteer per 4.5 attendees
    maxExpected: Math.round(maxAttendance)
  }
})
</script>

<template>
  <div v-if="insights" class="insights-card">
    <div class="insights-grid">
      <div class="insight-item">
        <div class="insight-value">{{ insights.venueCapacity }}</div>
        <div class="insight-label">Venue Capacity</div>
        <div class="insight-detail">{{ insights.maxExpected }} expected + 20% buffer</div>
      </div>
      
      <div class="insight-item">
        <div class="insight-value">{{ insights.volunteers }}</div>
        <div class="insight-label">Volunteers Needed</div>
        <div class="insight-detail">1 volunteer per 4-5 attendees</div>
      </div>
    </div>
    
    <div class="tips">
      <p><strong>💡 Tip:</strong> Book venues and recruit volunteers 2 weeks in advance</p>
    </div>
  </div>
</template>

<style scoped>
.insights-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-top: 16px;
}

.insights-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.insight-item {
  text-align: center;
  padding: 16px;
  background: #F8F9FA;
  border-radius: 8px;
}

.insight-value {
  font-size: 28px;
  font-weight: 700;
  color: #1976D2;
  margin-bottom: 4px;
}

.insight-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.insight-detail {
  font-size: 12px;
  color: #666;
}

.tips {
  background: #E8F5E8;
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #4CAF50;
}

.tips p {
  margin: 0;
  color: #2E7D32;
  font-size: 14px;
}
</style>