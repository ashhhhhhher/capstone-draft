<script setup>
import { reactive, onMounted, watch, ref, computed } from 'vue'
import { useAttendanceStore } from '../../stores/attendance'
import { useMembersStore } from '../../stores/members'
import { useAuthStore } from '../../stores/auth'
import { useDgroupEventsStore } from '../../stores/dgroupevents'
import DatePicker from '../dgmComponents/DatePicker.vue'
import { ClipboardCheck } from 'lucide-vue-next'
import { generateWeekId, formatWeekIdDisplay, parseWeekId } from '../../utils/weeklyMeetingUtils'

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
const dgroupEventsStore = useDgroupEventsStore()

const isLeader = computed(() => {
    const user = authStore.userProfile
    if (user?.finalTags?.isDgroupLeader) return true
    const me = membersStore.activeMembers.find(m => m.id === user?.id)
    return !!(me && me.finalTags && me.finalTags.isDgroupLeader)
})

const show = ref(true)
const showConfirm = ref(false)
const loggingDate = ref(props.meeting?.meetingDate || new Date().toISOString().split('T')[0])
const todayYMD = ref(new Date().toISOString().split('T')[0])

const attendanceForm = reactive({
    attendees: {},
    guests: 0,
    evangelized: 0,
    campusDmember: 0
})

const meetingLoading = ref(false)
const hasSubmittedReport = ref(false)
const existingReport = ref(null)

// Compute the week ID based on logging date
const weekId = computed(() => generateWeekId(loggingDate.value))

const allowedDateMin = computed(() => {
    const { startDate } = parseWeekId(weekId.value)
    if (!startDate) return todayYMD.value
    return todayYMD.value > startDate ? todayYMD.value : startDate
})

const allowedDateMax = computed(() => {
    const { endDate } = parseWeekId(weekId.value)
    return endDate || undefined
})

watch([allowedDateMin, allowedDateMax], ([min, max]) => {
    if (!loggingDate.value) {
        loggingDate.value = min
        return
    }
    if (min && loggingDate.value < min) loggingDate.value = min
    if (max && loggingDate.value > max) loggingDate.value = max
}, { immediate: true })

// Check if a report was already submitted for this week
async function checkExistingReport() {
    if (!isLeader.value) return
    const leaderId = props.group?.dgroupLeaderId || props.meeting?.dgroupLeaderId || props.leaderId || authStore.userProfile?.id
    if (!leaderId) {
        hasSubmittedReport.value = false
        existingReport.value = null
        return
    }
    try {
        const existing = await attendanceStore.getDgroupMeetingReport(leaderId, weekId.value)
        existingReport.value = existing || null
        // Only mark as "submitted" if the report has submission metadata (submittedBy or submittedAt).
        // A meeting can exist in the database without being submitted yet.
        hasSubmittedReport.value = !!(existing && (existing.submittedBy))

        if (existing) {
            attendanceForm.guests = Number(existing.guests || 0)
            attendanceForm.evangelized = Number(existing.evangelized || 0)
            attendanceForm.campusDmember = Number(existing.campusDmember || 0)
        } else {
            // Reset when no report exists for this week to avoid stale values from prior week
            attendanceForm.guests = 0
            attendanceForm.evangelized = 0
            attendanceForm.campusDmember = 0
        }
    } catch (e) {
        console.error('Error checking existing report:', e)
        hasSubmittedReport.value = false
        existingReport.value = null
    }
}

