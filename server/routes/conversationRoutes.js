const express = require('express');
const controller = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', controller.listConversations);
router.post('/', controller.openPrivateConversation);
router.post('/group', controller.createGroup);
router.get('/:id', controller.getConversation);
router.get('/:id/messages', controller.getMessages);
router.post('/:id/members', controller.addMembers);
router.delete('/:id/members/:userId', controller.removeMember);

module.exports = router;
