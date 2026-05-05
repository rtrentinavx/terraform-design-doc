// Shared Upstash Redis cache helper.
// Gracefully no-ops if env vars are not set — cache is optional,
// app works fine without it (falls back to direct fetch every time).

let _redis = null;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // Lazy import to avoid errors when package isn't installed
  try {
    const { Redis } = require("@upstash/redis");
    _redis = new Redis({ url, token });
  } catch {
    _redis = null;
  }
  return _redis;
}

export async function cacheGet(key) {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  try {
    const r = getRedis();
    if (!r) return;
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache write failure is non-fatal
  }
}
