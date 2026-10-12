const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');
const { emitToUsers } = require('../socket/emit');
const { createSystemMessage, SENDER_FIELDS } = require('../services/messageService');

const MEMBER_FIELDS = 'username lastSeen';

const withDetails = (query) =>
  query
    .populate('members', MEMBER_FIELDS)
    .populate({ path: 'lastMessage', populate: { path: 'sender', select: SENDER_FIELDS } });

/** Map of conversationId -> number of messages the user hasn't read. */
async function unreadCounts(conversationIds, userId) {
  if (conversationIds.length === 0) return {};
  const rows = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversationIds },
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
    },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

async function loadConversation(id, userId) {
  const conversation = await withDetails(Conversation.findById(id)).lean();
  if (!conversation) return null;
  const counts = await unreadCounts([conversation._id], userId);
  return { ...conversation, unreadCount: counts[String(conversation._id)] || 0 };
}

async function findMembership(conversationId, userId) {
  const conversation = await Conversation.findOne({ _id: conversationId, members: userId });
  if (!conversation) throw new HttpError(404, 'Conversation not found');
  return conversation;
}

async function assertUsersExist(ids) {
  if (!ids.every((id) => mongoose.isValidObjectId(id))) throw new HttpError(400, 'Invalid user id');
  const found = await User.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new HttpError(400, 'One or more users do not exist');
}

const usernames = (ids) =>
  User.find({ _id: { $in: ids } }).select('username').lean().then((users) => users.map((u) => u.username));

/** Tells current members about a group change and posts the system message. */
async function broadcastGroupChange(req, conversationId, systemText, reason) {
  const io = req.app.get('io');
  const conversation = await withDetails(Conversation.findById(conversationId)).lean();
  const memberIds = conversation.members.map((m) => m._id);
  emitToUsers(io, memberIds, 'conversation_updated', {
    conversation,
    reason,
    actor: req.user.username,
  });
  const message = await createSystemMessage(conversation, req.user._id, systemText);
  emitToUsers(io, memberIds, 'receive_message', message);
}

async function listConversations(req, res) {
  const conversations = await withDetails(Conversation.find({ members: req.user._id }))
    .sort({ updatedAt: -1 })
    .lean();
  const counts = await unreadCounts(conversations.map((c) => c._id), req.user._id);
  res.json(conversations.map((c) => ({ ...c, unreadCount: counts[String(c._id)] || 0 })));
}

async function getConversation(req, res) {
  await findMembership(req.params.id, req.user._id);
  res.json(await loadConversation(req.params.id, req.user._id));
}

/** Opens the 1:1 chat with a user, creating it the first time. */
async function openPrivateConversation(req, res) {
  const { userId } = req.body || {};
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, 'Invalid user id');
  if (String(userId) === String(req.user._id)) throw new HttpError(400, 'You cannot chat with yourself');
  if (!(await User.exists({ _id: userId }))) throw new HttpError(404, 'User not found');

  const directKey = Conversation.directKeyFor(req.user._id, userId);
  let conversation = await Conversation.findOne({ directKey });
  if (!conversation) {
    try {
      conversation = await Conversation.create({ members: [req.user._id, userId], directKey });
    } catch (err) {
      if (err.code !== 11000) throw err;
      conversation = await Conversation.findOne({ directKey }); // created concurrently
    }
  }
  res.json(await loadConversation(conversation._id, req.user._id));
}

async function createGroup(req, res) {
  const { name, memberIds } = req.body || {};
  const groupName = String(name || '').trim();
  if (!groupName) throw new HttpError(400, 'Group name is required');
  if (groupName.length > 50) throw new HttpError(400, 'Group name must be at most 50 characters');

  const me = String(req.user._id);
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : []).map(String))].filter((id) => id !== me);
  if (ids.length === 0) throw new HttpError(400, 'Add at least one member');
  await assertUsersExist(ids);

  const conversation = await Conversation.create({
    isGroup: true,
    name: groupName,
    members: [req.user._id, ...ids],
    admin: req.user._id,
  });
  await broadcastGroupChange(req, conversation._id, `${req.user.username} created the group "${groupName}"`, 'added');
  res.status(201).json(await loadConversation(conversation._id, req.user._id));
}

async function addMembers(req, res) {
  const conversation = await findMembership(req.params.id, req.user._id);
  if (!conversation.isGroup) throw new HttpError(400, 'Members can only be added to groups');
  if (String(conversation.admin) !== String(req.user._id)) {
    throw new HttpError(403, 'Only the group admin can add members');
  }

  const existing = new Set(conversation.members.map(String));
  const userIds = req.body?.userIds;
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter((id) => !existing.has(id));
  if (ids.length === 0) throw new HttpError(400, 'No new members to add');
  await assertUsersExist(ids);

  await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { members: { $each: ids } } });
  const names = await usernames(ids);
  await broadcastGroupChange(req, conversation._id, `${req.user.username} added ${names.join(', ')}`, 'added');
  res.json(await loadConversation(conversation._id, req.user._id));
}

/** Admin removes a member, or any member leaves (removes themselves). */
async function removeMember(req, res) {
  const conversation = await findMembership(req.params.id, req.user._id);
  if (!conversation.isGroup) throw new HttpError(400, 'Members can only be removed from groups');

  const targetId = String(req.params.userId);
  const isSelf = targetId === String(req.user._id);
  const isAdmin = String(conversation.admin) === String(req.user._id);
  if (!isSelf && !isAdmin) throw new HttpError(403, 'Only the group admin can remove members');
  if (!conversation.members.some((m) => String(m) === targetId)) {
    throw new HttpError(404, 'User is not a member of this group');
  }

  conversation.members = conversation.members.filter((m) => String(m) !== targetId);
  const io = req.app.get('io');
  emitToUsers(io, [targetId], 'conversation_removed', { conversationId: String(conversation._id) });

  if (conversation.members.length === 0) {
    await Promise.all([conversation.deleteOne(), Message.deleteMany({ conversation: conversation._id })]);
    return res.status(204).end();
  }
  // Hand the group over if the admin leaves.
  if (String(conversation.admin) === targetId) conversation.admin = conversation.members[0];
  await conversation.save();

  const [targetName] = await usernames([targetId]);
  const text = isSelf ? `${req.user.username} left the group` : `${req.user.username} removed ${targetName}`;
  await broadcastGroupChange(req, conversation._id, text, 'removed');

  if (isSelf) return res.status(204).end();
  res.json(await loadConversation(conversation._id, req.user._id));
}

/** Cursor-paginated history, oldest first. Pass ?before=<messageId> for older pages. */
async function getMessages(req, res) {
  await findMembership(req.params.id, req.user._id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const filter = { conversation: req.params.id };
  if (req.query.before) {
    if (!mongoose.isValidObjectId(req.query.before)) throw new HttpError(400, 'Invalid cursor');
    filter._id = { $lt: req.query.before };
  }

  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('sender', SENDER_FIELDS)
    .lean();
  const hasMore = messages.length > limit;
  res.json({ messages: messages.slice(0, limit).reverse(), hasMore });
}

module.exports = {
  listConversations,
  getConversation,
  openPrivateConversation,
  createGroup,
  addMembers,
  removeMember,
  getMessages,
};
