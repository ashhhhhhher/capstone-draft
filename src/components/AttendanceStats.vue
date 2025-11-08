<script setup>
// This is a "prop" - it lets us pass data from the parent (Home.vue)
defineProps({
  title: String,
  count: Number
})

function showList() {
  // We'll make this navigate to the members list later
  alert("Showing attendance list for " + props.title)
}
</script>

<template>
  <div class="stat-card" @click="showList">
    <h3 class="title">{{ title }}</h3>
    <span class="count">{{ count }}</span>
  </div>
</template>

<style scoped>
.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #546E7A; /* Muted blue-gray */
}

.count {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: #0D47A1; /* Deep blue */
  margin-top: 8px;
}
</style>