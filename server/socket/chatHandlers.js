const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { sendMessage } = require('../services/messageService');
const { emitToUsers, userRoom } = require('./emit');

module.exports = function registerChatHandlers(io, socket) {
  const { user } = socket.data;
  const userId = String(user._id);

  // Member ids of a conversation, or null if this user isn't in it.
  async function membersOf(conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) return null;
    const conversation = await Conversation.findOne({ _id: conversationId, members: userId }, 'members').lean();
    return conversation ? conversation.members.map(String) : null;
  }

  // Socket handlers aren't covered by Express' error handling, so catch here.
  const safely = (handler) => async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error(`Socket handler error (user ${userId}):`, err);
    }
  };

  socket.on('send_message', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      // Pick fields explicitly: the sender always comes from the authenticated socket.
      const { conversationId, text, attachment, clientId } = payload || {};
      const { message, conversation, created } = await sendMessage({
        senderId: userId,
        conversationId,
        text,
        attachment,
        clientId,
      });
      // Only broadcast new messages; a retried duplicate just gets its ack.
      if (created) emitToUsers(io, conversation.members, 'receive_message', message);
      reply({ ok: true, message });
    } catch (err) {
      if (!err.status) console.error('send_message failed:', err);
      reply({ ok: false, error: err.status ? err.message : 'Could not send message' });
    }
  });

  const relayTyping = (event) =>
    safely(async ({ conversationId } = {}) => {
      const members = await membersOf(conversationId);
      const others = members?.filter((id) => id !== userId);
      if (!others || others.length === 0) return;
      socket.to(others.map(userRoom)).emit(event, { conversationId, userId, username: user.username });
    });

  socket.on('typing', relayTyping('typing'));
  socket.on('stop_typing', relayTyping('stop_typing'));

  socket.on(
    'mark_read',
    safely(async ({ conversationId } = {}) => {
      const members = await membersOf(conversationId);
      if (!members) return;
      const result = await Message.updateMany(
        { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      // Includes the reader's own other tabs so their unread badges clear too.
      if (result.modifiedCount > 0) {
        emitToUsers(io, members, 'messages_read', { conversationId, userId, readAt: new Date() });
      }
    })
  );
};
