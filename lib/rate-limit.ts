/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  windowMs?: number  // Time window in milliseconds
  maxRequests?: number  // Maximum requests per window
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for a given key (usually IP address)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const { windowMs = 60 * 1000, maxRequests = 30 } = options
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  // Create new entry or reset if window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  const allowed = entry.count <= maxRequests
  const remaining = Math.max(0, maxRequests - entry.count)

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limit configuration presets
 */
export const rateLimitPresets = {
  // Public API (generous limits for scanning)
  public: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute

  // Auth API (stricter limits to prevent brute force)
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 requests per 15 minutes

  // Admin API (moderate limits)
  admin: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
}
