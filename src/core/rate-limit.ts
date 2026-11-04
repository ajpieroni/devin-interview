// In-memory sliding-window limiter. Fine for one process; a shared store
// (Redis, the database) is needed once the app runs on several instances.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false as const, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true as const, retryAfterSec: 0 };
}

export function resetRateLimits() {
  hits.clear();
}
