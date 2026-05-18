/**
 * Resolve a photo URL that could be:
 *   - An absolute Cloudinary URL (https://res.cloudinary.com/...)  → return as-is
 *   - A legacy relative path (/uploads/...)                        → prepend BACKEND_URL
 *   - Null / undefined                                              → return fallback
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function photoUrl(url, fallback = '/default-avatar.png') {
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_URL}${url}`;
}
