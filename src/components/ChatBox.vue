<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { useAuthStore } from '../stores/auth'
import { useMembersStore } from '../stores/members'
import { X, Send, Search, ChevronLeft, Plus, Users, Check } from 'lucide-vue-next'

const route = useRoute()
const chatStore = useChatStore()
const authStore = useAuthStore()
const membersStore = useMembersStore()

const isOpen = ref(false)
const activeTab = ref('groups') // 'groups' | 'messages'
const messageInput = ref('')
const messagesContainer = ref(null)
const searchQuery = ref('')
const showNewChatModal = ref(false)

// --- Group Creation State ---
const showCreateGroupModal = ref(false)
const newGroupName = ref('')
const groupSearchQuery = ref('')
const selectedMemberIds = ref([])

// Hide chat box entirely on auth pages (so it doesn't overlap transitions)
const hideChatBox = computed(() => {
  return ['/login', '/signup'].includes(route.path)
})

// Init listeners when profile is ready
watch(
  () => [authStore.user, authStore.userProfile, authStore.branchId],
  ([user, profile, branchId]) => {
    if (!user || !branchId) return
    
    try {
      chatStore.initChatListeners()
    } catch (e) {
      console.error("Chat init failed:", e)
    }
  },
  { immediate: true }
)

// Auto-open chat box when a chat is selected from elsewhere (e.g., Message button)
watch(
  () => chatStore.shouldOpenChatBox,
  (shouldOpen) => {
    if (shouldOpen) {
      isOpen.value = true
      // Reset the flag after opening
      setTimeout(() => {
        chatStore.resetChatBoxSignal()
      }, 100)
    }
  },
  { immediate: true }
)

watch(() => chatStore.messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}, { deep: true })

const myId = computed(() => authStore.user?.uid || authStore.userProfile?.id)
const myIds = computed(() => {
  const ids = [authStore.user?.uid, authStore.userProfile?.id].filter(Boolean)
  return Array.from(new Set(ids))
})
const isMineId = (id) => !!id && myIds.value.includes(id)

// --- CHAT LISTS ---
const groupChats = computed(() => chatStore.groupChats)
const privateChats = computed(() => chatStore.privateChats)
const activeChat = computed(() => chatStore.activeChatDetails)
const unreadCount = computed(() => chatStore.totalUnreadCount)

const filteredMembers = computed(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return membersStore.activeMembers.filter(m => 
    m.id !== myId.value && 
    (m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q))
  ).slice(0, 5)
})

const filteredMembersForGroup = computed(() => {
  const q = groupSearchQuery.value.toLowerCase()
  return membersStore.activeMembers.filter(m => 
    m.id !== myId.value && 
    (m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q))
  ).slice(0, 20) 
})

function toggleChat() {
  isOpen.value = !isOpen.value
}

function openChat(chatId) {
  chatStore.selectChat(chatId)
}

function startNewChat(member) {
  chatStore.openPrivateChatWith(member)
  showNewChatModal.value = false
  searchQuery.value = ''
}

function openCreateGroupModal() {
  showCreateGroupModal.value = true
  newGroupName.value = ''
  groupSearchQuery.value = ''
  selectedMemberIds.value = []
}

function toggleMemberSelection(id) {
  if (selectedMemberIds.value.includes(id)) {
    selectedMemberIds.value = selectedMemberIds.value.filter(mid => mid !== id)
  } else {
    selectedMemberIds.value.push(id)
  }
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) return
  await chatStore.createGroupChat(newGroupName.value, selectedMemberIds.value)
  showCreateGroupModal.value = false
}

function handleSend() {
  if (!messageInput.value.trim()) return
  chatStore.sendMessage(messageInput.value)
  messageInput.value = ''
}

function backToList() {
  chatStore.clearActiveChat()
}

function getChatName(chat) {
  if (chat.type === 'group') {
    return chat.name
  }
  if (chat.type === 'dgroup') return chat.name // Fallback for old types
  if (chat.participantDetails) {
    const otherId = chat.participants.find(p => !isMineId(p))
    if (otherId && chat.participantDetails[otherId]) {
      return chat.participantDetails[otherId].name
    }
  }
  return 'Chat'
}

