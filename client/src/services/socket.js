import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export function connectSocket(token) {
  disconnectSocket();
  socket = io(API_URL, { auth: { token } });
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
