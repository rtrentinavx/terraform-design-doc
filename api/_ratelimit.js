import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _limiters = null;

function getLimiters() {
  if (_limiters) return _limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const redis = new Redis({ url, token });
    _limiters = {
      // AI endpoints: 20 requests per hour per IP
      ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h"), prefix: "rl:ai" }),
      // Share endpoint: 30 requests per hour per IP
      share: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 h"), prefix: "rl:share" }),
    };
  } catch {
    _limiters = null;
  }
  return _limiters;
}

function getIp(req) {
  return (
    req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers?.["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Returns true if the request should be blocked (rate limit exceeded).
 * Writes a 429 response and returns true; caller should return immediately.
 * Silently passes through if Redis is not configured.
 */
export async function rateLimit(req, res, limiterKey = "ai") {
  const limiters = getLimiters();
  if (!limiters) return false;
  const limiter = limiters[limiterKey];
  if (!limiter) return false;
  try {
    const ip = getIp(req);
    const { success, limit, remaining, reset } = await limiter.limit(ip);
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", reset);
    if (!success) {
      res.status(429).json({ error: "Too many requests — please wait before trying again." });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
