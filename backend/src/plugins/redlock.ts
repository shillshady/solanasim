// Distributed locking for preventing race conditions in concurrent operations
// @ts-ignore - redlock types are not fully compatible with ESM
import Redlock from 'redlock';
import redis from './redis.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.redis;

// Create Redlock instance with Redis client
const redlock = new Redlock(
  [redis],
  {
    // Retry configuration
    driftFactor: 0.01, // Expected clock drift (1%)
    retryCount: 3, // Number of times to retry before giving up
    retryDelay: 200, // Time in ms to wait between retries
    retryJitter: 200, // Random jitter to add to retries

    // Automatic extension configuration
    automaticExtensionThreshold: 500, // Time in ms before lock expiration to auto-extend
  }
);

// Error handling
redlock.on('error', (error: Error) => {
  logger.error({ err: error }, "Redlock error");
});

export default redlock;
