const express = require('express');
const { searchUsers } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, searchUsers);

module.exports = router;
