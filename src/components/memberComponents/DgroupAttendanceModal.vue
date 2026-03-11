<script setup>
import { reactive, onMounted, watch, ref, computed } from 'vue'
import { useAttendanceStore } from '../../stores/attendance'
import { useMembersStore } from '../../stores/members'
import { useAuthStore } from '../../stores/auth'
import { ClipboardCheck } from 'lucide-vue-next'

const props = defineProps({
    group: { type: Object, required: true },
    members: { type: Array, required: true },
    leaderId: { type: String, required: false },
    meeting: { type: Object, required: false }
})
const emit = defineEmits(['close','saved'])

const attendanceStore = useAttendanceStore()
const membersStore = useMembersStore()
const authStore = useAuthStore()

const isLeader = computed(() => {
    const user = authStore.userProfile
    if (user?.finalTags?.isDgroupLeader) return true
    const me = membersStore.activeMembers.find(m => m.id === user?.id)
    return !!(me && me.finalTags && me.finalTags.isDgroupLeader)
})

const show = ref(true)
const showConfirm = ref(false)

const attendanceForm = reactive({
    date: props.meeting?.meetingDate || new Date().toISOString().split('T')[0],
    guests: 0,
    evangelized: 0,
    campusDmember: 0,
    attendees: {}
})

const meetingLoading = ref(false)

async function buildChecklist() {
    meetingLoading.value = true
    const today = new Date().toISOString().split('T')[0]
    let serviceScans = []
    try {
        serviceScans = await attendanceStore.getAttendanceByDate(today)
    } catch (e) {
        console.error('Failed to fetch service scans:', e)
    }

    const checklist = {}
    let membersList = []
    
    function resolveLeaderId() {
      if (props.leaderId) return props.leaderId
      const user = authStore.userProfile
      if (!user) return null
      return user.finalTags?.isDgroupLeader ? user.id : (user.dgroupLeaderId || null)
    }

    const leaderPointer = resolveLeaderId()
    if (leaderPointer) {
        membersList = membersStore.activeMembers.filter(m => m.id === leaderPointer || m.dgroupLeaderId === leaderPointer)
    }
    if (!membersList || membersList.length === 0) {
        membersList = props.members || []
    }

    membersList.forEach(m => {
        const memberId = m.id || m
        const storeMember = membersStore.activeMembers.find(am => am.id === memberId)
        const firstName = storeMember?.firstName || m.firstName || ''
        const lastName = storeMember?.lastName || m.lastName || ''
        const finalTags = storeMember?.finalTags || m.finalTags || {}
        const hasScanned = serviceScans.some(scan => scan.memberId === memberId)
        
        // Logical default tag assignment
        const autoTag = finalTags?.isDgroupLeader ? 'BDL' : 'BDM'
        
        checklist[memberId] = {
            name: `${firstName} ${lastName}`.trim(),
            isPresent: hasScanned,
            scanned: hasScanned,
            tag: autoTag
        }
    })
    attendanceForm.attendees = checklist
    meetingLoading.value = false
}

watch([
    () => props.members,
    () => props.group,
    () => membersStore.activeMembers
], () => buildChecklist(), { immediate: true, deep: true })

watch(() => props.meeting, (m) => {
    if (m && m.meetingDate) attendanceForm.date = m.meetingDate
}, { immediate: true })

function close() {
    show.value = false
    emit('close')
}

async function submitAttendance() {
    if (!isLeader.value) return
    const resolvedLeaderId = props.group?.dgroupLeaderId
    const user = authStore.userProfile

    const payload = {
        dgroupLeaderId: resolvedLeaderId,
        meetingDate: attendanceForm.date,
        attendees: attendanceForm.attendees,
        evangelized: attendanceForm.evangelized || 0,
        guests: attendanceForm.guests || 0,
        campusDmember: attendanceForm.campusDmember || 0,
        locked: false,
        submittedById: user?.id,
        submittedBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    };

    try {
        const res = await attendanceStore.logDgroupMeeting(payload)
        if (res && res.status === 'success') {
            emit('saved', res)
            close()
        }
    } catch (e) {
        console.error('Save Error:', e)
    }
}

function openEndMeetingConfirm() { showConfirm.value = true }
function cancelEndMeeting() { showConfirm.value = false }
async function confirmEndMeeting() {
    showConfirm.value = false
    await submitAttendance()
}
</script>