function getChatAvatar(chat) {
  if (chat.type === 'group' || chat.type === 'dgroup') return null 
  if (chat.participantDetails) {
    const otherId = chat.participants.find(p => !isMineId(p))
    if (otherId && chat.participantDetails[otherId]) {
      return chat.participantDetails[otherId].photo
    }
  }
  return null
}

function isUnread(chat) {
  const lm = chat.lastMessage
  if (!lm || isMineId(lm.senderId)) return false
  return lm.readBy && !lm.readBy.some(id => isMineId(id))
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="chat-system" v-if="!hideChatBox">
    
    <!-- FLOATING TOGGLE BUTTON -->
    <button class="chat-fab" @click="toggleChat" :class="{ 'is-open': isOpen }">
      <template v-if="!isOpen">
        <img src="/qonnectchat.png" alt="Chat" class="q-logo" />
        <!-- Notification Badge (Red Dot) -->
        <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount }}</span>
      </template>
      <X v-else :size="28" color="white" />
    </button>

    <!-- CHAT WINDOW -->
    <transition name="slide-up">
      <div v-if="isOpen" class="chat-window">
        
        <!-- HEADER -->
        <div class="chat-header">
          <div class="header-left">
            <div class="header-icon-bg">
               <img src="/qonnectchat.png" alt="Q" />
            </div>
            <div class="header-info">
              <h3>Qonnect Chatbox</h3>
              <span class="status-dot"></span>
            </div>
          </div>
        </div>

        <!-- VIEW: CHAT THREAD -->
        <div v-if="activeChat" class="chat-view h-full">
          <div class="thread-header">
            <button class="back-btn" @click="backToList"><ChevronLeft :size="24" /></button>
            <div class="thread-title">
              <span class="t-name">{{ getChatName(activeChat) }}</span>
              <span class="t-status">{{ activeChat.type === 'private' ? 'Private' : 'Group Chat' }}</span>
            </div>
          </div>

          <div class="messages-area" ref="messagesContainer">
            <div v-if="chatStore.isLoadingMessages" class="loading-msg">Loading...</div>
            <div v-else-if="chatStore.messages.length === 0" class="empty-msg">No messages yet. Say hi! 👋</div>
            
            <div 
              v-for="msg in chatStore.messages" 
              :key="msg.id" 
              class="message-row"
              :class="{ 'mine': isMineId(msg.senderId) }"
            >
              <div v-if="!isMineId(msg.senderId) && (activeChat.type === 'group' || activeChat.type === 'dgroup')" class="sender-name">
                {{ msg.senderName.split(' ')[0] }}
              </div>
              <div class="bubble">
                {{ msg.text }}
                <span class="time">{{ formatTime(msg.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div class="input-area">
            <input 
              v-model="messageInput" 
              @keyup.enter="handleSend"
              placeholder="Type a message..." 
              type="text"
            />
            <button class="send-btn" @click="handleSend" :disabled="!messageInput.trim()">
              <Send :size="20" />
            </button>
          </div>
        </div>

        <!-- VIEW: LISTS (Tabs) -->
        <div v-else class="list-view h-full">
          
          <!-- Tabs -->
          <div class="tabs-segment">
            <button :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">Groups</button>
            <button :class="{ active: activeTab === 'messages' }" @click="activeTab = 'messages'">Messages</button>
          </div>

          <!-- Tab: Groups (Manual) -->
          <div v-if="activeTab === 'groups'" class="tab-body">
            
            <div class="search-bar-row">
               <button class="new-chat-btn" @click="openCreateGroupModal">
                 <Plus :size="16" /> Create Group Chat
               </button>
            </div>

            <div class="chat-list">
              <div v-for="chat in groupChats" :key="chat.id" class="chat-item" @click="openChat(chat.id)">
                <div class="avatar-box group-av"><Users :size="24" color="white" /></div>
                <div class="chat-info">
                  <h4>{{ chat.name }}</h4>
                  <p class="last-msg" :class="{ 'bold': isUnread(chat) }">
                    {{ chat.lastMessage ? `${chat.lastMessage.senderName.split(' ')[0]}: ${chat.lastMessage.text}` : 'No messages yet' }}
                  </p>
                </div>
                <div class="meta" v-if="chat.lastMessage">
                  <span>{{ formatTime(chat.lastMessage.createdAt) }}</span>
                  <div v-if="isUnread(chat)" class="dot-unread"></div>
                </div>
              </div>

              <div v-if="groupChats.length === 0" class="empty-state">
                <p>No group chats yet.</p>
              </div>
            </div>
          </div>

          <!-- Tab: Messages (Private) -->
          <div v-if="activeTab === 'messages'" class="tab-body">
            <div class="search-bar-row">
               <button class="new-chat-btn" @click="showNewChatModal = true">
                 <Plus :size="16" /> New Message
               </button>
            </div>

            <div class="chat-list">
              <div v-for="chat in privateChats" :key="chat.id" class="chat-item" @click="openChat(chat.id)">
                <div class="avatar-box">
                  <img v-if="getChatAvatar(chat)" :src="getChatAvatar(chat)" />
                  <span v-else>{{ getChatName(chat).charAt(0) }}</span>
                </div>
                <div class="chat-info">
                  <h4>{{ getChatName(chat) }}</h4>
                  <p class="last-msg" :class="{ 'bold': isUnread(chat) }">
                    {{ chat.lastMessage ? chat.lastMessage.text : 'Start chatting' }}
                  </p>
                </div>
                <div class="meta">
                  <span v-if="chat.lastMessage">{{ formatTime(chat.lastMessage.createdAt) }}</span>
                  <div v-if="isUnread(chat)" class="dot-unread"></div>
                </div>
              </div>
              <div v-if="privateChats.length === 0" class="empty-state">
                <p>No messages yet.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- NEW PRIVATE CHAT MODAL -->
        <div v-if="showNewChatModal" class="inner-modal">
           <div class="inner-header">
             <h4>New Message</h4>
             <button @click="showNewChatModal = false"><X :size="20" /></button>
           </div>
           <div class="search-wrapper">
             <Search :size="16" class="s-icon" />
             <input v-model="searchQuery" placeholder="Search members..." />
           </div>
           <div class="results-list">
             <div v-for="m in filteredMembers" :key="m.id" class="result-item" @click="startNewChat(m)">
               <div class="avatar-mini">{{ m.firstName.charAt(0) }}</div>
               <span>{{ m.firstName }} {{ m.lastName }}</span>
             </div>
             <div v-if="searchQuery && filteredMembers.length === 0" class="no-res">
                No members found.
             </div>
           </div>
        </div>

        <!-- CREATE GROUP MODAL -->
        <div v-if="showCreateGroupModal" class="inner-modal">
           <div class="inner-header">
             <h4>Create Group</h4>
             <button @click="showCreateGroupModal = false"><X :size="20" /></button>
           </div>
           
           <div class="group-create-form">
             <div class="form-group">
               <label>Group Name</label>
               <input v-model="newGroupName" placeholder="e.g. Worship Team" class="input-field" />
             </div>

             <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
               <label>Add Participants ({{ selectedMemberIds.length }})</label>
               <div class="search-wrapper small">
                 <Search :size="14" class="s-icon" />
                 <input v-model="groupSearchQuery" placeholder="Search to add..." />
               </div>
               
               <div class="results-list compact">
                 <div 
                   v-for="m in filteredMembersForGroup" 
                   :key="m.id" 
                   class="result-item" 
                   @click="toggleMemberSelection(m.id)"
                 >
                   <div class="check-circle" :class="{ 'checked': selectedMemberIds.includes(m.id) }">
                      <Check v-if="selectedMemberIds.includes(m.id)" :size="12" color="white" />
                   </div>
                   <div class="avatar-mini">{{ m.firstName.charAt(0) }}</div>
                   <span>{{ m.firstName }} {{ m.lastName }}</span>
                 </div>
               </div>
             </div>
           </div>

           <div class="inner-footer">
             <button class="create-btn" @click="handleCreateGroup" :disabled="!newGroupName.trim()">Create Group</button>
           </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<style scoped>
.chat-system { position: fixed; bottom: 24px; right: 24px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

.chat-fab { width: 65px; height: 65px; border-radius: 16px; background: transparent; border: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, background 0.2s, border-radius 0.2s; position: relative; z-index: 10001; padding: 0; }
.chat-fab:hover { transform: scale(1.05); }
.chat-fab.is-open { background: #ef4444; border-radius: 50%; transform: rotate(90deg); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }

.q-logo { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }

/* Notification Badge on FAB */
.notif-badge { 
  position: absolute; 
  top: -6px; 
  right: -6px; 
  background: #FF0000; 
  color: white; 
  font-size: 12px; 
  font-weight: 800; 
  min-width: 22px; 
  height: 22px; 
  border-radius: 11px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border: 2px solid white; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.2); 
}

.chat-window { position: absolute; bottom: 80px; right: 0; width: 360px; height: 600px; max-height: 80vh; background: #F8F9FA; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #ECEFF1; }
.chat-header { background: linear-gradient(135deg, #2962FF, #1565C0); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; color: white; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-icon-bg { width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.header-icon-bg img { width: 24px; height: 24px; }
.header-info h3 { margin: 0; font-size: 16px; font-weight: 700; }
.status-dot { display: inline-block; width: 8px; height: 8px; background: #00E676; border-radius: 50%; margin-right: 4px; }

.tabs-segment { display: flex; background: white; padding: 4px; margin: 16px 16px 8px 16px; border-radius: 12px; border: 1px solid #F1F5F9; }
.tabs-segment button { flex: 1; padding: 8px; border: none; background: transparent; border-radius: 8px; font-weight: 600; font-size: 13px; color: #64748B; cursor: pointer; transition: all 0.2s; }
.tabs-segment button.active { background: #2962FF; color: white; box-shadow: 0 2px 4px rgba(41,98,255,0.2); }

.list-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.tab-body { flex: 1; overflow-y: auto; padding: 0 16px 16px 16px; }
.search-bar-row { margin-bottom: 12px; }
.new-chat-btn { width: 100%; padding: 10px; background: #E3F2FD; color: #1976D2; border: none; border-radius: 12px; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.new-chat-btn:hover { background: #BBDEFB; }

.chat-item { display: flex; align-items: center; gap: 12px; background: white; padding: 12px; border-radius: 16px; margin-bottom: 8px; cursor: pointer; transition: transform 0.1s; border: 1px solid #F1F5F9; }
.chat-item:hover { transform: scale(1.02); border-color: #E3F2FD; }
.avatar-box { width: 44px; height: 44px; background: #F1F5F9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #64748B; overflow: hidden; flex-shrink: 0; }
.avatar-box img { width: 100%; height: 100%; object-fit: cover; }
.group-av { background: linear-gradient(135deg, #FF6F00, #FFB300); }
.chat-info { flex: 1; min-width: 0; }
.chat-info h4 { margin: 0 0 2px 0; font-size: 14px; font-weight: 700; color: #1E293B; }
.last-msg { margin: 0; font-size: 12px; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.last-msg.bold { font-weight: 700; color: #1E293B; }
.meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 10px; color: #CBD5E1; font-weight: 600; min-width: 40px; }
.dot-unread { width: 10px; height: 10px; background: #FF0000; border-radius: 50%; }

.chat-view { display: flex; flex-direction: column; height: 100%; background: white; }
.thread-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; gap: 12px; }
.back-btn { background: transparent; border: none; cursor: pointer; padding: 4px; color: #64748B; display: flex; }
.thread-title { display: flex; flex-direction: column; }
.t-name { font-weight: 700; font-size: 14px; color: #1E293B; }
.t-status { font-size: 11px; color: #94A3B8; }

.messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #F8FAFC; }
.message-row { display: flex; flex-direction: column; align-items: flex-start; max-width: 80%; }
.message-row.mine { align-self: flex-end; align-items: flex-end; }
.sender-name { font-size: 10px; color: #94A3B8; margin-bottom: 2px; margin-left: 10px; }
.bubble { padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.4; position: relative; word-wrap: break-word; }
.message-row.mine .bubble { background: #2962FF; color: white; border-bottom-right-radius: 4px; }
.message-row:not(.mine) .bubble { background: white; color: #334155; border: 1px solid #E2E8F0; border-bottom-left-radius: 4px; }
.bubble .time { font-size: 9px; opacity: 0.7; display: block; text-align: right; margin-top: 4px; }

.input-area { padding: 12px; border-top: 1px solid #F1F5F9; display: flex; gap: 8px; background: white; }
.input-area input { flex: 1; border: 1px solid #E2E8F0; border-radius: 20px; padding: 10px 16px; font-size: 14px; outline: none; }
.input-area input:focus { border-color: #2962FF; }
.send-btn { background: #2962FF; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.send-btn:disabled { background: #E2E8F0; cursor: default; }

.inner-modal { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 10; display: flex; flex-direction: column; }
.inner-header { padding: 16px; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center; }
.inner-header h4 { margin: 0; font-size: 16px; font-weight: 700; }
.inner-header button { border: none; background: none; cursor: pointer; }
.search-wrapper { padding: 16px; display: flex; align-items: center; position: relative; }
.search-wrapper.small { padding: 12px 0; }
.s-icon { position: absolute; left: 28px; color: #94A3B8; }
.search-wrapper.small .s-icon { left: 12px; }
.search-wrapper input { width: 100%; padding: 10px 10px 10px 36px; border-radius: 12px; border: 1px solid #E2E8F0; outline: none; }
.search-wrapper.small input { padding-left: 32px; font-size: 13px; }

.results-list { flex: 1; overflow-y: auto; padding: 0 16px; }
.results-list.compact { padding: 0; }
.result-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #F8FAFC; cursor: pointer; }
.result-item:hover { background: #F8FAFC; }
.avatar-mini { width: 32px; height: 32px; background: #E3F2FD; color: #1976D2; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.no-res { text-align: center; padding: 20px; color: #94A3B8; font-size: 13px; }

/* Group Create Specifics */
.group-create-form { flex: 1; padding: 16px; display: flex; flex-direction: column; overflow: hidden; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 6px; }
.input-field { width: 100%; padding: 12px; border: 1px solid #E2E8F0; border-radius: 12px; outline: none; font-size: 14px; }
.input-field:focus { border-color: #2962FF; }
.check-circle { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #E2E8F0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.check-circle.checked { background: #2962FF; border-color: #2962FF; }
.inner-footer { padding: 16px; border-top: 1px solid #F1F5F9; }
.create-btn { width: 100%; padding: 12px; background: #2962FF; color: white; font-weight: 700; border-radius: 12px; border: none; cursor: pointer; }
.create-btn:disabled { background: #E2E8F0; cursor: not-allowed; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
/* Slightly adjusted animation to look smooth with fixed positioning */
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(40px) scale(0.98); opacity: 0; }
.h-full { height: 100%; }
.loading-msg, .empty-msg { text-align: center; color: #94A3B8; margin-top: 40px; font-size: 13px; }
.empty-state { text-align: center; color: #94A3B8; padding: 40px 20px; font-size: 13px; }

/* ==========================================================
   RESPONSIVE OVERHAUL (MOBILE)
   ========================================================== */
@media (max-width: 768px) { 
  .chat-system { 
    bottom: 80px; 
    right: 16px; 
  } 
  
  .chat-window {
    /* Fixed positioning escapes the bottom-right container logic, 
       ensuring it respects the entire screen bounds */
    position: fixed; 
    bottom: 160px; /* Floats perfectly above the red chat button/nav */
    right: 16px;
    left: 16px; /* Explicitly forces a 16px margin on BOTH sides */
    width: auto; /* Overrides the rigid 360px desktop width */
    height: calc(100vh - 190px); /* Dynamically fills vertical space safely */
    max-height: 550px;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  }
}
</style>