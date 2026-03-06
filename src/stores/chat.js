import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../firebase'
import { 
  collection, doc, addDoc, setDoc, getDoc, getDocs,
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
  
  const myId = computed(() => authStore.user?.uid || authStore.userProfile?.id)
  const myIds = computed(() => {
    const ids = [authStore.user?.uid, authStore.userProfile?.id].filter(Boolean)
    return Array.from(new Set(ids))
  })
  const isMineId = (id) => !!id && myIds.value.includes(id)
  const makePrivatePairKey = (a, b) => [a, b].filter(Boolean).sort().join('__')

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
    const sorted = chats.value.filter(c => c.type === 'private').sort((a, b) => {
      const tA = a.lastMessage?.createdAt?.seconds || 0
      const tB = b.lastMessage?.createdAt?.seconds || 0
      return tB - tA
    })

    const uniqueByCounterpart = new Map()
    for (const chat of sorted) {
      const counterpart = (chat.participants || []).find(p => !isMineId(p))
      const key = counterpart || chat.id
      if (!uniqueByCounterpart.has(key)) {
        uniqueByCounterpart.set(key, chat)
      }
    }

    return Array.from(uniqueByCounterpart.values())
  })

  const activeChatDetails = computed(() => {
    if (!activeChatId.value) return null
    return chats.value.find(c => c.id === activeChatId.value)
  })

  const totalUnreadCount = computed(() => {
    if (!myIds.value.length) return 0
    return chats.value.reduce((count, chat) => {
      const lm = chat.lastMessage
      if (lm && !isMineId(lm.senderId)) {
        const readBy = lm.readBy || []
        if (!readBy.some(id => isMineId(id))) {
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
    const ids = myIds.value
    if (!colRef || !ids.length) {
      chats.value = []
      return
    }

    if (chatsUnsub) {
      if (typeof chatsUnsub === 'function') chatsUnsub()
      else if (Array.isArray(chatsUnsub)) chatsUnsub.forEach(u => u())
    }

    const mergeMap = new Map()
    const unsubs = ids.map(id => {
      const qChats = query(
        colRef,
        where('participants', 'array-contains', id)
      )

      return onSnapshot(qChats, (snapshot) => {
        snapshot.docs.forEach(d => {
          mergeMap.set(d.id, { id: d.id, ...d.data() })
        })
        chats.value = Array.from(mergeMap.values())
      })
    })

    chatsUnsub = unsubs
  }

  async function selectChat(chatId) {
    const ids = myIds.value
    const chat = chats.value.find(c => c.id === chatId)
    const isParticipant = !!chat && Array.isArray(chat.participants) && chat.participants.some(p => ids.includes(p))
    if (!ids.length || !isParticipant) {
      return
    }

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
    const mId = myId.value
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
    const activeChat = chats.value.find(c => c.id === activeChatId.value)
    const mId = activeChat?.participants?.find(p => isMineId(p)) || myId.value
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
    const actorId = chat.participants?.find(p => isMineId(p)) || myId.value
    if (!actorId) return
    
    const readBy = chat.lastMessage.readBy || []
    if (readBy.some(id => isMineId(id))) return

    const colRef = getBranchChatsCollection()
    if (!colRef) return

    try {
      const newReadBy = [...readBy, actorId]
      await updateDoc(doc(colRef, chatId), {
        'lastMessage.readBy': newReadBy
      })
    } catch (e) {
    }
  }

  async function openPrivateChatWith(targetMember) {
    let mId = myId.value || authStore.user?.uid
    let targetId = targetMember.id
    const ids = myIds.value
    
    if (!mId || !targetId) {
      return
    }

    const pairKeys = ids.map(id => makePrivatePairKey(id, targetId))

    // First check local chats array
    let existing = chats.value.find(c => 
      c.type === 'private' && 
      c.participants && 
      (
        (c.participants.some(p => ids.includes(p)) && c.participants.includes(targetId)) ||
        (c.participantsKey && pairKeys.includes(c.participantsKey))
      )
    )

    if (existing) {
      selectChat(existing.id)
      return
    }

    // If not found locally, check Firestore directly (in case page was reloaded)
    const colRef = getBranchChatsCollection()
    if (!colRef) return
    
    try {
      // First, exact match by normalized participantsKey (prevents recreating same pair)
      for (const pairKey of pairKeys) {
        const qByKey = query(
          colRef,
          where('type', '==', 'private'),
          where('participantsKey', '==', pairKey)
        )
        const snapByKey = await getDocs(qByKey)
        if (!snapByKey.empty) {
          const d = snapByKey.docs[0]
          const existingInArray = chats.value.find(c => c.id === d.id)
          if (!existingInArray) chats.value.push({ id: d.id, ...d.data() })
          selectChat(d.id)
          return
        }
      }

      for (const id of ids) {
        const q = query(
          colRef,
          where('type', '==', 'private'),
          where('participants', 'array-contains', id)
        )
        const snapshot = await getDocs(q)

        for (const doc of snapshot.docs) {
          const data = doc.data()
          if (data.participants.includes(targetId)) {
            const existingInArray = chats.value.find(c => c.id === doc.id)
            if (!existingInArray) {
              chats.value.push({ id: doc.id, ...data })
            }
            selectChat(doc.id)
            return
          }
        }
      }
    } catch (e) {
      console.error('Error searching for existing chat:', e)
    }

    // No existing chat found, create new one
    // Get current user details safely
    const currentUserName = authStore.userProfile?.firstName || authStore.user?.displayName || 'User'
    const currentUserPhoto = authStore.userProfile?.profilePicture || authStore.user?.photoURL || ''
    
    const newChatData = {
      type: 'private',
      participants: [mId, targetId],
      participantsKey: makePrivatePairKey(mId, targetId),
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