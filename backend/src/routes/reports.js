const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../utils/validate');
const { query } = require('../config/database');

router.post('/',
  authenticate,
  [
    body('reportedUserId').isUUID(),
    body('reason').isIn(['fake_profile', 'harassment', 'inappropriate_content', 'spam', 'other']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { reportedUserId, reason, description } = req.body;
      await query(
        'INSERT INTO reports (reporter_id, reported_id, reason, description) VALUES ($1,$2,$3,$4)',
        [req.user.id, reportedUserId, reason, description || null]
      );
      res.status(201).json({ message: 'Report submitted. Thank you.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
