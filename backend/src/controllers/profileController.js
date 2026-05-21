const { query } = require('../config/database');
const { uploadPhoto, deletePhoto } = require('../services/cloudinaryService');

// GET /api/profile/me  or  GET /api/profile/:userId
const getProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;

    const result = await query(
      `SELECT p.*,
              json_agg(pp.* ORDER BY pp.sort_order) FILTER (WHERE pp.id IS NOT NULL) AS photos
       FROM profiles p
       LEFT JOIN profile_photos pp ON p.user_id = pp.user_id
       WHERE p.user_id = $1
       GROUP BY p.id`,
      [userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile
const updateProfile = async (req, res, next) => {
  try {
    const {
      display_name, birthdate, gender, interested_in, bio,
      location_city, location_state, location_lat, location_lng,
      height_cm, education, occupation,
    } = req.body;

    // Must be 18+
    const birth = new Date(birthdate);
    const age = Math.floor((Date.now() - birth) / (365.25 * 24 * 3600 * 1000));
    if (age < 18) {
      return res.status(400).json({ error: 'You must be at least 18 years old' });
    }

    const photoCheck = await query(
      'SELECT COUNT(*) FROM profile_photos WHERE user_id = $1',
      [req.user.id]
    );
    const hasPhotos = parseInt(photoCheck.rows[0].count) > 0;

    const isComplete = !!(
      display_name && birthdate && gender && interested_in?.length > 0 && hasPhotos
    );

    const existing = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);

    if (existing.rows.length > 0) {
      await query(
        `UPDATE profiles SET
          display_name=$1, birthdate=$2, gender=$3, interested_in=$4, bio=$5,
          location_city=$6, location_state=$7, location_lat=$8, location_lng=$9,
          height_cm=$10, education=$11, occupation=$12, is_complete=$13
         WHERE user_id=$14`,
        [
          display_name, birthdate, gender,
          Array.isArray(interested_in) ? interested_in : [interested_in],
          bio, location_city, location_state, location_lat, location_lng,
          height_cm, education, occupation, isComplete, req.user.id,
        ]
      );
    } else {
      await query(
        `INSERT INTO profiles
          (user_id, display_name, birthdate, gender, interested_in, bio,
           location_city, location_state, location_lat, location_lng,
           height_cm, education, occupation, is_complete)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          req.user.id, display_name, birthdate, gender,
          Array.isArray(interested_in) ? interested_in : [interested_in],
          bio, location_city, location_state, location_lat, location_lng,
          height_cm, education, occupation, isComplete,
        ]
      );
    }

    res.json({ message: 'Profile updated', isComplete });
  } catch (err) {
    next(err);
  }
};

// POST /api/profile/photos
// Files arrive as buffers in memory (multer memoryStorage) — streamed straight to Cloudinary.
// Nothing is ever written to local disk, so this works on any cloud host.
const uploadPhotos = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const countResult = await query(
      'SELECT COUNT(*) FROM profile_photos WHERE user_id = $1',
      [req.user.id]
    );
    const current = parseInt(countResult.rows[0].count);
    if (current + req.files.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 photos allowed' });
    }

    const uploaded = [];

    for (const file of req.files) {
      // Stream buffer → Cloudinary CDN (auto-thumbnail generated server-side)
      const { url, thumbnailUrl, publicId } = await uploadPhoto(file.buffer, req.user.id);

      const isPrimary = current === 0 && uploaded.length === 0;

      const result = await query(
        `INSERT INTO profile_photos
           (user_id, url, thumbnail_url, cloudinary_public_id, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          req.user.id,
          url,
          thumbnailUrl,
          publicId,
          isPrimary,
          current + uploaded.length,
        ]
      );
      uploaded.push(result.rows[0]);
    }

    res.status(201).json({ photos: uploaded });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/profile/photos/:photoId
const deletePhotoHandler = async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM profile_photos WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.photoId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Remove from Cloudinary (non-blocking)
    deletePhoto(result.rows[0].cloudinary_public_id);

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile/photos/:photoId/primary
const setPrimaryPhoto = async (req, res, next) => {
  try {
    await query(
      'UPDATE profile_photos SET is_primary = false WHERE user_id = $1',
      [req.user.id]
    );
    const result = await query(
      'UPDATE profile_photos SET is_primary = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.photoId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.json({ message: 'Primary photo updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadPhotos,
  deletePhoto: deletePhotoHandler,
  setPrimaryPhoto,
};
