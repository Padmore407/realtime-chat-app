// Tracks which sockets belong to which user. A user can have several tabs or
// devices open; they are only "offline" once their last socket disconnects.
//
// This lives in process memory, so it assumes a single server instance. To run
// several instances, move it to Redis and use @socket.io/redis-adapter.
const socketsByUser = new Map();

/** Returns true if this is the user's first socket (they just came online). */
function addSocket(userId, socketId) {
  let sockets = socketsByUser.get(userId);
  const cameOnline = !sockets;
  if (!sockets) {
    sockets = new Set();
    socketsByUser.set(userId, sockets);
  }
  sockets.add(socketId);
  return cameOnline;
}

/** Returns true if this was the user's last socket (they just went offline). */
function removeSocket(userId, socketId) {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size > 0) return false;
  socketsByUser.delete(userId);
  return true;
}

const isOnline = (userId) => socketsByUser.has(String(userId));
const onlineUserIds = () => [...socketsByUser.keys()];

module.exports = { addSocket, removeSocket, isOnline, onlineUserIds };
