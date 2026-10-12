export const initialState = {
  loaded: false,
  conversations: [], // sorted by most recent activity, each with unreadCount
  messages: {}, // conversationId -> messages (oldest first); absent until first loaded
  hasMore: {}, // conversationId -> whether older messages exist on the server
  online: {}, // userId -> true
  typing: {}, // conversationId -> { userId: username }
  activeId: null,
};

const byActivity = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);

const sameMessage = (a, b) => a._id === b._id || (Boolean(b.clientId) && a.clientId === b.clientId);

function mapConversation(state, id, update) {
  return state.conversations.map((c) => (c._id === id ? update(c) : c));
}

function mapMessages(state, conversationId, update) {
  const list = state.messages[conversationId];
  if (!list) return state.messages;
  return { ...state.messages, [conversationId]: list.map(update) };
}

export function chatReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialState;

    case 'SET_CONVERSATIONS':
      return { ...state, loaded: true, conversations: [...action.conversations].sort(byActivity) };

    case 'UPSERT_CONVERSATION': {
      const incoming = action.conversation;
      const existing = state.conversations.find((c) => c._id === incoming._id);
      const unreadCount =
        typeof incoming.unreadCount === 'number' ? incoming.unreadCount : (existing?.unreadCount ?? 0);
      const merged = { ...existing, ...incoming, unreadCount };
      const others = state.conversations.filter((c) => c._id !== incoming._id);
      return { ...state, conversations: [merged, ...others].sort(byActivity) };
    }

    case 'REMOVE_CONVERSATION': {
      const { [action.id]: _removed, ...messages } = state.messages;
      return {
        ...state,
        messages,
        conversations: state.conversations.filter((c) => c._id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
      };
    }

    case 'SET_ACTIVE':
      return { ...state, activeId: action.id };

    case 'CLEAR_UNREAD':
      return { ...state, conversations: mapConversation(state, action.id, (c) => ({ ...c, unreadCount: 0 })) };

    case 'SET_MESSAGES': {
      const { conversationId: id, messages: page, hasMore, prepend } = action;
      const current = state.messages[id] || [];
      let next;
      if (prepend) {
        const known = new Set(current.map((m) => m._id));
        next = [...page.filter((m) => !known.has(m._id)), ...current];
      } else {
        // Fresh page (first open or resync after reconnect): keep any local
        // messages still sending/failed that the server doesn't know about yet.
        const local = current.filter((m) => m.status && !page.some((p) => sameMessage(p, m)));
        next = [...page, ...local];
      }
      return {
        ...state,
        messages: { ...state.messages, [id]: next },
        hasMore: { ...state.hasMore, [id]: hasMore },
      };
    }

    case 'ADD_MESSAGE': {
      // Handles optimistic messages, server acks and broadcasts. The same
      // message can arrive by more than one of those paths, so match on _id or
      // clientId and merge instead of appending a duplicate.
      const { message, myId, isActive } = action;
      const id = message.conversation;
      const list = state.messages[id];
      let messages = state.messages;
      let isNew = true;

      if (list) {
        const index = list.findIndex((m) => sameMessage(m, message));
        if (index >= 0) {
          isNew = false;
          const next = list.slice();
          next[index] = { ...list[index], ...message, status: message.status };
          messages = { ...messages, [id]: next };
        } else {
          messages = { ...messages, [id]: [...list, message] };
        }
      }

      const isOwn = message.sender?._id === myId;
      const conversations = mapConversation(state, id, (c) => {
        const last = c.lastMessage;
        const isLatest = !last || sameMessage(last, message) || new Date(message.createdAt) >= new Date(last.createdAt);
        return {
          ...c,
          lastMessage: isLatest ? message : last,
          updatedAt: isLatest ? message.createdAt : c.updatedAt,
          unreadCount: c.unreadCount + (isNew && !isOwn && !isActive ? 1 : 0),
        };
      }).sort(byActivity);

      return { ...state, messages, conversations };
    }

    case 'SET_MESSAGE_STATUS':
      return {
        ...state,
        messages: mapMessages(state, action.conversationId, (m) =>
          m.clientId === action.clientId ? { ...m, status: action.status } : m
        ),
      };

    case 'MESSAGES_READ': {
      const { conversationId, userId, myId } = action;
      if (userId === myId) {
        // I read it on another tab/device.
        return chatReducer(state, { type: 'CLEAR_UNREAD', id: conversationId });
      }
      return {
        ...state,
        messages: mapMessages(state, conversationId, (m) =>
          m.sender?._id !== userId && !m.readBy?.includes(userId)
            ? { ...m, readBy: [...(m.readBy || []), userId] }
            : m
        ),
      };
    }

    case 'SET_ONLINE':
      return { ...state, online: Object.fromEntries(action.userIds.map((id) => [id, true])) };

    case 'USER_ONLINE':
      return { ...state, online: { ...state.online, [action.userId]: true } };

    case 'USER_OFFLINE': {
      const { [action.userId]: _gone, ...online } = state.online;
      const conversations = state.conversations.map((c) =>
        c.members.some((m) => m._id === action.userId)
          ? {
              ...c,
              members: c.members.map((m) => (m._id === action.userId ? { ...m, lastSeen: action.lastSeen } : m)),
            }
          : c
      );
      return { ...state, online, conversations };
    }

    case 'TYPING_START':
      return {
        ...state,
        typing: {
          ...state.typing,
          [action.conversationId]: { ...state.typing[action.conversationId], [action.userId]: action.username },
        },
      };

    case 'TYPING_STOP': {
      const current = state.typing[action.conversationId];
      if (!current?.[action.userId]) return state;
      const { [action.userId]: _stopped, ...rest } = current;
      return { ...state, typing: { ...state.typing, [action.conversationId]: rest } };
    }

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}
