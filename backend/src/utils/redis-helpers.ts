// Redis utility helpers - replaces redis.keys() with SCAN for production safety
import redis from "../plugins/redis.js";
import { loggers } from "./logger.js";

const logger = loggers.redis;

/**
 * Scan and delete keys matching a pattern using SCAN (non-blocking).
 * Unlike redis.keys() which is O(N) and blocks the event loop,
 * SCAN iterates incrementally using a cursor.
 */
export async function scanAndDelete(pattern: string, context?: string): Promise<number> {
  let cursor = "0";
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  if (deletedCount > 0 && context) {
    logger.info({ pattern, deletedCount, context }, `Invalidated ${deletedCount} cache keys`);
  }

  return deletedCount;
}

/** Scan keys matching a pattern using SCAN (non-blocking replacement for redis.keys) */
export async function scanKeys(pattern: string): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== "0");

  return allKeys;
}

/** Invalidate all leaderboard cache entries */
export async function invalidateLeaderboardCache(context: string): Promise<void> {
  try {
    await scanAndDelete("leaderboard:*", context);
  } catch (error) {
    logger.warn({ error, context }, "Failed to invalidate leaderboard cache");
  }
}
