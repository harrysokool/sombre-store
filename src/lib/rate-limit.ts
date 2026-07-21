// Minimal in-memory fixed-window rate limiter for the current single-instance
// MVP deployment. Counters live in the process that handled the request, so
// limits apply per instance rather than globally. Replace this module with a
// shared store (for example an Upstash/Redis backed limiter) once the app runs
// on more than one instance; callers only depend on the checkRateLimit
// signature below, not on how the counters are stored.

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

export function checkRateLimit(
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
