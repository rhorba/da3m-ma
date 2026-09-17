/**
 * Rate limiting (Story 3.6). One interface, one in-process implementation for now;
 * Upstash Redis replaces the store before public beta without touching callers (ADR-9).
 */

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  /** Requests still available in the current window. */
  remaining: number;
  /** Epoch ms at which the window frees a slot; the caller turns this into Retry-After. */
  resetAt: number;
};

export type RateLimiter = {
  /** Records one hit against every key and allows the request only if all of them fit. */
  limit(keys: readonly string[]): Promise<RateLimitDecision>;
};

export type WindowConfig = {
  limit: number;
  windowMs: number;
};

/** Wizard submits per identity per hour: generous for a human, useless for a scraper. */
export const WIZARD_SUBMIT_WINDOW: WindowConfig = { limit: 20, windowMs: 60 * 60 * 1000 };

export type MemoryLimiterDeps = {
  /** Injectable so tests move time instead of waiting for it. */
  now?: () => number;
};

/**
 * Sliding-window log. Exact at the boundary, unlike a fixed window, and small: a key
 * holds at most `limit` timestamps.
 *
 * Counts are per process. On serverless that means the effective ceiling is
 * `limit × instances`, which is a throttle rather than a guarantee — acceptable
 * pre-beta, replaced by Upstash before the wizard is public (ADR-9).
 */
export function createMemoryRateLimiter(
  config: WindowConfig,
  deps: MemoryLimiterDeps = {},
): RateLimiter {
  const now = deps.now ?? Date.now;
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  /** Drops keys nobody has touched for a full window, so idle traffic cannot grow the map. */
  function sweep(at: number): void {
    if (at - lastSweep < config.windowMs) return;
    lastSweep = at;
    for (const [key, timestamps] of hits) {
      if (timestamps.every((t) => t <= at - config.windowMs)) hits.delete(key);
    }
  }

  function recent(key: string, at: number): number[] {
    const cutoff = at - config.windowMs;
    const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
    hits.set(key, kept);
    return kept;
  }

  return {
    async limit(keys) {
      const at = now();
      sweep(at);

      const windows = keys.map((key) => ({ key, timestamps: recent(key, at) }));
      const blocked = windows.filter((w) => w.timestamps.length >= config.limit);

      if (blocked.length > 0) {
        const oldest = Math.min(...blocked.map((w) => w.timestamps[0] ?? at));
        return {
          allowed: false,
          limit: config.limit,
          remaining: 0,
          resetAt: oldest + config.windowMs,
        };
      }

      for (const { key, timestamps } of windows) {
        timestamps.push(at);
        hits.set(key, timestamps);
      }

      const used = Math.max(0, ...windows.map((w) => w.timestamps.length));
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit - used,
        resetAt: at + config.windowMs,
      };
    },
  };
}

/**
 * The caller-supplied address of a visitor. Behind Vercel the left-most entry of
 * `x-forwarded-for` is the client; everything after it is proxy hops. The header is
 * attacker-controlled in principle, which is why the anonymous token is limited too.
 */
export function clientIpFrom(forwardedFor: string | null | undefined): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}
