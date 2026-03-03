// Rate limiting middleware with Redis backend
import { FastifyRequest, FastifyReply } from 'fastify';
import redis from './redis.js';
import { loggers } from "../utils/logger.js";

const logger = loggers.rateLimiting;

interface RateLimitConfig {
  max: number; // Maximum requests
  windowMs: number; // Time window in milliseconds
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  statusCode?: number;
}

interface RateLimitInfo {
  totalHits: number;
  resetTime: number;
  remaining: number;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      max: config.max,
      windowMs: config.windowMs,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      message: config.message || 'Too many requests, please try again later',
      statusCode: config.statusCode || 429
    };
  }

  private defaultKeyGenerator(request: FastifyRequest): string {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return `rate_limit:${ip}`;
  }

  async checkLimit(request: FastifyRequest): Promise<RateLimitInfo> {
    const key = this.config.keyGenerator(request);
    const windowStart = Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs;
    const redisKey = `${key}:${windowStart}`;

    try {
      // Increment counter
      const totalHits = await redis.incr(redisKey);
      
      // Set expiry on first request in window
      if (totalHits === 1) {
        await redis.pexpire(redisKey, this.config.windowMs);
      }

      const resetTime = windowStart + this.config.windowMs;
      const remaining = Math.max(0, this.config.max - totalHits);

      return {
        totalHits,
        resetTime,
        remaining
      };
    } catch (error) {
      logger.error({ err: error }, "Rate limit check failed");
      // On Redis failure, allow the request through
      return {
        totalHits: 1,
        resetTime: Date.now() + this.config.windowMs,
        remaining: this.config.max - 1
      };
    }
  }

  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const limitInfo = await this.checkLimit(request);

      // Add rate limit headers
      reply.header('X-RateLimit-Limit', this.config.max);
      reply.header('X-RateLimit-Remaining', limitInfo.remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(limitInfo.resetTime / 1000));

      if (limitInfo.totalHits > this.config.max) {
        reply.header('Retry-After', Math.ceil((limitInfo.resetTime - Date.now()) / 1000));
        
        return reply.code(this.config.statusCode).send({
          error: 'RATE_LIMIT_EXCEEDED',
          message: this.config.message,
          retryAfter: Math.ceil((limitInfo.resetTime - Date.now()) / 1000)
        });
      }
    };
  }
}

// Pre-configured rate limiters for different endpoint types
export const rateLimiters = {
  // Strict rate limiting for auth endpoints
  auth: new RateLimiter({
    max: 5, // 5 requests
    windowMs: 15 * 60 * 1000, // per 15 minutes
    message: 'Too many authentication attempts, please try again in 15 minutes',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      // Include email/wallet in key for more granular limiting
      const body = req.body as any;
      const identifier = body?.email || body?.walletAddress || 'unknown';
      return `auth_limit:${ip}:${identifier}`;
    }
  }),

  // Medium rate limiting for wallet operations  
  wallet: new RateLimiter({
    max: 10, // 10 requests
    windowMs: 5 * 60 * 1000, // per 5 minutes
    message: 'Too many wallet requests, please try again in 5 minutes',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const body = req.body as any;
      const walletAddress = body?.walletAddress || 'unknown';
      return `wallet_limit:${ip}:${walletAddress}`;
    }
  }),

  // Moderate rate limiting for trading
  trading: new RateLimiter({
    max: 100, // 100 trades
    windowMs: 60 * 1000, // per minute
    message: 'Trading rate limit exceeded, please slow down',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const body = req.body as any;
      const userId = body?.userId || 'unknown';
      return `trade_limit:${ip}:${userId}`;
    }
  }),

  // General API rate limiting
  general: new RateLimiter({
    max: 1000, // 1000 requests
    windowMs: 60 * 1000, // per minute
    message: 'API rate limit exceeded, please slow down',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `api_limit:${ip}`;
    }
  }),

  // Aggressive rate limiting for password reset/sensitive operations
  sensitive: new RateLimiter({
    max: 3, // 3 requests
    windowMs: 60 * 60 * 1000, // per hour
    message: 'Too many sensitive requests, please try again in an hour',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const body = req.body as any;
      const identifier = body?.email || body?.userId || 'unknown';
      return `sensitive_limit:${ip}:${identifier}`;
    }
  })
};

// Middleware functions for easy use
export const authRateLimit = rateLimiters.auth.createMiddleware();
export const walletRateLimit = rateLimiters.wallet.createMiddleware();
export const tradingRateLimit = rateLimiters.trading.createMiddleware();
export const generalRateLimit = rateLimiters.general.createMiddleware();
export const sensitiveRateLimit = rateLimiters.sensitive.createMiddleware();

// Custom rate limiter for specific use cases
export function createCustomRateLimit(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);
  return limiter.createMiddleware();
}

// Rate limit monitoring and statistics
export class RateLimitMonitor {
  static async getStatistics(): Promise<{
    auth: number;
    wallet: number;
    trading: number;
    general: number;
    sensitive: number;
  }> {
    try {
      const patterns = {
        auth: 'auth_limit:*',
        wallet: 'wallet_limit:*',
        trading: 'trade_limit:*',
        general: 'api_limit:*',
        sensitive: 'sensitive_limit:*'
      };

      const { scanKeys } = await import("../utils/redis-helpers.js");

      const result = { auth: 0, wallet: 0, trading: 0, general: 0, sensitive: 0 };
      for (const [type, pattern] of Object.entries(patterns)) {
        const keys = await scanKeys(pattern);
        result[type as keyof typeof result] = keys.length;
      }

      return result;
    } catch (error) {
      logger.error({ err: error }, "Failed to get rate limit statistics");
      return { auth: 0, wallet: 0, trading: 0, general: 0, sensitive: 0 };
    }
  }

  static async clearExpiredLimits(): Promise<number> {
    try {
      const { scanKeys } = await import("../utils/redis-helpers.js");
      const patterns = [
        'auth_limit:*',
        'wallet_limit:*',
        'trade_limit:*',
        'api_limit:*',
        'sensitive_limit:*'
      ];

      let cleared = 0;

      for (const pattern of patterns) {
        const keys = await scanKeys(pattern);

        for (const key of keys) {
          const ttl = await redis.ttl(key);
          if (ttl <= 0) {
            await redis.del(key);
            cleared++;
          }
        }
      }

      return cleared;
    } catch (error) {
      logger.error({ err: error }, "Failed to clear expired rate limits");
      return 0;
    }
  }
}

// Background cleanup for rate limit keys
export class RateLimitCleanupService {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

  static start(): void {
    if (this.interval) {
      return; // Already running
    }

    logger.info("Starting rate limit cleanup service");
    
    this.interval = setInterval(async () => {
      try {
        await RateLimitMonitor.clearExpiredLimits();
      } catch (error) {
        logger.error({ err: error }, "Rate limit cleanup service error");
      }
    }, this.CLEANUP_INTERVAL);
  }

  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info("Stopped rate limit cleanup service");
    }
  }
}