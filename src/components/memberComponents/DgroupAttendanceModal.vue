<script setup>
import { reactive, onMounted, watch, ref } from 'vue'
import { useAttendanceStore } from '../../stores/attendance'
import { useMembersStore } from '../../stores/members'
import { useAuthStore } from '../../stores/auth'
import { ClipboardCheck } from 'lucide-vue-next'

const props = defineProps({
	group: { type: Object, required: true },
	members: { type: Array, required: true },
	meeting: { type: Object, required: false }
})
const emit = defineEmits(['close','saved'])

const attendanceStore = useAttendanceStore()
const membersStore = useMembersStore()
const authStore = useAuthStore()

const show = ref(true)
const showConfirm = ref(false)

const attendanceForm = reactive({
	date: props.meeting?.meetingDate || new Date().toISOString().split('T')[0],
	conversations: 0,
	evangelized: 0,
	guests: 0,
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
	// Prefer deriving members from the members store by group id
	let membersList = []
	if (props.group && props.group.dgroupId) {
		membersList = membersStore.activeMembers.filter(m => m.dgroupId === props.group.dgroupId)
	}
	// Fallback to props.members if store-based list is empty
	if (!membersList || membersList.length === 0) {
		membersList = props.members || []
	}

	membersList.forEach(m => {
		// m may be either a member object or an id string
		const memberId = m.id || m
		const storeMember = membersStore.activeMembers.find(am => am.id === memberId)
		const firstName = storeMember?.firstName || m.firstName || ''
		const lastName = storeMember?.lastName || m.lastName || ''
		const finalTags = storeMember?.finalTags || m.finalTags || {}
		const hasScanned = serviceScans.some(scan => scan.memberId === memberId)
		const autoTag = finalTags?.isDgroupLeader ? 'DL' : 'DM'
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

// Rebuild when props.members or the members store updates
// Rebuild when props.members, props.group, or the members store updates
watch([
	() => props.members,
	() => props.group,
	() => membersStore.activeMembers
], () => buildChecklist(), { immediate: true, deep: true })

// Keep attendance date in sync if a meeting prop is provided/changes
watch(() => props.meeting, (m) => {
	if (m && m.meetingDate) attendanceForm.date = m.meetingDate
}, { immediate: true })

function close() {
	show.value = false
	emit('close')
}

async function submitAttendance() {
	// determine dgroupId: prefer passed prop, fallback to auth profile
	const resolvedDgroupId = props.group?.dgroupId || props.group?.id || props.group?.dgroup || props.group?.groupId || authStore.userProfile?.dgroupId
	const payload = {
		dgroupId: resolvedDgroupId,
		meetingDate: attendanceForm.date,
		attendees: attendanceForm.attendees,
		conversations: attendanceForm.conversations || 0,
		evangelized: attendanceForm.evangelized || 0,
		guests: attendanceForm.guests || 0,
		locked: false
	}

	console.debug('Submitting Dgroup attendance payload:', payload, 'props.group:', props.group, 'auth.dgroupId:', authStore.userProfile?.dgroupId)

	try {
		const res = await attendanceStore.logDgroupMeeting(payload)
		if (res && res.status === 'success') {
			alert('Attendance logged successfully!')
			emit('saved', res)
			close()
			// reset stats
			attendanceForm.conversations = 0
			attendanceForm.evangelized = 0
			attendanceForm.guests = 0
		} else {
			alert(res?.message || 'Failed to save attendance.')
		}
	} catch (e) {
		console.error('Save Error:', e)
		alert('Error saving attendance.')
	}
}

function openEndMeetingConfirm() {
	showConfirm.value = true
}

function cancelEndMeeting() {
	showConfirm.value = false
}

async function confirmEndMeeting() {
	showConfirm.value = false
	await submitAttendance()
}
</script>

<template>
	<div v-if="show" class="modal-overlay">
		<div class="modal create-modal attendance-scroll-modal">
			<h3>Weekly Dgroup Report<span v-if="props.meeting"> - {{ props.meeting.meetingTitle || props.meeting.description || props.meeting.meetingDate }}</span></h3>
			<p class="modal-desc">Service scans from today are automatically checked.</p>

			<label class="section-label">Members & Status</label>
			<div class="attendance-checklist-updated">
				<div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
					<input type="checkbox" v-model="data.isPresent" />
					<div class="member-info-stack" style="flex: 1; margin-left: 8px;">
						<span class="member-name" :style="{ fontWeight: data.scanned ? '800' : '500' }">{{ data.name }}</span>
						<div v-if="data.scanned" style="color: #2E7D32; font-size: 10px; display: flex; align-items: center; gap: 2px;">
							<ClipboardCheck :size="10" /> VERIFIED SCAN
						</div>
					</div>
					<select v-model="data.tag" class="status-select" :disabled="!data.isPresent">
						<option value="DL">DL</option>
						<option value="DM">DM</option>
						<option value="NW">NW</option>
						<option value="NEW">NEW</option>
					</select>
				</div>
			</div>

			<div class="group-stats">
				<div class="stat-input">
					<label>Conv. (C)</label>
					<input type="number" v-model="attendanceForm.conversations" min="0" />
				</div>
				<div class="stat-input">
					<label>Evang. (E)</label>
					<input type="number" v-model="attendanceForm.evangelized" min="0" />
				</div>
				<div class="stat-input">
					<label>Guests (G)</label>
					<input type="number" v-model="attendanceForm.guests" min="0" />
				</div>
			</div>

			<div class="actions">
				<button @click="close" class="cancel">Cancel</button>
				<button @click="openEndMeetingConfirm" class="end-meeting">End Meeting</button>
			</div>

			<!-- Confirmation popup -->
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
/* reuse styles from MemberDgroup modal scope if needed; minimal local styles kept */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
.modal.create-modal { background: white; width: 90%; max-width: 560px; border-radius: 12px; padding: 18px; max-height: 90vh; overflow-y: auto; }
.attendance-scroll-modal { max-height: 80vh; }
.attendance-checklist-updated { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.attendance-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #fff; }
.group-stats { display:flex; gap:12px; margin-top:12px; }
.stat-input label { display:block; font-size:12px; color:#90A4AE; }
.stat-input input { width:80px; }
.actions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
.cancel { background:transparent; border:1px solid #E0E0E0; padding:8px 12px; border-radius:8px; }
.confirm { background:#2E7D32; color:white; padding:8px 12px; border-radius:8px; border:none; }
.end-meeting { background:#C62828; color:white; padding:8px 12px; border-radius:8px; border:none; }

/* Confirmation overlay styles */
.confirm-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 300; }
.confirm-box { background: white; padding: 18px; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.3); width: 90%; max-width: 420px; text-align: center; }
.confirm-text { font-weight: 700; margin-bottom: 12px; color: #263238; }
.confirm-actions { display:flex; gap: 8px; justify-content: center; }
.confirm-yes { background: #1976d2; color: white; padding: 8px 12px; border-radius: 8px; border: none; }
.confirm-no { background: transparent; border: 1px solid #E0E0E0; padding: 8px 12px; border-radius: 8px; }
</style>
