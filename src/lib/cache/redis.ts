import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env, isRedisConfigured } from "@/lib/env";

let _redis: Redis | undefined;

export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!_redis) {
    _redis = new Redis({
      url: env.upstashRedisUrl,
      token: env.upstashRedisToken,
    });
  }
  return _redis;
}

/* ----------------------------- cache ----------------------------- */

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return (await redis.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache is best-effort; never fail the request because of it.
  }
}

/* -------------------------- rate limiting ------------------------ */

let _quickLimiter: Ratelimit | undefined;
let _deepLimiter: Ratelimit | undefined;

function quickLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_quickLimiter) {
    _quickLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:quick",
    });
  }
  return _quickLimiter;
}

function deepLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_deepLimiter) {
    _deepLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:deep",
    });
  }
  return _deepLimiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Per-user rate limit. Returns `allowed: true` when Redis isn't configured
 * (local dev) so the app still works without it.
 */
export async function checkRateLimit(
  userId: string,
  mode: "quick" | "deep",
): Promise<RateLimitResult> {
  const limiter = mode === "deep" ? deepLimiter() : quickLimiter();
  if (!limiter) return { allowed: true, remaining: -1, limit: -1 };
  const { success, remaining, limit } = await limiter.limit(userId);
  return { allowed: success, remaining, limit };
}
