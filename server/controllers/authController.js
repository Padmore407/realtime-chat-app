const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { HttpError } = require('../utils/httpError');

const toAuthResponse = (user) => ({ token: signToken(user._id), user });

async function register(req, res) {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    throw new HttpError(400, 'Username, email and password are required');
  }
  // String() everywhere: never let an object like { $gt: "" } reach a query.
  const user = await User.create({
    username: String(username),
    email: String(email),
    password: String(password),
  });
  res.status(201).json(toAuthResponse(user));
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
  // Same message for both cases so the endpoint doesn't reveal which emails exist.
  if (!user || !(await user.comparePassword(String(password)))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json(toAuthResponse(user));
}

async function me(req, res) {
  res.json({ user: req.user });
}

// JWTs are stateless: logging out means the client discards its token and
// closes its socket. This endpoint exists so the client has one place to call
// (and so a token blocklist could be added later without client changes).
async function logout(_req, res) {
  res.status(204).end();
}

module.exports = { register, login, me, logout };
