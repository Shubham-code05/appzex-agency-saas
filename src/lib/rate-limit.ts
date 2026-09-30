/**
 * Sliding-window rate limiter (in-memory, per server instance).
 * Good enough to stop accidental hammering of paid AI endpoints; use a shared
 * store (e.g. Redis) when running multiple instances.
 */
const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();

  // Periodically drop idle keys so the map can't grow without bound.
  if (now - lastSweep > windowMs) {
    for (const [k, stamps] of hits) if (stamps.every((t) => now - t > windowMs)) hits.delete(k);
    lastSweep = now;
  }

  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}
