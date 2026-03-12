/**
 * Simple Rate Limiter for Vercel Serverless Functions
 * 
 * Uses in-memory storage with sliding window approach.
 * Note: For production with multiple instances, consider using Redis.
 * 
 * SEC-001: Implements rate limiting for API security
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets when function cold starts)
const ipRequests = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [ip, entry] of ipRequests.entries()) {
    if (entry.resetTime < now) {
      ipRequests.delete(ip);
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;   // Seconds until rate limit resets
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries();
  
  const now = Date.now();
  const entry = ipRequests.get(ip);
  
  // No previous requests from this IP
  if (!entry || entry.resetTime < now) {
    ipRequests.set(ip, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }
  
  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter
    };
  }
  
  // Increment count
  entry.count++;
  ipRequests.set(ip, entry);
  
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Get client IP from request
 */
export function getClientIP(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or an error response if rate limited
 */
export function applyRateLimit(
  req: any,
  res: any,
  config: RateLimitConfig
): boolean {
  const ip = getClientIP(req);
  const result = checkRateLimit(ip, config);
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetTime);
  
  if (!result.success) {
    res.setHeader('Retry-After', result.retryAfter);
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter
    });
    return false;
  }
  
  return true;
}

// Common rate limit configurations
export const RATE_LIMITS = {
  // Strict limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10            // 10 attempts per 15 minutes
  },
  // Moderate limit for image processing (expensive operation)
  imageProcessing: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 5             // 5 scans per minute
  },
  // Standard API limit
  standard: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 60            // 60 requests per minute
  }
};
