<script setup>
import { TrendingUp, Users, Calendar } from 'lucide-vue-next'

const props = defineProps({
    forecastData: {
        type: Object,
        required: true
    }
})

// Simple function to determine if attendance is up, down, or flat
function getForecastTrend() {
    if (props.forecastData.historicalCount < 5) {
        return {
            text: 'Need more data (last 5 events)',
            icon: Calendar,
            color: '#78909C' // Gray
        }
    }
    // We only have the predicted count, so we'll highlight the next event's prediction
    return {
        text: `Predicted attendance for ${props.forecastData.nextEvent}`,
        icon: Users,
        color: '#1976D2'
    }
}

const trend = getForecastTrend();
</script>

<template>
    <div class="insights-card">
        <h3 class="insights-title">Prediction Summary</h3>

        <div class="kpi-detail-card">
            <Users :size="24" :color="trend.color" />
            <div class="kpi-content">
                <span class="kpi-label">Predicted Next Count</span>
                <span class="kpi-value">{{ forecastData.predictedCount }}</span>
            </div>
        </div>
        
        <div class="kpi-detail-card">
            <TrendingUp :size="24" color="#4CAF50" />
            <div class="kpi-content">
                <span class="kpi-label">Average Base Count</span>
                <span class="kpi-value">{{ forecastData.averageAttendance }}</span>
            </div>
        </div>
        
        <div class="kpi-detail-card">
            <Calendar :size="24" color="#FF8F00" />
            <div class="kpi-content">
                <span class="kpi-label">Data Points Used</span>
                <span class="kpi-value">{{ forecastData.historicalCount }}</span>
            </div>
        </div>

        <p class="forecast-note">
            *Forecast is based on the rolling average of the last 5 weekend services.
        </p>
    </div>
</template>

<style scoped>
.insights-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    height: 100%;
}
.insights-title {
    font-size: 18px;
    font-weight: 700;
    color: #37474F;
    border-bottom: 2px solid #ECEFF1;
    padding-bottom: 12px;
    margin-top: 0;
    margin-bottom: 20px;
}

.kpi-detail-card {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    border-bottom: 1px solid #ECEFF1;
}

.kpi-content {
    display: flex;
    flex-direction: column;
}

.kpi-label {
    font-size: 13px;
    color: #78909C;
    font-weight: 500;
}

.kpi-value {
    font-size: 24px;
    font-weight: 700;
    color: #0D47A1;
}

.forecast-note {
    font-size: 12px;
    color: #546E7A;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px dashed #CFD8DC;
}
</style>