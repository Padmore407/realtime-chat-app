const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, me, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Slows down password guessing against register/login.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/register', credentialLimiter, register);
router.post('/login', credentialLimiter, login);
router.get('/me', protect, me);
router.post('/logout', protect, logout);

module.exports = router;
