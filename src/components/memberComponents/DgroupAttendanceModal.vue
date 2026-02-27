<script setup>
import { reactive, onMounted, watch, ref, computed } from 'vue'
import { useAttendanceStore } from '../../stores/attendance'
import { useMembersStore } from '../../stores/members'
import { useAuthStore } from '../../stores/auth'
import { db } from '../../firebase'
import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc, collection } from 'firebase/firestore'
import { Trash2 } from 'lucide-vue-next'

const props = defineProps({
    group: { type: Object, required: true },
    members: { type: Array, required: true },
    leaderId: { type: String, required: false },
    meeting: { type: Object, required: false } 
})
const emit = defineEmits(['close', 'saved', 'deleted'])

const attendanceStore = useAttendanceStore()
const membersStore = useMembersStore()
const authStore = useAuthStore()

const isLeader = computed(() => !!authStore.userProfile?.finalTags?.isDgroupLeader)
const show = ref(true)
const showConfirm = ref(false)
const showDeleteConfirm = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)

const attendanceForm = reactive({
    date: props.meeting?.meetingDate || new Date().toISOString().split('T')[0],
    g_count: props.meeting?.g_count || 0,
    cd_count: props.meeting?.cd_count || 0,
    e_count: props.meeting?.e_count || 0,
    attendees: {}
})

async function buildChecklist() {
    const today = new Date().toISOString().split('T')[0]
    let serviceScans = []
    try { serviceScans = await attendanceStore.getAttendanceByDate(today) } catch (e) {}
    const checklist = {}
    const resolvedLeaderId = props.leaderId || props.group?.dgroupLeaderId || authStore.userProfile?.id
    let membersList = membersStore.activeMembers.filter(m => m.dgroupLeaderId === resolvedLeaderId)
    if (membersList.length === 0 && props.members?.length > 0) {
        membersList = props.members.map(m => (typeof m === 'string' ? membersStore.activeMembers.find(am => am.id === m) : m)).filter(Boolean)
    }
    membersList.forEach(m => {
        const hasScanned = serviceScans.some(scan => scan.memberId === m.id)
        const savedData = props.meeting?.attendees?.[m.id]
        checklist[m.id] = { 
            name: `${m.firstName || ''} ${m.lastName || ''}`.trim(), 
            isPresent: savedData ? savedData.isPresent : hasScanned, 
            tag: savedData?.tag || (m.finalTags?.isDgroupLeader ? 'EDL' : 'EDM') 
        }
    })
    attendanceForm.attendees = checklist
}

watch([() => props.members, () => props.group], () => buildChecklist(), { immediate: true, deep: true })

const getPathInfo = () => {
    const lid = props.leaderId || props.group?.dgroupLeaderId || authStore.userProfile?.id
    const lName = (props.meeting?.leaderName || `${authStore.userProfile?.firstName || ''} ${authStore.userProfile?.lastName || ''}`).trim()
    const leaderDocId = `${lName.replace(/\s+/g, '')}_${lid}`
    return { lid, leaderDocId, lName }
}

async function deleteEvent() {
    if (!isLeader.value || isDeleting.value) return
    const eventId = props.meeting?.id || props.meeting?.docId || props.meeting?.meetingId
    if (!eventId) return
    const { leaderDocId } = getPathInfo()
    isDeleting.value = true
    try {
        await deleteDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId, 'Meetings', eventId))
        await updateDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId), { status: 'inactive', activeMeeting: null, lastActivity: serverTimestamp() })
        emit('deleted'); close()
    } catch (e) { console.error("Delete error:", e) } finally { isDeleting.value = false; showDeleteConfirm.value = false }
}

async function submitAttendance() {
    if (!isLeader.value || isSubmitting.value) return
    const { lid, leaderDocId, lName } = getPathInfo()
    const dgroupId = props.group?.dgroupId || props.meeting?.dgroupId || authStore.userProfile?.dgroupId
    if (!lid || !dgroupId) return 
    isSubmitting.value = true
    const eventId = props.meeting?.id || props.meeting?.docId || props.meeting?.meetingId || `Event_${Date.now()}`
    try {
        const finalPayload = {
            ...attendanceForm,
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            serverTimestamp: serverTimestamp(),
            leaderId: lid,
            leaderName: lName,
            meetingId: eventId,
            docType: 'event_entry', 
            dgroupId: dgroupId,
            meetingDate: attendanceForm.date
        }

        await setDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId), { 
            status: 'completed',
            lastActivity: serverTimestamp(),
            docType: 'leader_summary',
            lastMeetingSummary: { 
                date: attendanceForm.date, 
                totalAttendees: Object.values(attendanceForm.attendees).filter(a => a.isPresent).length, 
                submittedAt: new Date().toISOString() 
            },
            activeMeeting: null 
        }, { merge: true })

        await setDoc(doc(db, 'branches', 'baguio', 'dgroupEvents', leaderDocId, 'Meetings', eventId), finalPayload, { merge: true })
        emit('saved'); close()
    } catch (e) { console.error("Submit error:", e) } finally { isSubmitting.value = false }
}

