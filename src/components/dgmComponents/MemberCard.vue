<script setup>
import { computed } from 'vue'

const props = defineProps({
  member: Object,
  isPresent: Boolean 
})

const leaderDisplay = computed(() => {
  // 1. If they have a leader, show the leader's name
  if (props.member.dgroupLeader) {
    return props.member.dgroupLeader;
  }
  
  // 2. If they DON'T have a leader, but they ARE a leader
  if (props.member.finalTags.isDgroupLeader) {
    return 'N/A (Leader)';
  }

  // 3. If they are a First Timer
  if (props.member.finalTags.isFirstTimer) {
    return 'N/A (First Timer)';
  }
  
  // 4. Any other case (e.g., a Regular with no leader)
  return 'N/A (Unassigned)';
})
</script>

<template>
  <div class="member-card">
    <div class="member-info">
      <h3 class="member-name">{{ member.firstName }} {{ member.lastName }}</h3>
      <div class="member-details">
        <div class="detail-item">
          <span class="label">Leader:</span>
          <span class="value">{{ leaderDisplay }}</span>
        </div>
      </div>
    </div>
    
    <div class="attendance-status">
      <span 
        class="status-dot" 
        :class="isPresent ? 'is-present' : 'is-absent'"
      ></span>
      <span>{{ isPresent ? 'Present' : 'Absent' }}</span>
    </div>
  </div>
</template>

<style scoped>
.member-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}
.member-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.member-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.member-details {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.detail-item {
  display: flex;
  align-items: center;
  font-size: 14px;
}
.detail-item .label {
  color: #546E7A;
  margin-right: 4px;
}
.detail-item .value {
  color: #333;
  font-weight: 500;
}
.attendance-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.is-present {
  background-color: #4CAF50; 
  color: #2E7D32;
}
.status-dot.is-absent {
  background-color: #F44336; 
  color: #C62828;
}
/* This makes the text color match the dot */
.is-present + span { color: #2E7D32; }
.is-absent + span { color: #C62828; }
</style>