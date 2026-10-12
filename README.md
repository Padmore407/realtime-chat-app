# Chatter: Real-Time Chat Application

A full-stack chat app built with **React, Node.js/Express, Socket.IO and MongoDB**. It has private and group chats, live presence, typing indicators, read receipts, file sharing, notifications and a responsive, dark-mode-ready UI.

## Features

| Area | What's included |
| --- | --- |
| Authentication | Register, login, logout; bcrypt password hashing; JWT sessions restored on reload; rate-limited credential endpoints |
| Dashboard | Recent conversations sorted by activity, an "online now" strip, user search, unread badges, total unread count in the tab title |
| Messaging | Instant delivery over WebSockets, optimistic sending, retry on failure, **no duplicate messages**, paginated history (infinite scroll) |
| Group chat | Create groups, admin adds and removes members, anyone can leave, admin hands over automatically, inline system messages ("Alex added Emma") |
| Presence | 🟢 online / 🔴 offline dots, "last seen" times, correct across multiple tabs and devices |
| Typing indicator | "Alex is typing…" with idle timeout and self-expiry if a stop event is lost |
| Notifications | In-app toasts plus desktop notifications (when the tab is in the background) for new messages, files and being added to a group |
| File sharing | Images (inline preview), PDFs, Office documents, TXT, ZIP; up to 10 MB; type whitelist |
| Read receipts | ✓ sent, ✓✓ seen (with "Seen by N" in groups), synced live |
| Bonus | Dark mode (follows the system theme, with a toggle), emoji picker, reconnect banner with automatic resync |
| Mobile | Single-panel layout under 768px with a back button; safe-area aware |

## Tech stack

- **Frontend:** React 19 (Vite), React Router, Socket.IO client, plain CSS with theme variables
- **Backend:** Node.js, Express 5, Socket.IO 4, Mongoose 9, Multer
- **Security:** JWT, bcrypt, Helmet, CORS allow-list, rate limiting
- **Database:** MongoDB (Atlas in production)
- **Testing:** Node's built-in test runner with `mongodb-memory-server` (no database setup needed)

## Project structure

```
chat-app/
├── client/                     React frontend (Vite)
│   └── src/
│       ├── components/         Sidebar, ChatWindow, MessageList, MessageInput, modals…
│       ├── pages/              Login, Register, Chat
│       ├── context/            Auth, Chat (socket + reducer), Notifications, theme
│       ├── services/           api.js (REST client), socket.js
│       ├── utils/              formatting helpers
│       ├── App.jsx             routes
│       └── index.jsx           entry point
├── server/
│   ├── config/                 MongoDB connection
│   ├── controllers/            auth, users, conversations/messages
│   ├── middleware/             JWT auth, file upload, error handling
│   ├── models/                 User, Conversation, Message
│   ├── routes/                 REST routes
│   ├── services/               message persistence (shared by socket + REST)
│   ├── socket/                 Socket.IO setup, chat events, presence
│   ├── tests/                  end-to-end API + socket tests
│   ├── app.js                  Express app (no listening, so it's testable)
│   └── server.js               HTTP server + Socket.IO + DB bootstrap
└── README.md
```

> The brief lists `App.js` and `index.js`. With Vite, files containing JSX use the `.jsx` extension, so they are `App.jsx` and `index.jsx`. Create React App, which used `.js`, is deprecated.

## Getting started

Requirements: **Node.js 20+**. MongoDB is optional for local development (see option A).

```bash
# 1. Backend
cd server
npm install
cp .env.example .env          # then edit values if needed

# Option A: no MongoDB installed, use a throwaway in-memory database
npm run dev:memory

# Option B: a real database (local MongoDB or Atlas URI in .env)
npm run dev

# 2. Frontend (new terminal)
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5000
npm run dev                   # http://localhost:5173
```

To try it as two users, open a normal window and a private window (or two browsers), then register a different account in each.

To test on your phone over Wi-Fi, run `npm run dev -- --host` in `client`. Then set `VITE_API_URL=http://<your-PC-IP>:5000`, and in the server `.env` add `http://<your-PC-IP>:5173` to `CLIENT_URL`.

### Tests

```bash
cd server
npm test
```

The tests start the real Express and Socket.IO server against an in-memory MongoDB. They cover:

- auth, including duplicate accounts and a NoSQL-injection attempt
- real-time delivery
- duplicate-message prevention and sender spoofing
- typing relay, unread counts and read receipts
- access control for non-members
- group admin rules
- presence
- upload type validation

The first run downloads a MongoDB binary of about 400 MB.

## Environment variables

**server/.env**

| Variable | Description |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated |
| `NODE_ENV` | `production` hides internal error messages |

**client/.env**

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend URL, no trailing slash |

## REST API