function close() { show.value = false; emit('close') }
</script>

<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal create-modal attendance-scroll-modal">
            <div class="header-with-actions">
                <h3>Weekly Dgroup Report <span v-if="group?.name">- {{ group.name }}</span></h3>
                <button v-if="isLeader" @click="showDeleteConfirm = true" class="btn-icon-delete" title="Delete Event"><Trash2 :size="18" /></button>
            </div>
            <p class="modal-desc">Deadline: Monday 11:59 P.M. Submitting this will reflect in the DGM insights.</p>
            <div class="separator"></div>
            <label class="section-label">Attendance Checklist</label>
            <div v-if="Object.keys(attendanceForm.attendees).length === 0" class="placeholder-text">No members found.</div>
            <div class="attendance-checklist-updated">
                <div v-for="(data, id) in attendanceForm.attendees" :key="id" class="attendance-item">
                    <input type="checkbox" v-model="data.isPresent" />
                    <div class="member-info-stack" style="flex:1;margin-left:8px;"><span class="member-name">{{ data.name }}</span></div>
                    <select v-model="data.tag" class="status-select" :disabled="!data.isPresent">
                        <option value="EDL">EDL</option><option value="BDL">BDL</option><option value="EDM">EDM</option>
                        <option value="BDM">BDM</option><option value="E">E</option><option value="G">G</option><option value="CD">CD</option>
                    </select>
                </div>
            </div>
            <div class="separator"></div>
            <div class="group-stats">
                <div class="stat-input"><label>Guests (G)</label><input type="number" v-model="attendanceForm.g_count" /></div>
                <div class="stat-input"><label>Conv. (CD)</label><input type="number" v-model="attendanceForm.cd_count" /></div>
                <div class="stat-input"><label>Evang. (E)</label><input type="number" v-model="attendanceForm.e_count" /></div>
            </div>
            <div class="actions">
                <button @click="close" class="cancel">Close</button>
                <button @click="showConfirm = true" class="end-meeting" :disabled="isSubmitting || isDeleting">{{ isSubmitting ? 'Submitting...' : 'Submit to DGM' }}</button>
            </div>
            <div v-if="showConfirm" class="confirm-overlay">
                <div class="confirm-box">
                    <p>Confirm submission to DGM?</p>
                    <div class="confirm-actions"><button @click="submitAttendance" class="confirm-yes">Yes, submit</button><button @click="showConfirm = false" class="confirm-no">No</button></div>
                </div>
            </div>
            <div v-if="showDeleteConfirm" class="confirm-overlay">
                <div class="confirm-box">
                    <p>Delete this event? Action cannot be undone.</p>
                    <div class="confirm-actions"><button @click="deleteEvent" class="confirm-delete">Yes, delete</button><button @click="showDeleteConfirm = false" class="confirm-no">Cancel</button></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center}
.modal.create-modal{background:#fff;width:94%;max-width:680px;border-radius:12px;padding:25px;max-height:90vh;overflow-y:auto}
.header-with-actions{display:flex;justify-content:space-between;align-items:center}
.btn-icon-delete{background:transparent;border:none;color:#EF5350;cursor:pointer;padding:4px;border-radius:4px;transition:background 0.2s}
.btn-icon-delete:hover{background:#FFEBEE}
.separator{height:1px;background-color:#ECEFF1;margin:15px 0}
.modal-desc{font-size:12px;color:#607D8B;margin-top:4px}
.section-label{display:block;font-weight:700;font-size:13px;color:#37474F;margin-bottom:10px}
.attendance-checklist-updated{display:flex;flex-direction:column;gap:8px}
.attendance-item{display:flex;align-items:center;padding:8px;border-radius:8px;background:#FAFBFC;border:1px solid #F1F3F5}
.member-name{color:#3c4f58;font-size:14px;font-weight:500}
.status-select{padding:4px;border-radius:6px;border:1px solid #E0E0E0;font-size:12px}
.group-stats{display:flex;gap:10px;margin-top:12px}
.stat-input label{display:block;font-size:11px;color:#90A4AE;margin-bottom:2px}
.stat-input input{width:80px;padding:6px;border-radius:6px;border:1px solid #EDEFF1}
.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:15px}
.cancel{background:transparent;border:1px solid #CFD8DC;padding:8px 12px;border-radius:8px;cursor:pointer}
.end-meeting{background:#1976D2;color:white;padding:8px 12px;border-radius:8px;border:none;font-weight:700;cursor:pointer}
.confirm-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:300;background:rgba(2,6,23,0.45)}
.confirm-box{background:white;padding:20px;border-radius:12px;text-align:center;width:300px}
.confirm-actions{display:flex;gap:10px;justify-content:center;margin-top:15px}
.confirm-yes,.confirm-delete{background:#1976D2;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer}
.confirm-delete{background:#EF5350}
.confirm-no{background:#ECEFF1;border:none;padding:8px 16px;border-radius:6px;cursor:pointer}
</style>