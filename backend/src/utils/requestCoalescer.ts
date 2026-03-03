/**
 * Request Coalescer - Deduplicates concurrent requests to prevent duplicate API calls
 *
 * When 100 users request portfolio data simultaneously, instead of making 100 DB queries,
 * we make 1 query and share the result with all pending requests.
 *
 * Critical for preventing:
 * - Database connection exhaustion
 * - External API rate limit violations
 * - Redis connection flooding
 */

import logger from '../utils/logger.js';

type PendingRequest<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
};

export class RequestCoalescer {
  private pending = new Map<string, PendingRequest<any>>();
  private stats = {
    hits: 0,      // Coalesced requests (saved API calls)
    misses: 0,    // First requests (actual API calls)
    errors: 0,    // Failed coalesced requests
    savings: 0    // Total requests saved
  };

  /**
   * Coalesce requests by key
   * @param key Unique identifier for the request
   * @param fn Function to execute if not already pending
   * @param ttlMs Time to live for pending request (default: 5000ms)
   */
  async coalesce<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    // Check if request is already pending
    const existing = this.pending.get(key);

    if (existing) {
      // Check if request is still valid (not expired)
      if (Date.now() - existing.timestamp < ttlMs) {
        this.stats.hits++;
        this.stats.savings++;
        logger.debug({ key, totalSavings: this.stats.savings }, "Coalesced request");
        return existing.promise;
      } else {
        // Expired, remove it
        this.pending.delete(key);
      }
    }

    // Create new pending request
    this.stats.misses++;

    let resolve!: (value: T) => void;
    let reject!: (error: any) => void;

    const promise = new Promise<T>((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    const pendingRequest: PendingRequest<T> = {
      promise,
      resolve,
      reject,
      timestamp: Date.now()
    };

    this.pending.set(key, pendingRequest);

    try {
      // Execute the function
      const result = await fn();

      // Resolve all pending requests with same key
      resolve(result);

      // Clean up
      this.pending.delete(key);

      return result;
    } catch (error) {
      this.stats.errors++;

      // Reject all pending requests with same key
      reject(error);

      // Clean up
      this.pending.delete(key);

      throw error;
    }
  }

  /**
   * Clear stale pending requests (older than TTL)
   */
  cleanup(ttlMs: number = 5000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, request] of this.pending.entries()) {
      if (now - request.timestamp > ttlMs) {
        this.pending.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.debug({ cleared }, "Cleared stale coalesced requests");
    }

    return cleared;
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.pending.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0, errors: 0, savings: 0 };
  }

  /**
   * Invalidate a specific cache key
   * Useful for forcing fresh data after mutations (e.g., after trades)
   */
  invalidate(key: string): boolean {
    return this.pending.delete(key);
  }

  /**
   * Invalidate all cache keys matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let cleared = 0;
    for (const key of this.pending.keys()) {
      if (key.includes(pattern)) {
        this.pending.delete(key);
        cleared++;
      }
    }
    return cleared;
  }
}

// Global coalescer instances for different use cases
export const portfolioCoalescer = new RequestCoalescer();
export const priceCoalescer = new RequestCoalescer();
export const tokenMetadataCoalescer = new RequestCoalescer();

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  portfolioCoalescer.cleanup(10000);    // 10s TTL for portfolio data
  priceCoalescer.cleanup(5000);         // 5s TTL for price data
  tokenMetadataCoalescer.cleanup(30000); // 30s TTL for metadata
}, 30000); // Run cleanup every 30 seconds

// Log stats periodically in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const stats = {
      portfolio: portfolioCoalescer.getStats(),
      price: priceCoalescer.getStats(),
      metadata: tokenMetadataCoalescer.getStats()
    };

    logger.info({ stats }, "Request coalescing stats");
  }, 5 * 60 * 1000); // Every 5 minutes
}
