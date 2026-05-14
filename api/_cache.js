import { Redis } from "@upstash/redis";

let _redis = null;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
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

// Synchronous check: are the Upstash Redis env vars set? Doesn't ping the
// server — only confirms client construction succeeded. Use to distinguish
// "key not found" (404) from "service not configured" (503) in callers.
export function isRedisAvailable() {
  return getRedis() !== null;
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
