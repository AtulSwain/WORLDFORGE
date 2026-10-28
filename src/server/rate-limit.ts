import "server-only";
import { AppError } from "./errors";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single instance; replace with a shared
 * store (e.g. Redis) when running multiple instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  bucket.count++;
  if (bucket.count > limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new AppError(`Too many requests. Try again in ${seconds}s.`, "RATE_LIMITED");
  }
}
