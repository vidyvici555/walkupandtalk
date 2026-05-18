const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure once on require
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Upload a buffer to Cloudinary.
 * Returns { url, thumbnailUrl, publicId }
 */
async function uploadPhoto(buffer, userId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:         `walkupandtalk/profiles/${userId}`,
        resource_type:  'image',
        // Auto-generate a thumbnail transformation
        eager: [
          { width: 200, height: 200, crop: 'fill', gravity: 'face', quality: 'auto' },
        ],
        eager_async:    false,
        quality:        'auto',
        fetch_format:   'auto',   // serve WebP to browsers that support it
      },
      (error, result) => {
        if (error) return reject(error);

        const thumbnailUrl = result.eager?.[0]?.secure_url
          // Fallback: derive thumbnail URL from the main URL using Cloudinary transformations
          || result.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,g_face,q_auto/');

        resolve({
          url:          result.secure_url,
          thumbnailUrl,
          publicId:     result.public_id,
        });
      }
    );

    // Pipe the in-memory buffer into the upload stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Delete a photo from Cloudinary by its public_id.
 * Non-fatal — logs a warning if deletion fails.
 */
async function deletePhoto(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary] Failed to delete:', publicId, err.message);
  }
}

module.exports = { uploadPhoto, deletePhoto };
