/**
 * Tiny in-memory fixed-window rate limiter for the App Proxy verify endpoint.
 *
 * NOTE: per-instance only. On serverless (Vercel) each instance has its own
 * window, so this is a lightweight abuse guard, not a global quota. A shared
 * limiter can replace it later without changing callers.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit = 20, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return { allowed, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}