<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal create-modal attendance-scroll-modal">
            <h3>Weekly Dgroup Report<span v-if="props.meeting"> - {{ props.meeting.meetingTitle || props.meeting.meetingDate }}</span></h3>
            <p class="modal-desc">Service scans from today are automatically checked.</p>

            <div class="separator"></div>

            <label class="section-label">Members & Status</label>
            <div class="attendance-checklist-updated">
                <div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
                    <input type="checkbox" v-model="data.isPresent" :disabled="!isLeader" />
                    <div class="member-info-stack" style="flex: 1; margin-left: 8px;">
                        <span class="member-name">{{ data.name }}</span>
                    </div>
                    <select v-model="data.tag" class="status-select" :disabled="!data.isPresent || !isLeader">
                        <option value="BDL">BDL (B1G DLeader)</option>
                        <option value="EDL">EDL (Elevate DLeader)</option>
                        <option value="BDM">BDM (B1G Member)</option>
                        <option value="EDM">EDM (Elevate Member)</option>
                        <option value="BN">BN (B1G New)</option>
                        <option value="EN">EN (Elevate New)</option>
                    </select>
                </div>
            </div>

            <div class="separator"></div>

            <div class="group-stats">
                <div class="stat-input">
                    <label>Campus Dmember (CD)</label>
                    <input type="number" v-model="attendanceForm.campusDmember" min="0" :disabled="!isLeader" />
                </div>
                <div class="stat-input">
                    <label>Evangelized (E)</label>
                    <input type="number" v-model="attendanceForm.evangelized" min="0" :disabled="!isLeader" />
                </div>
                <div class="stat-input">
                    <label>Guests (G)</label>
                    <input type="number" v-model="attendanceForm.guests" min="0" :disabled="!isLeader" />
                </div>
            </div>

            <div class="actions">
                <button @click="close" class="cancel">Close</button>
                <button v-if="isLeader" @click="openEndMeetingConfirm" class="end-meeting">End Meeting</button>
            </div>

            <div v-if="!isLeader" class="info-note">Only Dgroup leaders can submit attendance.</div>

            <div v-if="showConfirm" class="confirm-overlay">
                <div class="confirm-box">
                    <p class="confirm-text">Are you sure you want to end the meeting?</p>
                    <div class="confirm-actions">
                        <button @click="confirmEndMeeting" class="confirm-yes">Yes, submit report</button>
                        <button @click="cancelEndMeeting" class="confirm-no">No, not yet.</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; align-items: center; justify-content: center; }
.modal.create-modal { background: #ffffff; width: 94%; max-width: 680px; border-radius: 12px; padding: 30px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(9,30,66,0.08); }
.attendance-scroll-modal { max-height: 80vh; }
.modal h3 { margin: 0 0 8px 0; font-size: 18px; color: #263238; }
.modal-desc { margin: 6px 0 12px 0; color: #607D8B; font-size: 13px }
.separator { height: 1px; background-color: #ECEFF1; margin: 16px 0; width: 98%; }
.attendance-checklist-updated { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.attendance-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: #FAFBFC; border: 1px solid #F1F3F5; }
.status-select { padding: 6px; border-radius: 8px; border: 1px solid #E0E0E0; background: white; font-size: 12px; }
.group-stats { display:flex; gap:12px; margin-top:12px; align-items: center; flex-wrap: wrap; }
.stat-input label { display:block; font-size:12px; color:#90A4AE; margin-bottom:4px }
.stat-input input { width:100px; padding:8px; border-radius:8px; border:1px solid #EDEFF1 }
.actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.cancel { background:transparent; border:1px solid #CFD8DC; padding:8px 14px; border-radius:8px; color:#37474F; font-weight:700 }
.end-meeting { background:#C62828; color:white; padding:8px 14px; border-radius:8px; border:none; font-weight:700 }
.confirm-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 300; background: rgba(2,6,23,0.45); }
.confirm-box { background: white; padding: 18px; border-radius: 12px; box-shadow: 0 8px 24px rgba(9,30,66,0.12); width: 92%; max-width: 460px; text-align: center; }
.confirm-text { font-weight: 800; margin-bottom: 14px; color: #263238; font-size: 15px }
.confirm-actions { display:flex; gap: 10px; justify-content: center; }
.confirm-yes { background: #1976D2; color: white; padding: 10px 14px; border-radius: 8px; border: none; font-weight: 800 }
.confirm-no { background: transparent; border: 1px solid #E0E0E0; padding: 10px 14px; border-radius: 8px; color:#37474F; font-weight:700 }
.info-note { margin-top:8px; color:#607D8B; font-size:13px; font-weight:600; }
</style>