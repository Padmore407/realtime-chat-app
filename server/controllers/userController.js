const User = require('../models/User');
const presence = require('../socket/presence');
const { escapeRegex } = require('../utils/httpError');

async function searchUsers(req, res) {
  const query = String(req.query.search || '').trim().slice(0, 50);
  const filter = { _id: { $ne: req.user._id } };
  if (query) filter.username = { $regex: escapeRegex(query), $options: 'i' };

  const users = await User.find(filter).select('username lastSeen').sort({ username: 1 }).limit(20).lean();
  res.json(users.map((user) => ({ ...user, online: presence.isOnline(user._id) })));
}

module.exports = { searchUsers };
