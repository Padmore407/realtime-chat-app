// Every socket joins a private room named after its user. Delivering to a
// conversation means emitting to the rooms of its members, so membership
// changes (adding/removing group members) never require re-joining rooms.
const userRoom = (userId) => `user:${userId}`;

function emitToUsers(io, userIds, event, payload) {
  if (!io || !userIds || userIds.length === 0) return; // .to([]) would broadcast to everyone
  io.to(userIds.map((id) => userRoom(String(id)))).emit(event, payload);
}

module.exports = { userRoom, emitToUsers };
