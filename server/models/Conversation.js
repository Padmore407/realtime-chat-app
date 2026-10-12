const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// One model covers both 1:1 and group chats, so messages, unread counts and
// real-time delivery work the same way for both.
const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 50 },
    members: [{ type: ObjectId, ref: 'User', required: true }],
    admin: { type: ObjectId, ref: 'User' },
    // Sorted "idA:idB" for private chats; the unique index stops two
    // simultaneous requests from creating duplicate private conversations.
    directKey: { type: String, unique: true, sparse: true },
    lastMessage: { type: ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1, updatedAt: -1 });

conversationSchema.statics.directKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

module.exports = mongoose.model('Conversation', conversationSchema);
