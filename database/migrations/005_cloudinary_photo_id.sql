-- Migration 005: add cloudinary_public_id to profile_photos
-- Needed so we can delete photos from Cloudinary when a user removes them.

ALTER TABLE profile_photos
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
