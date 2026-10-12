const { Server } = require('socket.io');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const presence = require('./presence');
const { userRoom } = require('./emit');
const registerChatHandlers = require('./chatHandlers');

function initSocket(httpServer, { clientOrigins }) {
  const io = new Server(httpServer, {
    cors: { origin: clientOrigins, credentials: true },
    maxHttpBufferSize: 1e5, // files go through the upload endpoint, not the socket
  });

  // Authenticate the handshake with the same JWT the REST API uses.
  io.use(async (socket, next) => {
    try {
      socket.data.user = await verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.data.user._id);
    socket.join(userRoom(userId));

    if (presence.addSocket(userId, socket.id)) {
      socket.broadcast.emit('user_online', { userId });
    }
    socket.emit('online_users', presence.onlineUserIds());

    registerChatHandlers(io, socket);

    socket.on('disconnect', async () => {
      if (!presence.removeSocket(userId, socket.id)) return;
      const lastSeen = new Date();
      io.emit('user_offline', { userId, lastSeen });
      await User.updateOne({ _id: userId }, { lastSeen }).catch((err) =>
        console.error('Failed to save lastSeen:', err)
      );
    });
  });

  return io;
}

module.exports = initSocket;
