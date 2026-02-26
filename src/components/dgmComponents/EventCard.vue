<script setup>
defineProps({ event: { type: Object, required: true } });
const emit = defineEmits(['click']);
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return { day: date.getDate(), month: date.toLocaleDateString('en-US', { month: 'short' }), full: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
}
</script>

<template>
  <div class="event-card-v2" @click="emit('click', event)">
    <div class="image-bg-container">
      <img v-if="event.photoURL" :src="event.photoURL" alt="Event" class="event-img" />
      <div v-else class="event-placeholder-v2"><div class="mesh-gradient"></div></div>
      <div class="card-overlay"></div>
      <div class="floating-header">
        <div class="date-badge">
          <span class="m">{{ formatShortDate(event.date).month }}</span>
          <span class="d">{{ formatShortDate(event.date).day }}</span>
        </div>
        <div class="type-pill" :class="event.eventType">
          {{ event.eventType === 'service' ? 'WKND' : (event.eventType === 'b1g_event' ? 'B1G' : 'CCF') }}
        </div>
      </div>
      <div class="card-content-overlay">
        <div class="meta-row">
          <span class="time-chip" v-if="event.time">🕒{{ event.time }}</span>
        </div>
        <h4 class="title-text">{{ event.name }}</h4>
        <div class="location-footer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="loc-text">{{ event.eventLocation || 'Main Hall' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-card-v2 { border-radius: 28px; overflow: hidden; cursor: pointer; position: relative; height: 320px; transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3); }
.event-card-v2:hover { transform: translateY(-10px) scale(1.02); box-shadow: 0 20px 40px -5px rgba(0,0,0,0.4); }
.image-bg-container { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; }
.event-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s ease; }
.event-card-v2:hover .event-img { transform: scale(1.15); }
.event-placeholder-v2 { height: 100%; width: 100%; background: #1e293b; }
.mesh-gradient { position: absolute; inset: 0; background: radial-gradient(at 0% 0%, #3b82f6 0%, transparent 70%), radial-gradient(at 100% 100%, #1e3a8a 0%, transparent 70%); opacity: 0.6; }
.card-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.95) 100%); z-index: 1; }
.floating-header { position: absolute; top: 16px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: flex-start; z-index: 2; }
.date-badge { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); padding: 8px 12px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; min-width: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.date-badge .m { font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; }
.date-badge .d { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; }
.type-pill { padding: 6px 14px; border-radius: 12px; font-size: 10px; font-weight: 900; color: #fff; text-transform: uppercase; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2); }
.type-pill.service { background: rgba(59, 130, 246, 0.8); } .type-pill.b1g_event { background: rgba(239, 68, 68, 0.8); } .type-pill.ccf { background: rgba(15, 23, 42, 0.8); }
.card-content-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px; z-index: 2; color: white; }
.meta-row { margin-bottom: 8px; }
.time-chip { font-size: 11px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
.title-text { font-size: 22px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.2; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.location-footer { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 600; }
.loc-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>