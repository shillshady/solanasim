import { loggers } from "../utils/logger.js";
const logger = loggers.redis;

// Redis client for caching
import Redis from "ioredis";

// Create Redis connection with better error handling
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
logger.info("Connecting to Redis");
logger.info({ url: redisUrl.replace(/:[^:]*@/, ':***@') }, "Redis URL");

// Validate URL format
try {
  const url = new URL(redisUrl);
  logger.info({ hostname: url.hostname, port: url.port }, "Redis target");
} catch (error: any) {
  logger.error({ error: error.message }, "Invalid Redis URL format");
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false, // Disable offline queue to fail fast
  connectTimeout: 10000, // Increased to 10s for Railway network latency
  commandTimeout: 5000, // Increased to 5s
  // Retry strategy with exponential backoff
  retryStrategy(times) {
    if (times > 5) {
      logger.error("Redis connection failed after 5 retries");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 500, 3000); // Max 3s delay
    logger.info({ attempt: times, delayMs: delay }, "Redis retry");
    return delay;
  },
  // Reconnect on error for better resilience
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some(target => err.message.includes(target))) {
      logger.warn({ reason: err.message }, "Redis reconnecting");
      return true;
    }
    return false;
  }
});

redis.on("error", (err: Error) => {
  // Log Redis errors for debugging, but don't crash the app
  logger.error({ error: err.message }, "Redis client error");
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});

redis.on("close", () => {
  logger.warn("Disconnected from Redis");
});

// Test Redis connection and handle gracefully
redis.connect()
  .then(() => {
    logger.info("Redis connected successfully");
  })
  .catch((err) => {
    logger.error({ error: err.message }, "Redis connection failed");
    logger.warn("App will continue without Redis caching");
  });

export default redis;