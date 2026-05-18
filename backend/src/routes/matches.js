const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMatches, getMatch, unmatch, blockUser } = require('../controllers/matchController');
const { getMessages, sendMessage } = require('../controllers/messageController');
const callCompletedRouter = require('./callCompleted');

router.get('/', authenticate, getMatches);
router.get('/:matchId', authenticate, getMatch);
router.delete('/:matchId', authenticate, unmatch);
router.post('/:matchId/block', authenticate, blockUser);
router.get('/:matchId/messages', authenticate, getMessages);
router.post('/:matchId/messages', authenticate, sendMessage);
router.use('/:matchId/call-completed', callCompletedRouter);

module.exports = router;
