import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../firebase'
import {
  collection, doc, addDoc, getDocs,
  query, where, orderBy, onSnapshot,
  serverTimestamp, updateDoc
} from 'firebase/firestore'
import { useAuthStore } from './auth'

export const useChatStore = defineStore('chat', () => {

  const authStore = useAuthStore()

  // STATE
  const chats = ref([])
  const activeChatId = ref(null)
  const messages = ref([])
  const isLoadingMessages = ref(false)
  const shouldOpenChatBox = ref(false)

  let chatsUnsub = null
  let messagesUnsub = null


  // COMPUTED

  const myId = computed(() =>
    authStore.user?.uid || authStore.userProfile?.id
  )
  const myIds = computed(() => {
    const ids = [authStore.user?.uid, authStore.userProfile?.id].filter(Boolean)
    return Array.from(new Set(ids))
  })
  const isMineId = (id) => !!id && myIds.value.includes(id)

  const groupChats = computed(() =>
    chats.value
      .filter(c => c.type === 'group')
      .sort((a, b) => (b.lastMessage?.createdAt?.seconds || 0) - (a.lastMessage?.createdAt?.seconds || 0))
  )

  const privateChats = computed(() =>
    chats.value
      .filter(c => c.type === 'private')
      .sort((a, b) => (b.lastMessage?.createdAt?.seconds || 0) - (a.lastMessage?.createdAt?.seconds || 0))
  )

  const activeChatDetails = computed(() =>
    chats.value.find(c => c.id === activeChatId.value)
  )

  const totalUnreadCount = computed(() => {

    if (!myIds.value.length) return 0

    return chats.value.reduce((count, chat) => {

      const lm = chat.lastMessage
      if (!lm) return count

      if (!isMineId(lm.senderId) && !(lm.readBy || []).some(rid => isMineId(rid))) {
        return count + 1
      }

      return count

    }, 0)

  })


  // HELPERS

  const getBranchChatsCollection = () => {

    if (!authStore.branchId) return null

    return collection(
      db,
      'branches',
      authStore.branchId,
      'chats'
    )

  }


  // CHAT LISTENER

  function initChatListeners() {

    const colRef = getBranchChatsCollection()
    const ids = myIds.value

    if (!colRef || !ids.length) {
      chats.value = []
      return
    }

    if (chatsUnsub) {
      if (Array.isArray(chatsUnsub)) chatsUnsub.forEach(u => u && u())
      else chatsUnsub()
    }

    const merged = new Map()
    const unsubs = ids.map(id => {
      const qChats = query(
        colRef,
        where('participants', 'array-contains', id)
      )

      return onSnapshot(
        qChats,
        snapshot => {
          snapshot.docs.forEach(d => {
            merged.set(d.id, {
              id: d.id,
              ...d.data()
            })
          })
          chats.value = Array.from(merged.values())
        },
        err => {
          if (err?.code !== 'permission-denied') {
            console.error('chat list onSnapshot error:', err)
          }
        }
      )
    })

    chatsUnsub = unsubs

  }


  // SELECT CHAT

  async function selectChat(chatId) {

    if (!authStore.branchId) return

    const chat = chats.value.find(c => c.id === chatId)

    if (!chat || !chat.participants?.some(pid => isMineId(pid))) return

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

    messagesUnsub = onSnapshot(
      msgsQuery,
      snapshot => {

        messages.value = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))

        isLoadingMessages.value = false

        if (activeChatId.value === chatId) {
          markAsRead(chatId)
        }

      },
      err => {
        if (err?.code !== 'permission-denied') {
          console.error('chat messages onSnapshot error:', err)
        }
      }
    )

  }


  // SEND MESSAGE

  async function sendMessage(text) {

    if (!activeChatId.value || !text.trim()) return

    const colRef = getBranchChatsCollection()
    const activeChat = chats.value.find(c => c.id === activeChatId.value)
    const id = activeChat?.participants?.find(pid => isMineId(pid)) || myId.value

    if (!colRef || !id) return

    const name =
      authStore.userProfile?.firstName ||
      authStore.user?.displayName ||
      'User'

    const messagePayload = {

      text: text.trim(),
      senderId: id,
      senderName: name,
      createdAt: serverTimestamp(),
      readBy: [id]

    }

    await addDoc(
      collection(colRef, activeChatId.value, 'messages'),
      messagePayload
    )

    await updateDoc(
      doc(colRef, activeChatId.value),
      { lastMessage: messagePayload }
    )

  }


  // MARK AS READ

  async function markAsRead(chatId) {

    const chat = chats.value.find(c => c.id === chatId)
    const id = chat?.participants?.find(pid => isMineId(pid)) || myId.value

    if (!chat || !chat.lastMessage || !id) return

    const readBy = chat.lastMessage.readBy || []

    if (readBy.some(rid => isMineId(rid))) return

    const colRef = getBranchChatsCollection()
    if (!colRef) return

    await updateDoc(
      doc(colRef, chatId),
      {
        'lastMessage.readBy': [...readBy, id]
      }
    )

  }


  // CREATE GROUP CHAT

  async function createGroupChat(name, participantIds) {

    const colRef = getBranchChatsCollection()
    const id = myId.value

    if (!colRef || !id || !name) return

    const participants = [...new Set([id, ...participantIds])]

    const chatData = {

      type: 'group',
      name,
      participants,
      createdBy: id,
      createdAt: serverTimestamp(),

      lastMessage: {
        text: `Group "${name}" created`,
        senderId: 'system',
        senderName: 'System',
        createdAt: serverTimestamp(),
        readBy: [id]
      }

    }

    const docRef = await addDoc(colRef, chatData)

    return docRef.id

  }


  // OPEN PRIVATE CHAT

  async function openPrivateChatWith(targetMember) {

    const colRef = getBranchChatsCollection()
    const id = myId.value
    const ids = myIds.value

    if (!colRef || !id || !targetMember?.id) return

    const targetId = targetMember.id

    // check existing chat locally
    const existing = chats.value.find(c =>
      c.type === 'private' &&
      c.participants?.some(pid => ids.includes(pid)) &&
      c.participants?.includes(targetId)
    )

    if (existing) {
      selectChat(existing.id)
      return
    }

    // check firestore
    for (const identity of ids) {
      const q = query(
        colRef,
        where('participants', 'array-contains', identity),
        where('type', '==', 'private')
      )

      const snapshot = await getDocs(q)

      for (const d of snapshot.docs) {

        const data = d.data()

        if (data.participants.includes(targetId)) {

          if (!chats.value.find(c => c.id === d.id)) {
            chats.value.push({ id: d.id, ...data })
          }

          selectChat(d.id)

          return

        }

      }
    }

    // create new chat

    const name =
      authStore.userProfile?.firstName ||
      authStore.user?.displayName ||
      'User'

    const newChat = {

      type: 'private',

      participants: [id, targetId],

      participantDetails: {

        [id]: {
          name,
          photo: authStore.userProfile?.profilePicture || ''
        },

        [targetId]: {
          name: targetMember.firstName,
          photo: targetMember.profilePicture || ''
        }

      },

      createdAt: serverTimestamp(),
      lastMessage: null

    }

    const docRef = await addDoc(colRef, newChat)

    chats.value.push({
      id: docRef.id,
      ...newChat
    })

    selectChat(docRef.id)

  }


  // CLEAR CHAT

  function clearActiveChat() {

    activeChatId.value = null

    if (messagesUnsub) messagesUnsub()

    messages.value = []

  }

  function stopAllChatListeners() {
    if (chatsUnsub) {
      if (Array.isArray(chatsUnsub)) chatsUnsub.forEach(u => u && u())
      else chatsUnsub()
      chatsUnsub = null
    }
    if (messagesUnsub) {
      messagesUnsub()
      messagesUnsub = null
    }
    activeChatId.value = null
    chats.value = []
    messages.value = []
    isLoadingMessages.value = false
    shouldOpenChatBox.value = false
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
    stopAllChatListeners,
    resetChatBoxSignal,
    markAsRead

  }

})