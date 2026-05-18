const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDeck, swipe, undoSwipe, getSwipesRemaining } = require('../controllers/swipeController');
const { validate } = require('../utils/validate');

router.get('/deck', authenticate, getDeck);
router.get('/remaining', authenticate, getSwipesRemaining);
router.delete('/undo', authenticate, undoSwipe);
router.post('/',
  authenticate,
  [
    body('targetUserId').isUUID(),
    body('direction').isIn(['like', 'pass']),
  ],
  validate,
  swipe
);

module.exports = router;
