// End-to-end tests: real Express app + Socket.IO server against an in-memory MongoDB.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: connect } = require('socket.io-client');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../app');
const initSocket = require('../socket');
const { UPLOAD_DIR } = require('../middleware/upload');

let mongo;
let server;
let baseUrl;
const sockets = [];

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri());
  await mongoose.connection.syncIndexes();
  const app = createApp({ clientOrigins: ['http://localhost:5173'] });
  server = http.createServer(app);
  app.set('io', initSocket(server, { clientOrigins: ['http://localhost:5173'] }));
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

async function registerUser(username) {
  const { status, data } = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email: `${username}@example.com`, password: 'secret123' },
  });
  assert.equal(status, 201);
  return { ...data.user, token: data.token };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = connect(baseUrl, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const nextEvent = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const noEvent = (socket, event, ms = 300) =>
  new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`Unexpected "${event}"`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

const emitWithAck = (socket, event, payload) => socket.timeout(2000).emitWithAck(event, payload);

test('auth: register, login, duplicate and bad credentials', async () => {
  const alex = await registerUser('alex');
  assert.ok(alex.token);
  assert.equal(alex.password, undefined, 'password hash must never be returned');

  const dupe = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'ALEX', email: 'other@example.com', password: 'secret123' },
  });
  assert.equal(dupe.status, 409, 'usernames are unique case-insensitively');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'Alex@Example.com', password: 'secret123' },
  });
  assert.equal(login.status, 200);

  const bad = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'alex@example.com', password: 'wrong' },
  });
  assert.equal(bad.status, 401);

  const injection = await request('/api/auth/login', {
    method: 'POST',
    body: { email: { $gt: '' }, password: 'secret123' },
  });
  assert.equal(injection.status, 401);

  const me = await request('/api/auth/me', { token: login.data.token });
  assert.equal(me.data.user.username, 'alex');
  assert.equal((await request('/api/auth/me', { token: 'garbage' })).status, 401);
});

test('sockets reject connections without a valid token', async () => {
  await assert.rejects(connectSocket('not-a-token'), /Unauthorized/);
});

test('private chat: real-time delivery, dedupe, typing, unread and read receipts', async () => {
  const emma = await registerUser('emma');
  const john = await registerUser('john');

  const first = await request('/api/conversations', { method: 'POST', token: emma.token, body: { userId: john._id } });
  const again = await request('/api/conversations', { method: 'POST', token: john.token, body: { userId: emma._id } });
  assert.equal(first.data._id, again.data._id, 'opening the same private chat twice reuses it');
  const conversationId = first.data._id;

  const emmaSocket = await connectSocket(emma.token);
  const johnOnline = nextEvent(emmaSocket, 'user_online');
  const johnSocket = await connectSocket(john.token);
  assert.equal((await johnOnline).userId, john._id);

  // Typing indicator goes to the other member only.
  const typing = nextEvent(johnSocket, 'typing');
  const emmaNoEcho = noEvent(emmaSocket, 'typing');
  emmaSocket.emit('typing', { conversationId });
  assert.deepEqual(await typing, { conversationId, userId: emma._id, username: 'emma' });
  await emmaNoEcho;

  // Message delivered instantly to the receiver.
  const received = nextEvent(johnSocket, 'receive_message');
  const ack = await emitWithAck(emmaSocket, 'send_message', { conversationId, text: 'Hello!', clientId: 'c-1' });
  assert.equal(ack.ok, true);
  const message = await received;
  assert.equal(message.text, 'Hello!');
  assert.equal(message.sender.username, 'emma');

  // Retrying with the same clientId must not store or broadcast a duplicate.
  const noDuplicate = noEvent(johnSocket, 'receive_message');
  const retry = await emitWithAck(emmaSocket, 'send_message', { conversationId, text: 'Hello!', clientId: 'c-1' });
  assert.equal(retry.message._id, ack.message._id);
  await noDuplicate;

  // Sender can't be spoofed via the payload.
  const spoof = await emitWithAck(emmaSocket, 'send_message', { conversationId, text: 'hi', senderId: john._id });
  assert.equal(spoof.message.sender._id, emma._id);

  const history = await request(`/api/conversations/${conversationId}/messages`, { token: john.token });
  assert.equal(history.data.messages.length, 2);

  let list = await request('/api/conversations', { token: john.token });
  assert.equal(list.data[0].unreadCount, 2);
  assert.equal(list.data[0].lastMessage.text, 'hi');

  const readReceipt = nextEvent(emmaSocket, 'messages_read');
  johnSocket.emit('mark_read', { conversationId });
  assert.equal((await readReceipt).userId, john._id);
  list = await request('/api/conversations', { token: john.token });
  assert.equal(list.data[0].unreadCount, 0);

  // Outsiders can't read or post.
  const outsider = await registerUser('mallory');
  assert.equal((await request(`/api/conversations/${conversationId}/messages`, { token: outsider.token })).status, 404);
  const outsiderSocket = await connectSocket(outsider.token);
  const denied = await emitWithAck(outsiderSocket, 'send_message', { conversationId, text: 'sneaky' });
  assert.equal(denied.ok, false);

  // Attachments must point at this server's uploads.
  const badFile = await emitWithAck(emmaSocket, 'send_message', {
    conversationId,
    attachment: { url: 'javascript:alert(1)', name: 'x', mimeType: 'text/html', size: 1 },
  });
  assert.equal(badFile.ok, false);

  // Going offline is broadcast once the last socket disconnects.
  const offline = nextEvent(emmaSocket, 'user_offline');
  johnSocket.disconnect();
  assert.equal((await offline).userId, john._id);
});

