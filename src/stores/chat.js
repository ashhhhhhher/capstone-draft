import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../firebase'
import { 
  collection, doc, addDoc, setDoc, getDoc,
  query, where, orderBy, onSnapshot, 
  serverTimestamp, updateDoc
} from 'firebase/firestore'
import { useAuthStore } from './auth'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  
  // --- State ---
  const chats = ref([]) 
  const activeChatId = ref(null)
  const messages = ref([]) 
  const isLoadingMessages = ref(false)
  const shouldOpenChatBox = ref(false)
  
  let chatsUnsub = null
  let messagesUnsub = null

  // --- Computed ---
  
  const myId = computed(() => authStore.userProfile?.id)

  // Group Chats list (Manual Groups)
  const groupChats = computed(() => {
    return chats.value.filter(c => c.type === 'group').sort((a, b) => {
      const tA = a.lastMessage?.createdAt?.seconds || 0
      const tB = b.lastMessage?.createdAt?.seconds || 0
      return tB - tA
    })
  })

  // Private Chats list
  const privateChats = computed(() => {
    return chats.value.filter(c => c.type === 'private').sort((a, b) => {
      const tA = a.lastMessage?.createdAt?.seconds || 0
      const tB = b.lastMessage?.createdAt?.seconds || 0
      return tB - tA
    })
  })

  const activeChatDetails = computed(() => {
    if (!activeChatId.value) return null
    return chats.value.find(c => c.id === activeChatId.value)
  })

  const totalUnreadCount = computed(() => {
    if (!myId.value) return 0
    return chats.value.reduce((count, chat) => {
      const lm = chat.lastMessage
      if (lm && lm.senderId !== myId.value) {
        const readBy = lm.readBy || []
        if (!readBy.includes(myId.value)) {
          return count + 1
        }
      }
      return count
    }, 0)
  })

  // --- Helpers ---
  const getBranchChatsCollection = () => {
    if (!authStore.branchId) return null
    return collection(db, 'branches', authStore.branchId, 'chats')
  }

  // --- Actions ---

  function initChatListeners() {
    const colRef = getBranchChatsCollection()
    if (!colRef || !authStore.userProfile) return

    const mId = authStore.userProfile.id

    if (chatsUnsub) {
      if (typeof chatsUnsub === 'function') chatsUnsub()
      else if (Array.isArray(chatsUnsub)) chatsUnsub.forEach(u => u())
    }

    const qChats = query(
      colRef, 
      where('participants', 'array-contains', mId)
    )
    
    chatsUnsub = onSnapshot(qChats, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      chats.value = results
    })
  }

  async function selectChat(chatId) {
    if (activeChatId.value === chatId) return
    activeChatId.value = chatId
    shouldOpenChatBox.value = true
    await markAsRead(chatId)

    const colRef = getBranchChatsCollection()
    if (!colRef) return

    if (messagesUnsub) messagesUnsub()
    isLoadingMessages.value = true
    messages.value = []

    const msgsQuery = query(
      collection(colRef, chatId, 'messages'),
      orderBy('createdAt', 'asc')
    )

    messagesUnsub = onSnapshot(msgsQuery, (snapshot) => {
      messages.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      isLoadingMessages.value = false
      if (activeChatId.value === chatId) {
         markAsRead(chatId)
      }
    })
  }

  async function createGroupChat(name, participantIds) {
    const colRef = getBranchChatsCollection()
    const mId = authStore.userProfile.id
    if (!mId || !name) return
    const participants = Array.from(new Set([mId, ...participantIds]))
    
    const newChatData = {
      type: 'group',
      name: name,
      participants: participants,
      createdBy: mId,
      createdAt: serverTimestamp(),
      lastMessage: {
        text: `Group "${name}" created`,
        senderId: 'system',
        senderName: 'System',
        createdAt: serverTimestamp(),
        readBy: [mId]
      }
    }

    try {
      const docRef = await addDoc(colRef, newChatData)
      return docRef.id
    } catch (error) {
      console.error("Create group chat error:", error)
      throw error
    }
  }

  async function sendMessage(text) {
    if (!activeChatId.value || !text.trim()) return
    const colRef = getBranchChatsCollection()
    const mId = authStore.user?.uid || authStore.userProfile?.id
    const mName = `${authStore.userProfile?.firstName || authStore.user?.displayName || 'User'} ${authStore.userProfile?.lastName || ''}`
    
    if (!mId) {
      console.error("Cannot send message: user ID not available")
      return
    }
    
    const messagePayload = {
      text: text.trim(),
      senderId: mId,
      senderName: mName,
      createdAt: serverTimestamp(),
      readBy: [mId]
    }

    try {
      await addDoc(collection(colRef, activeChatId.value, 'messages'), messagePayload)
      const chatDocRef = doc(colRef, activeChatId.value)
      
      const lastMessageData = {
        text: text.trim(),
        senderId: mId,
        senderName: mName,
        createdAt: serverTimestamp(),
        readBy: [mId]
      }

      await updateDoc(chatDocRef, {
        lastMessage: lastMessageData
      })
    } catch (error) {
      console.error("Send message error:", error)
    }
  }

  async function markAsRead(chatId) {
    const chat = chats.value.find(c => c.id === chatId)
    if (!chat || !chat.lastMessage) return
    
    const readBy = chat.lastMessage.readBy || []
    if (readBy.includes(myId.value)) return

    const colRef = getBranchChatsCollection()
    if (!colRef) return

    try {
      const newReadBy = [...readBy, myId.value]
      await updateDoc(doc(colRef, chatId), {
        'lastMessage.readBy': newReadBy
      })
    } catch (e) {
    }
  }

  async function openPrivateChatWith(targetMember) {
    console.log('🔵 openPrivateChatWith called with:', targetMember)
    console.log('🔵 targetMember.id:', targetMember.id)
    
    // Use myId computed (which checks userProfile.id), fallback to user.uid which is always available
    let mId = myId.value || authStore.user?.uid
    let targetId = targetMember.id
    
    if (!mId || !targetId) {
      return
    }

    const existing = chats.value.find(c => 
      c.type === 'private' && 
      c.participants && 
      c.participants.includes(mId) && 
      c.participants.includes(targetId)
    )

    if (existing) {
      selectChat(existing.id)
      return
    }

    const colRef = getBranchChatsCollection()
    
    // Get current user details safely
    const currentUserName = authStore.userProfile?.firstName || authStore.user?.displayName || 'User'
    const currentUserPhoto = authStore.userProfile?.profilePicture || authStore.user?.photoURL || ''
    
    const newChatData = {
      type: 'private',
      participants: [mId, targetId],
      participantDetails: { 
        [mId]: { name: currentUserName, photo: currentUserPhoto },
        [targetId]: { name: `${targetMember.firstName}`, photo: targetMember.profilePicture || '' }
      },
      lastMessage: null,
      createdAt: serverTimestamp()
    }

    try {
      const docRef = await addDoc(colRef, newChatData)
      
      // Add the new chat to the store immediately so activeChat can find it
      const newChat = {
        id: docRef.id,
        ...newChatData
      }
      chats.value.push(newChat)
      
      selectChat(docRef.id)
    } catch (error) {
      console.error("Create private chat error:", error)
    }
  }

  function clearActiveChat() {
    activeChatId.value = null
    if (messagesUnsub) messagesUnsub()
    messages.value = []
  }

  function resetChatBoxSignal() {
    shouldOpenChatBox.value = false
  }

  return {
    chats,
    activeChatId,
    activeChatDetails,
    messages,
    groupChats, 
    privateChats,
    totalUnreadCount,
    isLoadingMessages,
    shouldOpenChatBox,
    initChatListeners,
    selectChat,
    sendMessage,
    openPrivateChatWith,
    createGroupChat, 
    clearActiveChat,
    resetChatBoxSignal,
    markAsRead
  }
})