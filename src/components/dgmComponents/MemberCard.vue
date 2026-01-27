<script setup>
import { computed } from 'vue'

const props = defineProps({
  member: Object,
  isPresent: Boolean,
  hideStatus: Boolean, // New prop to hide the status section
  hideDetails: Boolean
})

const initials = computed(() => {
  if (!props.member?.firstName) return '?'
  return props.member.firstName[0] + (props.member.lastName?.[0] || '')
})

// Generate a consistent pastel color based on member ID or name
const avatarColor = computed(() => {
   if (props.member?.avatarColor) return props.member.avatarColor
   const colors = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'];
   let hash = 0;
   const str = props.member.id || (props.member.firstName + props.member.lastName);
   for (let i = 0; i < str.length; i++) {
     hash = str.charCodeAt(i) + ((hash << 5) - hash);
   }
   return colors[Math.abs(hash) % colors.length];
})

const statusColor = computed(() => props.isPresent ? '#4CAF50' : '#F44336')
const statusText = computed(() => props.isPresent ? 'Present' : 'Absent')

// Helper to get the correct image source
const profileImageSrc = computed(() => {
  return props.member?.profilePicture || props.member?.photoURL || null
})
</script>

<template>
  <div class="member-card">
    <!-- Updated Avatar: Checks profilePicture first, then photoURL -->
    <img 
      v-if="profileImageSrc" 
      :src="profileImageSrc" 
      class="avatar is-img" 
      alt="Profile"
    />
    <div v-else class="avatar" :style="{ backgroundColor: avatarColor }">
      {{ initials }}
    </div>
    
    <div class="info">
      <div class="name-row">
        <span class="name">{{ member.firstName }} {{ member.lastName }}</span>
        <!-- Tags -->
        <span v-if="member.finalTags?.isDgroupLeader" class="tag dl">DL</span>
        <span v-else-if="member.finalTags?.isVolunteer" class="tag vol">Vol</span>
      </div>
      <div v-if="!hideDetails" class="details">
        {{ member.finalTags?.ageCategory }} • {{ member.gender }}
        <!-- Updated Label to DL -->
        <span v-if="member.dgroupLeader"> • DL: {{ member.dgroupLeader }}</span>
      </div>
    </div>

    <!-- Status Indicator: Only shown if hideStatus is false -->
    <div v-if="!hideStatus" class="status">
       <span class="dot" :style="{ backgroundColor: statusColor }"></span>
       <span class="status-text" :style="{ color: statusColor }">{{ statusText }}</span>
    </div>
  </div>
</template>

<style scoped>
.member-card {
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  /* Border styling handled by parent class member-card-item in Members.vue */
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 96%;
}

.member-card:hover {
  background-color: #F5F7FA;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #455A64;
  font-size: 14px;
  flex-shrink: 0;
}

/* New style for image avatar */
.avatar.is-img {
  object-fit: cover;
  background-color: #ECEFF1;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name {
  font-weight: 600;
  color: #37474F;
  font-size: 14px;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.tag.dl { background: #E3F2FD; color: #1976D2; }
.tag.vol { background: #E8F5E9; color: #2E7D32; }

.details {
  font-size: 12px;
  color: #90A4AE;
  margin-top: 2px;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-text {
  font-size: 12px;
  font-weight: 600;
}
</style>