async function buildChecklist() {
    meetingLoading.value = true
    const scanDate = loggingDate.value || todayYMD.value
    let serviceScans = []
    try {
        serviceScans = await attendanceStore.getAttendanceByDate(scanDate)
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

    // Check if we have an existing report to preserve attendance data
    const existingAttendees = existingReport.value?.attendees || {}

    membersList.forEach(m => {
        const memberId = m.id || m
        const storeMember = membersStore.activeMembers.find(am => am.id === memberId)
        const firstName = storeMember?.firstName || m.firstName || ''
        const lastName = storeMember?.lastName || m.lastName || ''
        const finalTags = storeMember?.finalTags || m.finalTags || {}
        const hasScanned = serviceScans.some(scan => scan.memberId === memberId)
        
        // Preserve attendance data from previous submission if member was marked present
        const autoTag = finalTags?.isDgroupLeader ? 'BDL' : 'BDM'
        const existingData = existingAttendees[memberId]
        
        checklist[memberId] = {
            name: `${firstName} ${lastName}`.trim(),
            isPresent: existingData?.isPresent ? true : hasScanned,
            scanned: hasScanned,
            tag: existingData?.tag || autoTag,
            locked: !!existingData?.isPresent
        }
    })
    attendanceForm.attendees = checklist
    meetingLoading.value = false
}

watch([
    () => props.members,
    () => props.group,
    () => membersStore.activeMembers,
    () => loggingDate.value
], async () => {
    await checkExistingReport()
    await buildChecklist()
}, { immediate: true, deep: true })

function close() {
    show.value = false
    emit('close')
}

async function submitAttendance() {
    if (!isLeader.value) return
    const resolvedLeaderId = props.group?.dgroupLeaderId || props.meeting?.dgroupLeaderId || props.leaderId || authStore.userProfile?.id
    const user = authStore.userProfile

    if (!resolvedLeaderId) {
        alert('Unable to submit report: missing leader ID.')
        return
    }

    const payload = {
        dgroupLeaderId: resolvedLeaderId,
        meetingWeekId: weekId.value,
        loggingDate: loggingDate.value,
        attendees: attendanceForm.attendees,
        evangelized: attendanceForm.evangelized || 0,
        guests: attendanceForm.guests || 0,
        campusDmember: attendanceForm.campusDmember || 0,
        locked: false,
        isResubmitted: hasSubmittedReport.value,
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

function openSubmitConfirm() { showConfirm.value = true }
function cancelSubmit() { showConfirm.value = false }
async function confirmSubmit() {
    showConfirm.value = false
    await submitAttendance()
}

async function cancelCurrentMeeting() {
    if (!isLeader.value) return

    if (hasSubmittedReport.value) return

    const dgroupLeaderId = props.group?.dgroupLeaderId || props.meeting?.dgroupLeaderId || props.leaderId || authStore.userProfile?.id

    if (!weekId.value || !dgroupLeaderId) {
        alert('Unable to cancel meeting: missing week ID or leader ID.')
        return
    }

    const ok = confirm(`Cancel this meeting for week ${formatWeekIdDisplay(weekId.value)}? This will delete the whole meeting record.`)
    if (!ok) return

    try {
        const res = await dgroupEventsStore.deleteDgroupEvent(dgroupLeaderId, weekId.value)
        if (res?.status === 'success') {
            close()
            return
        }
        alert(res?.message || 'Failed to cancel meeting.')
    } catch (e) {
        console.error('Cancel meeting error:', e)
        alert('Failed to cancel meeting.')
    }
}
</script>

<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal create-modal attendance-scroll-modal">
            <h3>Weekly Dgroup Report</h3>
            <p class="modal-desc">Log attendance for week: {{ formatWeekIdDisplay(weekId) }}</p>

            <div class="separator"></div>

            <div class="form-group">
                <label>Logging Date (within this week)</label>
                <DatePicker v-model="loggingDate" :min="allowedDateMin" :max="allowedDateMax" />
            </div>

            <div class="separator"></div>

            <label class="section-label">Members & Status</label>
            <div class="attendance-checklist-updated">
                <div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
                    <input type="checkbox" v-model="data.isPresent" :disabled="!isLeader || data.locked" />
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
                <button v-if="isLeader" @click="cancelCurrentMeeting" class="cancel-meeting" :disabled="hasSubmittedReport">
                    Cancel Meeting
                </button>
                <button v-if="isLeader" @click="openSubmitConfirm" :class="hasSubmittedReport ? 'resubmit-report' : 'submit-report'">
                    {{ hasSubmittedReport ? 'Re-submit Report' : 'Submit Report' }}
                </button>
            </div>

            <div v-if="!isLeader" class="info-note">Only Dgroup leaders can submit attendance.</div>

            <div v-if="showConfirm" class="confirm-overlay">
                <div class="confirm-box">
                    <p class="confirm-text">Are you sure you want to {{ hasSubmittedReport ? 'update' : 'submit' }} the report?</p>
                    <div class="confirm-actions">
                        <button @click="confirmSubmit" class="confirm-yes">Yes, {{ hasSubmittedReport ? 'update' : 'submit' }} report</button>
                        <button @click="cancelSubmit" class="confirm-no">Cancel</button>
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
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; }
.separator { height: 1px; background-color: #ECEFF1; margin: 16px 0; width: 98%; }
.attendance-checklist-updated { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.attendance-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: #FAFBFC; border: 1px solid #F1F3F5; }
.status-select { padding: 6px; border-radius: 8px; border: 1px solid #E0E0E0; background: white; font-size: 12px; }
.group-stats { display:flex; gap:12px; margin-top:12px; align-items: center; flex-wrap: wrap; }
.stat-input label { display:block; font-size:12px; color:#90A4AE; margin-bottom:4px }
.stat-input input { width:100px; padding:8px; border-radius:8px; border:1px solid #EDEFF1 }
.actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.cancel { background:transparent; border:1px solid #CFD8DC; padding:8px 14px; border-radius:8px; color:#37474F; font-weight:700 }
.cancel-meeting { background:#fff3e0; color:#e65100; padding:8px 14px; border-radius:8px; border:1px solid #ffcc80; font-weight:700 }
.cancel-meeting:disabled { background:#F1F5F9; color:#94A3B8; border-color:#E2E8F0; cursor:not-allowed; opacity:0.85 }
.submit-report { background:#2E7D32; color:white; padding:8px 14px; border-radius:8px; border:none; font-weight:700 }
.submit-report:hover { background:#1B5E20; }
.resubmit-report { background:#1976D2; color:white; padding:8px 14px; border-radius:8px; border:none; font-weight:700 }
.resubmit-report:hover { background:#1565C0; }
.confirm-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 300; background: rgba(2,6,23,0.45); }
.confirm-box { background: white; padding: 18px; border-radius: 12px; box-shadow: 0 8px 24px rgba(9,30,66,0.12); width: 92%; max-width: 460px; text-align: center; }
.confirm-text { font-weight: 800; margin-bottom: 14px; color: #263238; font-size: 15px }
.confirm-actions { display:flex; gap: 10px; justify-content: center; }
.confirm-yes { background: #1976D2; color: white; padding: 10px 14px; border-radius: 8px; border: none; font-weight: 800 }
.confirm-no { background: transparent; border: 1px solid #E0E0E0; padding: 10px 14px; border-radius: 8px; color:#37474F; font-weight:700 }
.info-note { margin-top:8px; color:#607D8B; font-size:13px; font-weight:600; }
</style>