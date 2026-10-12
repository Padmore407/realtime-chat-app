import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api, tokenStore } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { conversationTitle, createClientId } from '../utils/format';
import { chatReducer, initialState } from './chatReducer';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const ChatContext = createContext(null);
const ACK_TIMEOUT_MS = 10000;
const TYPING_EXPIRY_MS = 5000; // clears a typing indicator if its stop_typing is lost

const isTabVisible = () => document.visibilityState === 'visible';

export function ChatProvider({ children }) {
  const { user, clearSession } = useAuth();
  const { notify } = useNotifications();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  // 'connecting' (first attempt) | 'connected' | 'reconnecting' (lost after connecting) | 'offline' (never reached)
  const [connection, setConnection] = useState('connecting');
  const socketRef = useRef(null);

  // Socket handlers are registered once per login, so they read the latest
  // state through this ref instead of closing over a stale copy.
  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef(user);
  userRef.current = user;

  const myId = user?._id;

  const markRead = useCallback((conversationId) => {
    socketRef.current?.emit('mark_read', { conversationId });
    dispatch({ type: 'CLEAR_UNREAD', id: conversationId });
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    const { messages, hasMore } = await api.getMessages(conversationId);
    dispatch({ type: 'SET_MESSAGES', conversationId, messages, hasMore });
  }, []);

  const selectConversation = useCallback(
    (conversationId) => {
      dispatch({ type: 'SET_ACTIVE', id: conversationId });
      if (!conversationId) return;
      const { messages, conversations } = stateRef.current;
      if (!messages[conversationId]) loadMessages(conversationId).catch(console.error);
      if (conversations.find((c) => c._id === conversationId)?.unreadCount > 0) markRead(conversationId);
    },
    [loadMessages, markRead]
  );

  const selectRef = useRef(selectConversation);
  selectRef.current = selectConversation;

  // ---- Socket lifecycle: one connection per logged-in session ----
  useEffect(() => {
    if (!myId) return undefined;
    const socket = connectSocket(tokenStore.get());
    socketRef.current = socket;
    const typingTimers = new Map();
    let hasConnectedBefore = false;

    const loadConversations = () =>
      api
        .getConversations()
        .then((conversations) => dispatch({ type: 'SET_CONVERSATIONS', conversations }))
        .catch(console.error);

    loadConversations();

    socket.on('connect', () => {
      setConnection('connected');
      // After a reconnect, refetch anything we may have missed while offline.
      if (hasConnectedBefore) {
        loadConversations();
        const { activeId } = stateRef.current;
        if (activeId) loadMessages(activeId).catch(console.error);
      }
      hasConnectedBefore = true;
    });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', (err) => {
      setConnection(hasConnectedBefore ? 'reconnecting' : 'offline');
      if (err.message === 'Unauthorized') clearSession();
    });

    socket.on('online_users', (userIds) => dispatch({ type: 'SET_ONLINE', userIds }));
    socket.on('user_online', ({ userId }) => dispatch({ type: 'USER_ONLINE', userId }));
    socket.on('user_offline', ({ userId, lastSeen }) => dispatch({ type: 'USER_OFFLINE', userId, lastSeen }));

    const stopTyping = ({ conversationId, userId }) => {
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      dispatch({ type: 'TYPING_STOP', conversationId, userId });
    };
    socket.on('typing', (payload) => {
      const key = `${payload.conversationId}:${payload.userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.set(key, setTimeout(() => stopTyping(payload), TYPING_EXPIRY_MS));
      dispatch({ type: 'TYPING_START', ...payload });
    });
    socket.on('stop_typing', stopTyping);

    socket.on('receive_message', async (message) => {
      const { conversations, activeId } = stateRef.current;
      const conversationId = message.conversation;
      const isOwn = message.sender?._id === myId;
      stopTyping({ conversationId, userId: message.sender?._id });

      let conversation = conversations.find((c) => c._id === conversationId);
      if (!conversation) {
        // First message of a chat someone else started: fetch it (unread count included).
        conversation = await api.getConversation(conversationId).catch(() => null);
        if (!conversation) return;
        dispatch({ type: 'UPSERT_CONVERSATION', conversation });
      } else {
        const isActive = activeId === conversationId && isTabVisible();
        dispatch({ type: 'ADD_MESSAGE', message, myId, isActive });
        if (isActive && !isOwn) markRead(conversationId);
        if (isActive || isOwn) return;
      }

      if (isOwn || message.type === 'system') return;
      const title = conversation.isGroup
        ? `${message.sender.username} in ${conversation.name}`
        : message.sender.username;
      notify({
        title,
        body: message.attachment ? `📎 Sent a file: ${message.attachment.name}` : message.text,
        onClick: () => selectRef.current(conversationId),
      });
    });

    socket.on('messages_read', ({ conversationId, userId }) =>
      dispatch({ type: 'MESSAGES_READ', conversationId, userId, myId })
    );

    socket.on('conversation_updated', ({ conversation, reason, actor }) => {
      const isNewToMe = !stateRef.current.conversations.some((c) => c._id === conversation._id);
      dispatch({ type: 'UPSERT_CONVERSATION', conversation });
      if (isNewToMe && reason === 'added' && actor !== userRef.current?.username) {
        notify({
          title: `Added to "${conversation.name}"`,
          body: `${actor} added you to the group`,
          onClick: () => selectRef.current(conversation._id),
        });
      }
    });

    socket.on('conversation_removed', ({ conversationId }) => {
      const removed = stateRef.current.conversations.find((c) => c._id === conversationId);
      dispatch({ type: 'REMOVE_CONVERSATION', id: conversationId });
      if (removed) notify({ title: 'Removed from group', body: `You are no longer in "${removed.name}"` });
    });

    return () => {
      typingTimers.forEach(clearTimeout);
      disconnectSocket();
      socketRef.current = null;
      setConnection('connecting');
      dispatch({ type: 'RESET' });
    };
  }, [myId, clearSession, loadMessages, markRead, notify]);

  // Coming back to the tab counts as reading the open conversation.
  useEffect(() => {
    const onVisible = () => {
      const { activeId, conversations } = stateRef.current;
      if (isTabVisible() && activeId && conversations.find((c) => c._id === activeId)?.unreadCount > 0) {
        markRead(activeId);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  // Unread total in the browser tab title.
  const totalUnread = state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Chatter` : 'Chatter';
  }, [totalUnread]);

  // ---- Actions ----
  const emitMessage = useCallback((message) => {
    const socket = socketRef.current;
    if (!socket) return;
    const payload = {
      conversationId: message.conversation,
      text: message.text,
      attachment: message.attachment,
      clientId: message.clientId,
    };
    // Socket.IO buffers emits while disconnected; the ack timeout turns a
    // long outage into a "failed" state the user can retry. Retries reuse the
    // clientId, so the server never stores the message twice.
    socket.timeout(ACK_TIMEOUT_MS).emit('send_message', payload, (err, response) => {
      if (err || !response?.ok) {
        dispatch({ type: 'SET_MESSAGE_STATUS', conversationId: message.conversation, clientId: message.clientId, status: 'failed' });
        return;
      }
      dispatch({ type: 'ADD_MESSAGE', message: response.message, myId: message.sender._id, isActive: true });
    });
  }, []);

  const actions = useMemo(() => {
    const requireActive = () => stateRef.current.activeId;

    return {
      selectConversation,

      async loadOlder() {
        const id = requireActive();
        const list = stateRef.current.messages[id];
        const oldest = list?.find((m) => !m.status);
        if (!id || !oldest || !stateRef.current.hasMore[id]) return;
        const { messages, hasMore } = await api.getMessages(id, oldest._id);
        dispatch({ type: 'SET_MESSAGES', conversationId: id, messages, hasMore, prepend: true });
      },

      sendMessage({ text, attachment }) {
        const conversationId = requireActive();
        if (!conversationId || !user) return;
        const clientId = createClientId();
        const optimistic = {
          _id: clientId,
          clientId,
          conversation: conversationId,
          sender: { _id: user._id, username: user.username },
          type: attachment ? 'file' : 'text',
          text: text || '',
          attachment,
          readBy: [],
          createdAt: new Date().toISOString(),
          status: 'sending',
        };
        dispatch({ type: 'ADD_MESSAGE', message: optimistic, myId: user._id, isActive: true });
        emitMessage(optimistic);
      },

      retryMessage(message) {
        dispatch({ type: 'SET_MESSAGE_STATUS', conversationId: message.conversation, clientId: message.clientId, status: 'sending' });
        emitMessage(message);
      },

      startTyping: (conversationId) => socketRef.current?.emit('typing', { conversationId }),
      stopTyping: (conversationId) => socketRef.current?.emit('stop_typing', { conversationId }),

      async openPrivateChat(userId) {
        const conversation = await api.openPrivateChat(userId);
        dispatch({ type: 'UPSERT_CONVERSATION', conversation });
        selectConversation(conversation._id);
      },

      async createGroup(name, memberIds) {
        const conversation = await api.createGroup(name, memberIds);
        dispatch({ type: 'UPSERT_CONVERSATION', conversation });
        selectConversation(conversation._id);
      },

      async addMembers(conversationId, userIds) {
        dispatch({ type: 'UPSERT_CONVERSATION', conversation: await api.addMembers(conversationId, userIds) });
      },

      async removeMember(conversationId, userId) {
        const conversation = await api.removeMember(conversationId, userId);
        if (conversation) dispatch({ type: 'UPSERT_CONVERSATION', conversation });
      },

      async leaveGroup(conversationId) {
        await api.removeMember(conversationId, user._id);
        dispatch({ type: 'REMOVE_CONVERSATION', id: conversationId });
      },
    };
  }, [selectConversation, emitMessage, user]);

  const activeConversation = state.conversations.find((c) => c._id === state.activeId) || null;

  const value = useMemo(
    () => ({
      ...state,
      me: user,
      connection,
      activeConversation,
      activeTitle: activeConversation ? conversationTitle(activeConversation, user?._id) : '',
      ...actions,
    }),
    [state, user, connection, activeConversation, actions]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
