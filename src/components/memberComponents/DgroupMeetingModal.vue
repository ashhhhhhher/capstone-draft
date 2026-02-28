<script setup>

import { ref, computed } from 'vue'

import Modal from '../dgmComponents/Modal.vue'

import DatePicker from '../dgmComponents/DatePicker.vue'

import { useAuthStore } from '../../stores/auth'

import { useDgroupEventsStore } from '../../stores/dgroupevents'



const show = ref(true)

const scheduleDate = ref('')

const scheduleTime = ref('')

const scheduleVenue = ref('')

const scheduleDescription = ref('')

const scheduleTitle = ref('')

const scheduleStatus = ref({ type: '', message: '' })



const emit = defineEmits(['close','scheduled'])

const authStore = useAuthStore()

const dgroupEventsStore = useDgroupEventsStore()



const isLeader = computed(() => {

  const user = authStore.userProfile

  if (user?.finalTags?.isDgroupLeader) return true

  // note: no membersStore here; rely on profile

  return false

})



function close() {

  emit('close')

}



async function handleScheduleSubmit() {

  if (!isLeader.value) {

    scheduleStatus.value = { type: 'error', message: 'Only Dgroup leaders can schedule meetings.' }

    return

  }

  if (!scheduleDate.value || !scheduleTime.value || !scheduleVenue.value) {

    scheduleStatus.value = { type: 'error', message: 'Please fill required fields (date, time, venue).' }

    return

  }



  const dgroupId = authStore.userProfile?.dgroupId

  if (!dgroupId) {

    scheduleStatus.value = { type: 'error', message: 'You are not assigned to a Dgroup.' }

    return

  }



  const payload = {

    meetingDate: scheduleDate.value,

    meetingTime: scheduleTime.value,

    venue: scheduleVenue.value,

    meetingTitle: scheduleTitle.value || scheduleDescription.value

  }



  const res = await dgroupEventsStore.createDgroupEvent(dgroupId, payload)

  if (res && res.status === 'success') {

    emit('scheduled')

    close()

  } else {

    scheduleStatus.value = { type: 'error', message: res?.message || 'Failed to schedule meeting.' }

  }

}

</script>



<template>

  <Modal @close="close">

    <div class="form-container">

      <div class="form-header">

        <h2>Schedule Weekly Dgroup Meeting</h2>

      </div>



      <div class="separator"></div>



      <div v-if="scheduleStatus.message" class="status-banner" :class="scheduleStatus.type">

        <span>{{ scheduleStatus.message }}</span>

      </div>



      <form class="form-body" @submit.prevent="handleScheduleSubmit">

        <div class="form-group">

          <label>Date</label>

          <DatePicker v-model="scheduleDate" required />

        </div>



        <div class="form-group">

          <label>Time</label>

          <input type="time" v-model="scheduleTime" required />

        </div>



        <div class="form-group">

          <label>Venue</label>

          <input v-model="scheduleVenue" required />

        </div>



        <div class="form-group">

          <label>Meeting Title</label>

          <input v-model="scheduleTitle" placeholder="e.g. Weekly Bible Study" />

        </div>



        <div class="actions" style="margin-top: 12px;">

          <button type="button" class="cancel" @click="close">Cancel</button>

          <button type="submit" class="confirm" :disabled="!isLeader">Schedule</button>

        </div>

        <div v-if="!isLeader" style="margin-top:8px;color:#607D8B;font-weight:600;">Only Dgroup leaders can schedule meetings.</div>

      </form>

    </div>

  </Modal>

</template>



<style scoped>

/* reuse styles from MemberHome's modal form if needed; minimal local styles */

.separator {

  height: 1px;

  background-color: #ECEFF1;

  margin: 16px 0;

  width: 98%;}

.form-container { padding: 8px 12px; }

.form-header h2 { margin: 0 0 8px 0; }

.form-group { margin-bottom: 8px; }

.form-group label { display:block; font-weight:700; font-size:12px; margin-bottom:4px }

.form-group input { width:95%; padding:8px; border-radius:6px; border:1px solid #E0E0E0 }

.actions { display:flex; justify-content:flex-end; gap:8px }

.cancel { background:#fff; border:1px solid #E0E0E0; padding:8px 12px; border-radius:6px }

.confirm { background:#1976D2; color:white; padding:8px 12px; border-radius:6px; border:none }

.status-banner { padding:8px; border-radius:6px; margin-bottom:8px }

.status-banner.error { background:#FFEBEE; color:#C62828 }

</style>