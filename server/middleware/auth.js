const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('../utils/httpError');

function signToken(userId) {
  return jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Shared by the REST middleware and the Socket.IO handshake.
async function verifyToken(token) {
  if (!token) throw new Error('Missing token');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id);
  if (!user) throw new Error('User no longer exists');
  return user;
}

async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Not authenticated');
  try {
    req.user = await verifyToken(token);
  } catch {
    throw new HttpError(401, 'Session expired, please log in again');
  }
  next();
}

module.exports = { signToken, verifyToken, protect };
