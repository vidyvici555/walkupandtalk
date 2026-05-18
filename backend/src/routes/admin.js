const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getDashboard, getUsers, suspendUser, reinstateUser,
  getReports, reviewReport, getFakeSignals
} = require('../controllers/adminController');

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.put('/users/:userId/suspend', suspendUser);
router.put('/users/:userId/reinstate', reinstateUser);
router.get('/reports', getReports);
router.put('/reports/:reportId/review', reviewReport);
router.get('/fake-signals', getFakeSignals);

module.exports = router;
