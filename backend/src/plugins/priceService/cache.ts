import redis from "../redis.js";
import { loggers } from "../../utils/logger.js";
import { LRUCache } from "../../utils/lru-cache.js";
import type { PriceTick, NegativeCacheEntry } from "./types.js";
import type { FallbackApis } from "./fallback-apis.js";

const logger = loggers.priceService;

const PRICE_FRESHNESS_THRESHOLD = 10 * 1000; // 10s
const PRICE_MAX_AGE = 60 * 1000; // 60s

/**
 * Multi-layer price cache: LRU memory -> Redis -> fallback APIs.
 * Implements stale-while-revalidate for low-latency reads.
 */
export class PriceCache {
  private priceCache: LRUCache<string, PriceTick>;
  private negativeCache: LRUCache<string, NegativeCacheEntry>;
  private fallbackApis: FallbackApis;
  private getSolPriceUsd: () => number;

  constructor(
    priceCache: LRUCache<string, PriceTick>,
    negativeCache: LRUCache<string, NegativeCacheEntry>,
    fallbackApis: FallbackApis,
    getSolPriceUsd: () => number
  ) {
    this.priceCache = priceCache;
    this.negativeCache = negativeCache;
    this.fallbackApis = fallbackApis;
    this.getSolPriceUsd = getSolPriceUsd;
  }

  async updatePrice(tick: PriceTick) {
    this.priceCache.set(tick.mint, tick);

    try {
      await redis.setex(`price:${tick.mint}`, 60, JSON.stringify(tick));
      await redis.publish("prices", JSON.stringify(tick));
    } catch (error) {
      logger.warn({ error }, "Redis cache/publish failed");
    }
  }

  async getLastTick(mint: string): Promise<PriceTick | null> {
    if (mint === "So11111111111111111111111111111111111111112") {
      const solPriceUsd = this.getSolPriceUsd();
      return {
        mint,
        priceUsd: solPriceUsd,
        priceSol: 1,
        solUsd: solPriceUsd,
        timestamp: Date.now(),
        source: "live"
      };
    }

    let tick = this.priceCache.get(mint);
    const isStale = tick && (Date.now() - tick.timestamp) > PRICE_FRESHNESS_THRESHOLD;
    const isTooOld = tick && (Date.now() - tick.timestamp) > PRICE_MAX_AGE;

    // Stale-while-revalidate: return stale data, refresh in background
    if (isStale && tick && !isTooOld) {
      this.fallbackApis.fetchTokenPrice(mint).then(freshTick => {
        if (freshTick) this.updatePrice(freshTick);
      }).catch(err => {
        logger.warn({ mint, error: err }, "Background refresh failed");
      });
      return tick;
    }

    if (isTooOld || !tick) {
      if (!tick) {
        try {
          const cached = await redis.get(`price:${mint}`);
          if (cached) {
            const redisTick = JSON.parse(cached);
            const isRedisTooOld = redisTick && (Date.now() - redisTick.timestamp) > PRICE_MAX_AGE;
            if (!isRedisTooOld && redisTick) {
              tick = redisTick;
              if (tick) this.priceCache.set(mint, tick);
            }
          }
        } catch (error) {
          logger.warn({ error }, "Redis get failed");
        }
      }

      if (isTooOld || !tick) {
        const fetchedTick = await this.fallbackApis.fetchTokenPrice(mint);
        if (fetchedTick) {
          await this.updatePrice(fetchedTick);
          tick = fetchedTick;
        }
      }
    }

    return tick || null;
  }

  async getLastTicks(mints: string[]): Promise<Map<string, PriceTick>> {
    const result = new Map<string, PriceTick>();
    const toFetch: string[] = [];
    const toRefreshInBackground: string[] = [];
    const solPriceUsd = this.getSolPriceUsd();

    for (const mint of mints) {
      if (mint === "So11111111111111111111111111111111111111112") {
        result.set(mint, {
          mint,
          priceUsd: solPriceUsd,
          priceSol: 1,
          solUsd: solPriceUsd,
          timestamp: Date.now(),
          source: "live"
        });
        continue;
      }

      const tick = this.priceCache.get(mint);
      const age = tick ? Date.now() - tick.timestamp : Infinity;
      const isStale = tick && age > PRICE_FRESHNESS_THRESHOLD;
      const isTooOld = tick && age > PRICE_MAX_AGE;

      if (tick && !isStale) {
        result.set(mint, tick);
      } else if (tick && isStale && !isTooOld) {
        result.set(mint, tick);
        toRefreshInBackground.push(mint);
      } else {
        toFetch.push(mint);
      }
    }

    if (toRefreshInBackground.length > 0) {
      Promise.all(
        toRefreshInBackground.map(mint =>
          this.fallbackApis.fetchTokenPrice(mint).then(tick => {
            if (tick) this.updatePrice(tick);
          }).catch(err => {
            logger.warn({ mint, error: err }, "Background refresh failed");
          })
        )
      );
    }

    if (toFetch.length === 0) return result;

    // Try Redis for missing tokens
    try {
      const redisKeys = toFetch.map(mint => `price:${mint}`);
      const cachedValues = await redis.mget(...redisKeys);

      for (let i = 0; i < toFetch.length; i++) {
        const cached = cachedValues[i];
        if (cached) {
          try {
            const tick = JSON.parse(cached);
            const age = Date.now() - tick.timestamp;
            if (age <= PRICE_MAX_AGE && tick) {
              result.set(toFetch[i], tick);
              this.priceCache.set(toFetch[i], tick);
              toFetch[i] = '';
            }
          } catch (error) {
            logger.warn({ mint: toFetch[i], error }, "Failed to parse Redis cached price");
          }
        }
      }
    } catch (error) {
      logger.warn({ error }, "Redis batch fetch failed");
    }

    const stillToFetch = toFetch.filter(mint => mint !== '');

    if (stillToFetch.length > 0) {
      if (stillToFetch.length >= 3) {
        logger.debug({ count: stillToFetch.length }, "Using batch fetch for multiple tokens");

        try {
          const batchResults = await this.fallbackApis.fetchTokenPricesBatch(stillToFetch);

          for (const [mint, tick] of batchResults.entries()) {
            await this.updatePrice(tick);
            result.set(mint, tick);
          }

          for (const mint of stillToFetch) {
            if (!batchResults.has(mint)) {
              this.negativeCache.set(mint, {
                timestamp: Date.now(),
                reason: 'batch-not-found'
              });
            }
          }
        } catch (error) {
          logger.warn({ count: stillToFetch.length, error }, "Batch fetch failed, falling back to individual");

          for (const mint of stillToFetch) {
            try {
              const tick = await this.fallbackApis.fetchTokenPrice(mint);
              if (tick) {
                await this.updatePrice(tick);
                result.set(mint, tick);
              }
            } catch (err) {
              logger.debug({ mint, error: err }, "Individual fetch failed in fallback");
            }
          }
        }
      } else {
        for (const mint of stillToFetch) {
          try {
            const tick = await this.fallbackApis.fetchTokenPrice(mint);
            if (tick) {
              await this.updatePrice(tick);
              result.set(mint, tick);
            }
          } catch (err) {
            logger.debug({ mint, error: err }, "Individual fetch failed");
          }
        }
      }
    }

    return result;
  }

  get memoryCacheSize(): number {
    return this.priceCache.size;
  }

  get negativeCacheSize(): number {
    return this.negativeCache.size;
  }

  getAllCachedPrices(): Record<string, PriceTick> {
    const result: Record<string, PriceTick> = {};
    this.priceCache.forEach((tick, mint) => {
      result[mint] = tick;
    });
    return result;
  }
}
