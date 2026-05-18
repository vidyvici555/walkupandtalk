const Redis = require('ioredis');

let redis = null;
let redisAvailable = false;

try {
  // Prefer REDIS_URL (Upstash / any cloud provider).
  // rediss:// = TLS (required by Upstash). redis:// = plain (local dev).
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
    });
  } else {
    // Local fallback (dev without cloud Redis)
    redis = new Redis({
      host:     process.env.REDIS_HOST || 'localhost',
      port:     parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      connectTimeout: 3000,
    });
  }

  redis.on('connect', () => {
    redisAvailable = true;
    console.log('✅ Redis connected');
  });

  redis.on('error', () => {
    redisAvailable = false;
  });

  redis.connect().catch(() => {
    console.log('⚠️  Redis not available — running without cache (OK for development)');
    redisAvailable = false;
  });

} catch (err) {
  console.log('⚠️  Redis not available — running without cache (OK for development)');
}

// ── Safe wrappers — silently no-op if Redis is down ───────────────────────
const setEx = async (key, seconds, value) => {
  if (!redisAvailable) return null;
  try { return await redis.set(key, JSON.stringify(value), 'EX', seconds); } catch { return null; }
};

const get = async (key) => {
  if (!redisAvailable) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
};

const del = 