test('group chat: create, notify, admin-only membership changes, leave', async () => {
  const [owner, sam, lee, kim] = await Promise.all(['owner', 'sam', 'lee', 'kim'].map(registerUser));
  const samSocket = await connectSocket(sam.token);
  const kimSocket = await connectSocket(kim.token);

  const samAdded = nextEvent(samSocket, 'conversation_updated');
  const group = await request('/api/conversations/group', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Study group', memberIds: [sam._id, lee._id] },
  });
  assert.equal(group.status, 201);
  const groupId = group.data._id;
  const update = await samAdded;
  assert.equal(update.reason, 'added');
  assert.equal(update.actor, 'owner');

  const forbidden = await request(`/api/conversations/${groupId}/members`, {
    method: 'POST',
    token: sam.token,
    body: { userIds: [kim._id] },
  });
  assert.equal(forbidden.status, 403);

  const kimAdded = nextEvent(kimSocket, 'conversation_updated');
  const added = await request(`/api/conversations/${groupId}/members`, {
    method: 'POST',
    token: owner.token,
    body: { userIds: [kim._id] },
  });
  assert.equal(added.data.members.length, 4);
  assert.equal((await kimAdded).conversation._id, groupId);

  // A group message reaches every member.
  const samGets = nextEvent(samSocket, 'receive_message');
  const ack = await emitWithAck(kimSocket, 'send_message', { conversationId: groupId, text: 'Hi all' });
  assert.equal(ack.ok, true);
  assert.equal((await samGets).text, 'Hi all');

  const samRemoved = nextEvent(samSocket, 'conversation_removed');
  const removed = await request(`/api/conversations/${groupId}/members/${sam._id}`, {
    method: 'DELETE',
    token: owner.token,
  });
  assert.equal(removed.status, 200);
  assert.equal((await samRemoved).conversationId, groupId);

  // Admin leaves: admin role passes to a remaining member.
  const left = await request(`/api/conversations/${groupId}/members/${owner._id}`, {
    method: 'DELETE',
    token: owner.token,
  });
  assert.equal(left.status, 204);
  const after = await request(`/api/conversations/${groupId}`, { token: lee.token });
  assert.notEqual(after.data.admin, owner._id);
  assert.equal(after.data.members.length, 2);

  const history = await request(`/api/conversations/${groupId}/messages`, { token: lee.token });
  assert.deepEqual(
    history.data.messages.filter((m) => m.type === 'system').map((m) => m.text),
    ['owner created the group "Study group"', 'owner added kim', 'owner removed sam', 'owner left the group']
  );
});

test('file upload: accepts allowed types, rejects others', async () => {
  const user = await registerUser('uploader');
  const upload = async (name, type, content) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type }), name);
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: form,
    });
    return { status: res.status, data: await res.json() };
  };

  const ok = await upload('notes.txt', 'text/plain', 'hello');
  assert.equal(ok.status, 201);
  assert.match(ok.data.url, /^\/uploads\/[\w-]+\.txt$/);
  const file = await fetch(`${baseUrl}${ok.data.url}`);
  assert.equal(await file.text(), 'hello');
  assert.equal(file.headers.get('content-disposition'), 'attachment');
  fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(ok.data.url))); // don't leave test files behind

  const bad = await upload('evil.html', 'text/html', '<script>alert(1)</script>');
  assert.equal(bad.status, 400);
});
