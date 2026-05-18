const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getProfile, updateProfile, uploadPhotos, deletePhoto, setPrimaryPhoto
} = require('../controllers/profileController');

router.get('/me', authenticate, getProfile);
router.get('/:userId', authenticate, getProfile);
router.put('/', authenticate, updateProfile);
router.post('/photos', authenticate, upload.array('photos', 6), uploadPhotos);
router.delete('/photos/:photoId', authenticate, deletePhoto);
router.put('/photos/:photoId/primary', authenticate, setPrimaryPhoto);

module.exports = router;
