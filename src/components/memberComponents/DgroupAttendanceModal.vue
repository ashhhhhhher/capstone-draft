<script setup>
import { reactive, onMounted, watch, ref, computed } from 'vue'
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
	if (!isLeader.value) {
		alert('Only Dgroup leaders can submit attendance.')
		return
	}
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

			<div class="separator"></div>

			<label class="section-label">Members & Status</label>
			<div class="attendance-checklist-updated">
				<div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
					<input type="checkbox" v-model="data.isPresent" :disabled="!isLeader" />
					<div class="member-info-stack" style="flex: 1; margin-left: 8px;">
						<span class="member-name" :style="{ fontWeight: data.scanned ? '400' : '400' }">{{ data.name }}</span>
						<div v-if="data.scanned" style="color: #2E7D32; font-size: 10px; display: flex; align-items: center; gap: 2px;">
							<ClipboardCheck :size="10" /> VERIFIED SCAN
						</div>
					</div>
					<select v-model="data.tag" class="status-select" :disabled="!data.isPresent || !isLeader">
						<option value="DL">DL</option>
						<option value="DM">DM</option>
						<option value="NW">NW</option>
						<option value="NEW">NEW</option>
					</select>
				</div>
			</div>

			<div class="separator"></div>

									<div class="group-stats">
				<div class="stat-input">
					<label>Conv. (C)</label>
										<input type="number" v-model="attendanceForm.conversations" min="0" :disabled="!isLeader" />
				</div>
				<div class="stat-input">
					<label>Evang. (E)</label>
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

			<div v-if="!isLeader" class="info-note" style="margin-top:8px;color:#607D8B;font-size:13px;font-weight:600;">Only Dgroup leaders can submit attendance; members can view meeting details.</div>

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
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: flex; align-items: center; justify-content: center; }
.modal.create-modal { background: #ffffff; width: 94%; max-width: 680px; border-radius: 12px; padding: 30px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(9,30,66,0.08); }
.attendance-scroll-modal { max-height: 80vh; }
.modal h3 { margin: 0 0 8px 0; font-size: 18px; color: #263238; }
.modal-desc { margin: 6px 0 12px 0; color: #607D8B; font-size: 13px }
.status-banner { padding: 10px; border-radius: 8px; margin-bottom: 12px; font-weight: 700; }
.status-banner.error { background: #FFEBEE; color: #C62828 }

.separator {
  height: 1px;
  background-color: #ECEFF1;
  margin: 16px 0;
  width: 98%;}

.attendance-checklist-updated { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.attendance-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: #FAFBFC; border: 1px solid #F1F3F5; }
.attendance-item:hover { background: #F7F9FB; }
.attendance-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #1976D2; }
.member-info-stack { display:flex; flex-direction:column; }
.member-name { color: #3c4f58; font-size: small;}
.status-select { padding: 6px; border-radius: 8px; border: 1px solid #E0E0E0; background: white; font-weight: 100; }

.group-stats { display:flex; gap:12px; margin-top:12px; align-items: center }
.stat-input label { display:block; font-size:12px; color:#90A4AE; margin-bottom:4px }
.stat-input input { width:100px; padding:8px; border-radius:8px; border:1px solid #EDEFF1 }

.actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.cancel { background:transparent; border:1px solid #CFD8DC; padding:8px 14px; border-radius:8px; color:#37474F; font-weight:700 }
.end-meeting { background:#C62828; color:white; padding:8px 14px; border-radius:8px; border:none; font-weight:700 }

/* Confirmation overlay styles */
.confirm-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 300; background: rgba(2,6,23,0.45); }
.confirm-box { background: white; padding: 18px; border-radius: 12px; box-shadow: 0 8px 24px rgba(9,30,66,0.12); width: 92%; max-width: 460px; text-align: center; }
.confirm-text { font-weight: 800; margin-bottom: 14px; color: #263238; font-size: 15px }
.confirm-actions { display:flex; gap: 10px; justify-content: center; }
.confirm-yes { background: #1976D2; color: white; padding: 10px 14px; border-radius: 8px; border: none; font-weight: 800 }
.confirm-no { background: transparent; border: 1px solid #E0E0E0; padding: 10px 14px; border-radius: 8px; color:#37474F; font-weight:700 }

@media (max-width: 600px) {
	.modal.create-modal { padding: 14px; }
	.stat-input input { width:80px }
	.attendance-item { padding: 8px; gap: 8px }
}
</style>
