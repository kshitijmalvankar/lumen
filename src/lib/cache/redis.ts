import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isRedisConfigured } from "@/lib/env";
import { TIER_LIMITS, type Tier } from "@/lib/billing/entitlements";

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

// One Upstash sliding-window limiter per cap value (memoized). Different tiers
// have different caps, so we key the limiter by its hourly limit.
const _limiters = new Map<number, Ratelimit>();
function hourlyLimiter(limit: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  let l = _limiters.get(limit);
  if (!l) {
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, "1 h"),
      prefix: `rl:tier:${limit}`,
    });
    _limiters.set(limit, l);
  }
  return l;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-user, **tier-scaled** hourly search limit (caps live in TIER_LIMITS).
 *
 * Prefers an Upstash sliding window when Redis is configured. Otherwise falls
 * back to counting the user's own `searches` rows in the trailing hour — a true
 * rolling window that needs no extra infra (RLS already scopes the count to the
 * caller, and there's an index on (user_id, created_at)). Counting errors fail
 * open so a transient DB glitch never blocks a legitimate search.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  tier: Tier,
): Promise<RateLimitResult> {
  const limit = TIER_LIMITS[tier].searchesPerHour;

  const limiter = hourlyLimiter(limit);
  if (limiter) {
    try {
      const { success, remaining } = await limiter.limit(`u:${userId}`);
      return { allowed: success, remaining, limit };
    } catch (err) {
      // An Upstash hiccup should degrade to the DB count, not 500 the request.
      console.error("checkRateLimit: Upstash error; falling back to DB count:", err);
    }
  }

  // DB fallback: how many searches has this user started in the last hour?
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error } = await supabase
    .from("searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) {
    console.error("checkRateLimit: DB fallback count failed; failing open:", error);
    return { allowed: true, remaining: -1, limit };
  }

  const used = count ?? 0;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}

// Follow-up chat (Max-only) is cheaper and more interactive than a full search,
// so it gets its own generous hourly cap independent of the search budget.
const CHAT_HOURLY_LIMIT = 120;

let _chatLimiter: Ratelimit | undefined;
function chatLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_chatLimiter) {
    _chatLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CHAT_HOURLY_LIMIT, "1 h"),
      prefix: "rl:chat",
    });
  }
  return _chatLimiter;
}

/**
 * Per-user hourly cap on follow-up chat messages. Mirrors checkRateLimit:
 * Upstash sliding window when configured, else counts the user's own `messages`
 * rows in the trailing hour (RLS-scoped). Fails open on error.
 */
export async function checkChatRateLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<RateLimitResult> {
  const limit = CHAT_HOURLY_LIMIT;

  const limiter = chatLimiter();
  if (limiter) {
    try {
      const { success, remaining } = await limiter.limit(`u:${userId}`);
      return { allowed: success, remaining, limit };
    } catch (err) {
      console.error("checkChatRateLimit: Upstash error; falling back to DB count:", err);
    }
  }

  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", since);
  if (error) {
    console.error("checkChatRateLimit: DB fallback count failed; failing open:", error);
    return { allowed: true, remaining: -1, limit };
  }

  const used = count ?? 0;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}
