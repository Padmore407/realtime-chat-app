const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Short timestamp for the chat list: time today, weekday this week, else date. */
export function formatListTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (sameDay(date, now)) return formatTime(date);
  const days = (now - date) / 86400000;
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatDay(value) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatLastSeen(value) {
  if (!value) return 'Offline';
  const minutes = Math.floor((Date.now() - new Date(value)) / 60000);
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const date = new Date(value);
  if (sameDay(date, new Date())) return `Last seen today at ${formatTime(date)}`;
  return `Last seen ${formatDay(date).toLowerCase()} at ${formatTime(date)}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const isImage = (mimeType) => /^image\//.test(mimeType || '');

export const otherMember = (conversation, myId) =>
  conversation.members.find((m) => m._id !== myId) || conversation.members[0];

export const conversationTitle = (conversation, myId) =>
  conversation.isGroup ? conversation.name : otherMember(conversation, myId)?.username || 'Unknown';

export function messagePreview(message, myId) {
  if (!message) return 'No messages yet';
  if (message.type === 'system') return message.text;
  const prefix = message.sender?._id === myId ? 'You: ' : '';
  if (message.attachment) return `${prefix}📎 ${message.attachment.name}`;
  return `${prefix}${message.text}`;
}

/** crypto.randomUUID needs a secure context; fall back for http://<LAN-IP> testing on phones. */
export const createClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
