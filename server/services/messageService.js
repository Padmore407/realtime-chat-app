const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { HttpError } = require('../utils/httpError');

const SENDER_FIELDS = 'username';
const UPLOAD_URL_PATTERN = /^\/uploads\/[\w-]+\.[a-z0-9]+$/;

// Only accept attachments that point at files this server stored, so a client
// can't inject arbitrary links (e.g. javascript: URLs) into the chat.
function sanitizeAttachment(attachment) {
  if (!attachment) return undefined;
  const { url, name, mimeType, size } = attachment;
  if (typeof url !== 'string' || !UPLOAD_URL_PATTERN.test(url)) {
    throw new HttpError(400, 'Invalid attachment');
  }
  return {
    url,
    name: String(name || 'file').slice(0, 255),
    mimeType: String(mimeType || 'application/octet-stream').slice(0, 100),
    size: Number(size) || 0,
  };
}

async function findMessageByClientId(senderId, clientId) {
  return Message.findOne({ sender: senderId, clientId }).populate('sender', SENDER_FIELDS);
}

/**
 * Persists a message. Idempotent per (sender, clientId): resending the same
 * clientId returns the stored message with `created: false` instead of
 * creating a duplicate.
 */
async function sendMessage({ senderId, conversationId, text, attachment, clientId }) {
  if (!mongoose.isValidObjectId(conversationId)) throw new HttpError(400, 'Invalid conversation');
  const body = typeof text === 'string' ? text.trim() : '';
  const file = sanitizeAttachment(attachment);
  if (!body && !file) throw new HttpError(400, 'Message is empty');
  if (body.length > 5000) throw new HttpError(400, 'Message is too long');
  const id = typeof clientId === 'string' && clientId.length <= 64 ? clientId : undefined;

  const conversation = await Conversation.findOne({ _id: conversationId, members: senderId });
  if (!conversation) throw new HttpError(404, 'Conversation not found');

  if (id) {
    const existing = await findMessageByClientId(senderId, id);
    if (existing) return { message: existing, conversation, created: false };
  }

  let message;
  try {
    message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      type: file ? 'file' : 'text',
      text: body,
      attachment: file,
      clientId: id,
    });
  } catch (err) {
    // Two copies raced past the check above; the unique index caught the second.
    if (err.code === 11000 && id) {
      return { message: await findMessageByClientId(senderId, id), conversation, created: false };
    }
    throw err;
  }

  conversation.lastMessage = message._id;
  await conversation.save(); // also bumps updatedAt, which orders the chat list
  await message.populate('sender', SENDER_FIELDS);
  return { message, conversation, created: true };
}

/** "Alex added Emma" style events shown inline in group chats. */
async function createSystemMessage(conversation, actorId, text) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    type: 'system',
    text,
  });
  await Conversation.updateOne({ _id: conversation._id }, { lastMessage: message._id });
  await message.populate('sender', SENDER_FIELDS);
  return message;
}

module.exports = { sendMessage, createSystemMessage, SENDER_FIELDS };
