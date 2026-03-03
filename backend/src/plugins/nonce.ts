// Secure nonce handling with Redis TTL
import crypto from 'crypto';
import redis from './redis.js';
import { loggers } from "../utils/logger.js";

const logger = loggers.nonce;

const NONCE_TTL = 300; // 5 minutes in seconds
const MAX_NONCE_ATTEMPTS = 3; // Maximum nonce generation attempts per wallet per hour
const NONCE_ATTEMPT_WINDOW = 3600; // 1 hour in seconds

export class NonceService {
  // Generate a secure nonce for wallet authentication
  static async generateNonce(walletAddress: string): Promise<string> {
    try {
      // Check rate limiting for nonce generation
      const attempts = await this.getNonceAttempts(walletAddress);
      if (attempts >= MAX_NONCE_ATTEMPTS) {
        throw new Error('Too many nonce requests. Please try again in an hour.');
      }

      // Generate cryptographically secure nonce
      const nonce = crypto.randomBytes(32).toString('hex');
      
      // Store nonce in Redis with TTL
      const nonceKey = `nonce:${walletAddress}`;
      await redis.setex(nonceKey, NONCE_TTL, nonce);
      
      // Track nonce generation attempts
      await this.incrementNonceAttempts(walletAddress);
      
      logger.info({ wallet: walletAddress.slice(0, 8), ttl: NONCE_TTL }, "Nonce generated");
      
      return nonce;
    } catch (error: any) {
      logger.error({ error }, "Failed to generate nonce");
      throw new Error(error.message || 'Failed to generate authentication nonce');
    }
  }

  // Verify and consume nonce
  static async verifyAndConsumeNonce(walletAddress: string, providedNonce: string): Promise<boolean> {
    try {
      const nonceKey = `nonce:${walletAddress}`;
      const storedNonce = await redis.get(nonceKey);
      
      if (!storedNonce) {
        logger.warn({ wallet: walletAddress.slice(0, 8) }, "Nonce verification failed: not found");
        return false;
      }

      if (storedNonce !== providedNonce) {
        logger.warn({ wallet: walletAddress.slice(0, 8) }, "Nonce verification failed: invalid");
        return false;
      }

      // Nonce is valid - consume it (delete from Redis)
      await redis.del(nonceKey);
      
      logger.info({ wallet: walletAddress.slice(0, 8) }, "Nonce verified and consumed");
      return true;
    } catch (error: any) {
      logger.error({ error }, "Failed to verify nonce");
      return false;
    }
  }

  // Check if nonce exists for wallet
  static async hasValidNonce(walletAddress: string): Promise<boolean> {
    try {
      const nonceKey = `nonce:${walletAddress}`;
      const nonce = await redis.get(nonceKey);
      return nonce !== null;
    } catch (error) {
      logger.error({ error }, "Failed to check nonce existence");
      return false;
    }
  }

  // Get remaining TTL for nonce
  static async getNonceTTL(walletAddress: string): Promise<number> {
    try {
      const nonceKey = `nonce:${walletAddress}`;
      return await redis.ttl(nonceKey);
    } catch (error) {
      logger.error({ error }, "Failed to get nonce TTL");
      return -1;
    }
  }

  // Track nonce generation attempts
  private static async incrementNonceAttempts(walletAddress: string): Promise<void> {
    try {
      const attemptsKey = `nonce_attempts:${walletAddress}`;
      const current = await redis.incr(attemptsKey);
      
      // Set expiry on first attempt
      if (current === 1) {
        await redis.expire(attemptsKey, NONCE_ATTEMPT_WINDOW);
      }
    } catch (error) {
      logger.error({ error }, "Failed to increment nonce attempts");
    }
  }

  // Get current nonce generation attempts
  private static async getNonceAttempts(walletAddress: string): Promise<number> {
    try {
      const attemptsKey = `nonce_attempts:${walletAddress}`;
      const attempts = await redis.get(attemptsKey);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      logger.error({ error }, "Failed to get nonce attempts");
      return 0;
    }
  }

  // Clean up expired nonces (maintenance function)
  static async cleanupExpiredNonces(): Promise<number> {
    try {
      const { scanKeys } = await import("../utils/redis-helpers.js");
      const keys = await scanKeys('nonce:*');
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          await redis.del(key);
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      logger.error({ error }, "Failed to cleanup expired nonces");
      return 0;
    }
  }

  // Get nonce statistics (for monitoring)
  static async getStatistics(): Promise<{
    activeNonces: number;
    expiringSoon: number;
  }> {
    try {
      const { scanKeys } = await import("../utils/redis-helpers.js");
      const keys = await scanKeys('nonce:*');
      let expiringSoon = 0;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl > 0 && ttl <= 60) {
          expiringSoon++;
        }
      }

      return {
        activeNonces: keys.length,
        expiringSoon
      };
    } catch (error) {
      logger.error({ error }, "Failed to get nonce statistics");
      return { activeNonces: 0, expiringSoon: 0 };
    }
  }

  // Create Sign-In With Solana message
  static createSIWSMessage(walletAddress: string, nonce: string, domain?: string): string {
    const timestamp = new Date().toISOString();
    const domainName = domain || 'solanasim.fun';
    
    return [
      `${domainName} wants you to sign in with your Solana account:`,
      walletAddress,
      '',
      'Welcome to Solana Sim - the ultimate Solana paper trading simulator!',
      '',
      `URI: https://${domainName}`,
      `Version: 1`,
      `Chain ID: solana:mainnet`,
      `Nonce: ${nonce}`,
      `Issued At: ${timestamp}`,
      `Expiration Time: ${new Date(Date.now() + NONCE_TTL * 1000).toISOString()}`
    ].join('\n');
  }
}

// Background cleanup service
export class NonceCleanupService {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static start(): void {
    if (this.interval) {
      return; // Already running
    }

    logger.info("Starting nonce cleanup service");
    
    this.interval = setInterval(async () => {
      try {
        await NonceService.cleanupExpiredNonces();
      } catch (error) {
        logger.error({ error }, "Nonce cleanup service error");
      }
    }, this.CLEANUP_INTERVAL);
  }

  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info("Stopped nonce cleanup service");
    }
  }
}