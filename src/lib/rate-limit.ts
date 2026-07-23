import { createHmac } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Checkout rate limiter. When all three Upstash variables are configured this
// uses a shared fixed-window limiter backed by Upstash Redis, so the limit holds
// across every serverless instance. When none are configured it uses the bounded
// in-memory limiter below, which keeps local development simple (single
// instance). Any shared-store failure falls back to the in-memory limiter for
// that one request rather than failing the checkout.

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  isAllowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitWindow = {
  count: number;
  resetAt: number;
};

// Bound the map so a flood of unique keys cannot grow memory without limit.
const MAX_TRACKED_KEYS = 10000;

const rateLimitWindows = new Map<string, RateLimitWindow>();

function pruneExpiredWindows(now: number) {
  for (const [key, window] of rateLimitWindows) {
    if (window.resetAt <= now) {
      rateLimitWindows.delete(key);
    }
  }
}

function evictOldestWindow() {
  // Map preserves insertion order, so the first key is the oldest window.
  const oldestKey = rateLimitWindows.keys().next().value;

  if (oldestKey !== undefined) {
    rateLimitWindows.delete(oldestKey);
  }
}

function checkRateLimitInMemory(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const existingWindow = rateLimitWindows.get(key);

  if (!existingWindow || existingWindow.resetAt <= now) {
    if (rateLimitWindows.size >= MAX_TRACKED_KEYS) {
      pruneExpiredWindows(now);
    }

    if (rateLimitWindows.size >= MAX_TRACKED_KEYS) {
      evictOldestWindow();
    }

    rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs });

    return { isAllowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existingWindow.count >= limit) {
    return {
      isAllowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existingWindow.resetAt - now) / 1000),
      ),
    };
  }

  existingWindow.count += 1;

  return {
    isAllowed: true,
    remaining: limit - existingWindow.count,
    retryAfterSeconds: 0,
  };
}

// --- Shared Upstash Redis limiter -------------------------------------------

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const rateLimitHashSecret = process.env.RATE_LIMIT_HASH_SECRET;

const configuredVarCount = [
  upstashUrl,
  upstashToken,
  rateLimitHashSecret,
].filter((value) => Boolean(value)).length;

const hasFullUpstashConfig = configuredVarCount === 3;
const hasPartialUpstashConfig =
  configuredVarCount > 0 && configuredVarCount < 3;

if (hasPartialUpstashConfig) {
  // Names only, never values: a partial configuration is a mistake, so fail
  // loudly here but keep serving checkout via the in-memory fallback.
  console.error(
    "Rate limiter: incomplete Upstash configuration — set all of " +
      "UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, RATE_LIMIT_HASH_SECRET " +
      "(or none). Using in-memory fallback.",
  );
}

// Reused across invocations of a warm instance. The client is HTTP-based, so it
// holds no socket to leak.
const redis = hasFullUpstashConfig
  ? new Redis({ url: upstashUrl!, token: upstashToken! })
  : null;

// One Ratelimit object per (limit, windowMs) pair, created once and reused.
const ratelimiterCache = new Map<string, Ratelimit>();

function getSharedRatelimiter(
  limit: number,
  windowMs: number,
): Ratelimit | null {
  if (!redis) {
    return null;
  }

  const cacheKey = `${limit}:${windowMs}`;
  const cached = ratelimiterCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const ratelimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
    analytics: false,
    // Fail fast if Redis is slow; the built-in timeout lets the request pass.
    timeout: 500,
    prefix: "checkout-ratelimit",
  });

  ratelimiterCache.set(cacheKey, ratelimiter);

  return ratelimiter;
}

// The Redis identifier is only ever the HMAC of the namespaced key, so the raw
// client IP is never stored while the namespace still maps deterministically.
function hashRateLimitKey(key: string): string {
  return createHmac("sha256", rateLimitHashSecret!).update(key).digest("hex");
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const ratelimiter = getSharedRatelimiter(options.limit, options.windowMs);

  if (ratelimiter && rateLimitHashSecret) {
    try {
      const result = await ratelimiter.limit(hashRateLimitKey(key));

      if (result?.reason === "timeout") {
        // The built-in timeout let this request pass because the store was too
        // slow. Treat that as a shared-store failure and fall back to the
        // in-memory limiter rather than silently failing open.
        console.warn(
          "Rate limiter: shared store timed out — using in-memory fallback for this request.",
        );
      } else if (
        result &&
        typeof result.success === "boolean" &&
        Number.isFinite(result.reset)
      ) {
        return {
          isAllowed: result.success,
          remaining: Math.max(0, Math.trunc(result.remaining ?? 0)),
          retryAfterSeconds: result.success
            ? 0
            : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        };
      }
      // A timeout or an otherwise unusable result falls through to the
      // in-memory limiter below.
    } catch {
      console.warn(
        "Rate limiter: shared store unavailable — using in-memory fallback for this request.",
      );
    }
  }

  return checkRateLimitInMemory(key, options);
}

// Hosting proxies such as Vercel put the originating client IP first in
// x-forwarded-for. These headers are only trustworthy behind a proxy that
// overwrites them, so a direct-to-Node deployment must not trust them blindly.
export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}