All routes except register and login need an `Authorization: Bearer <token>` header.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ username, email, password }` returns `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Ends the session (client discards its token) |
| GET | `/api/users?search=` | Search users by username (includes `online`) |
| GET | `/api/conversations` | My conversations with `lastMessage` and `unreadCount` |
| POST | `/api/conversations` | `{ userId }`: open (or create) a private chat |
| POST | `/api/conversations/group` | `{ name, memberIds }`: create a group |
| GET | `/api/conversations/:id` | One conversation |
| GET | `/api/conversations/:id/messages?before=<messageId>` | Paginated history, oldest first, with `{ messages, hasMore }` |
| POST | `/api/conversations/:id/members` | `{ userIds }`: add members (admin only) |
| DELETE | `/api/conversations/:id/members/:userId` | Remove a member (admin) or leave (yourself) |
| POST | `/api/upload` | Multipart `file` returns `{ url, name, mimeType, size }` |

## Socket.IO events

The socket authenticates in the handshake: `io(API_URL, { auth: { token } })`.

| Direction | Event | Payload |
| --- | --- | --- |
| client → server | `send_message` | `{ conversationId, text?, attachment?, clientId }` with an ack callback that receives `{ ok, message \| error }` |
| client → server | `typing` / `stop_typing` | `{ conversationId }` |
| client → server | `mark_read` | `{ conversationId }` |
| server → client | `receive_message` | Message (sender populated) |
| server → client | `typing` / `stop_typing` | `{ conversationId, userId, username }` |
| server → client | `messages_read` | `{ conversationId, userId, readAt }` |
| server → client | `online_users` | `[userId]` on connect |
| server → client | `user_online` / `user_offline` | `{ userId, lastSeen? }` |
| server → client | `conversation_updated` | `{ conversation, reason, actor }` for group created or changed |
| server → client | `conversation_removed` | `{ conversationId }` when you were removed |

## Design decisions

These are the points worth being able to explain in an interview.

- **Conversations, not sender→receiver pairs.** The brief's example message has `sender`/`receiver`. This app stores `conversation` + `sender` instead, so private and group chats share one code path for messages, unread counts and delivery. Private chats get a unique `directKey` (two sorted user ids), so two simultaneous "start chat" requests can't create duplicates.
- **Per-user rooms.** Each socket joins `user:<id>`, and a message is emitted to the rooms of the conversation's members. Adding or removing group members then needs no room bookkeeping, and every tab or device a user has open receives events.
- **Duplicate prevention end to end:**
  1. The client generates a `clientId` per message and shows it immediately (optimistic UI).
  2. The server stores at most one message per `(sender, clientId)`, enforced by a unique index, so retries after a timeout or reconnect are safe.
  3. The client reducer merges acks and broadcasts by `_id`/`clientId` instead of appending twice.
- **Persistence before delivery.** A message is saved to MongoDB first, then broadcast, so anything a user sees is in the history.
- **Unread counts and read receipts share one field.** `readBy` on each message drives both, so they can't drift apart. Unread counts are computed with an aggregation.
- **Presence handles multiple tabs.** A user goes offline only when their *last* socket disconnects.
- **Reconnect resync.** After a dropped connection, the client refetches conversations and the open chat, so messages missed while offline appear.
- **Security:**
  - The sender always comes from the authenticated socket, never from the payload.
  - Membership is checked on every read and write.
  - Inputs are cast to strings, which blocks `{ "$gt": "" }`-style injection.
  - Uploads are whitelisted by MIME type and extension (no SVG/HTML), stored under random names, and served with `nosniff`; non-media files are forced to download.
  - Attachments in messages must point at this server's `/uploads/`.
  - Login errors don't reveal which emails exist.

## Deployment

1. **MongoDB Atlas:** create a free cluster and a database user, allow network access (`0.0.0.0/0` for Render/Railway), and copy the connection string.
2. **Backend on Render (or Railway):**
   - New Web Service, with root directory `server`.
   - Build command `npm install`, start command `npm start`.
   - Environment variables: `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`, and `CLIENT_URL=https://your-app.vercel.app`.
   - WebSockets work out of the box.
3. **Frontend on Vercel:**
   - Import the repo with root directory `client` and the Vite framework preset.
   - Set `VITE_API_URL=https://your-api.onrender.com`.
   - `vercel.json` already rewrites routes to `index.html`.
4. Redeploy the backend if the Vercel URL changed, so CORS allows it.

> **Uploads on free hosting:** Render's and Railway's filesystems are ephemeral, so uploaded files disappear on redeploy. For production, swap the Multer disk storage in [server/middleware/upload.js](server/middleware/upload.js) for Cloudinary or S3. Messages already store a URL, so nothing else changes.

## Known limitations and next steps

- **Single server instance:** presence lives in memory. To scale horizontally, add `@socket.io/redis-adapter` and keep presence in Redis.
- **Tokens in `localStorage`:** this is simple for a Vercel + Render split. An httpOnly refresh-token cookie with short-lived access tokens would be stronger against XSS.
- **Enhancements from the brief not yet built:**
  - voice and video calls (WebRTC)
  - message search, reactions, replies and pinned messages
  - push notifications and PWA support
  - end-to-end encryption
  - an AI assistant
  - an admin dashboard

  A ready-made GitHub Actions CI workflow (server tests + client build) is in [docs/github-actions-ci.yml](docs/github-actions-ci.yml). To enable it, copy it to `.github/workflows/ci.yml`, or create that file through GitHub's web editor.
