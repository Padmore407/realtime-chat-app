export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TOKEN_KEY = 'chat_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

async function request(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData; // browser sets the multipart boundary header
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/login')) onUnauthorized();
    const error = new Error(data?.message || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: data }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  searchUsers: (query) => request(`/api/users?search=${encodeURIComponent(query)}`),

  getConversations: () => request('/api/conversations'),
  getConversation: (id) => request(`/api/conversations/${id}`),
  openPrivateChat: (userId) => request('/api/conversations', { method: 'POST', body: { userId } }),
  createGroup: (name, memberIds) => request('/api/conversations/group', { method: 'POST', body: { name, memberIds } }),
  addMembers: (id, userIds) => request(`/api/conversations/${id}/members`, { method: 'POST', body: { userIds } }),
  removeMember: (id, userId) => request(`/api/conversations/${id}/members/${userId}`, { method: 'DELETE' }),

  getMessages: (id, before) =>
    request(`/api/conversations/${id}/messages${before ? `?before=${before}` : ''}`),

  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/upload', { method: 'POST', formData });
  },
};

/** Attachments are stored as server-relative paths; resolve against the API host. */
export const fileUrl = (url) => (/^https?:\/\//.test(url) ? url : `${API_URL}${url}`);
