import { loggers } from "../../utils/logger.js";
import { CircuitBreaker } from "../../utils/circuit-breaker.js";
import { LRUCache } from "../../utils/lru-cache.js";
import type { PriceTick, NegativeCacheEntry } from "./types.js";

const logger = loggers.priceService;

const NEGATIVE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Handles all external API price fetching with circuit breakers,
 * negative caching, and request coalescing.
 */
export class FallbackApis {
  private dexScreenerBreaker = new CircuitBreaker('DexScreener', logger);
  private jupiterBreaker = new CircuitBreaker('Jupiter', logger);
  private negativeCache: LRUCache<string, NegativeCacheEntry>;
  private pendingRequests = new Map<string, Promise<PriceTick | null>>();
  private getSolPriceUsd: () => number;

  constructor(
    negativeCache: LRUCache<string, NegativeCacheEntry>,
    getSolPriceUsd: () => number
  ) {
    this.negativeCache = negativeCache;
    this.getSolPriceUsd = getSolPriceUsd;
  }

  /**
   * Fetch a single token price with negative cache check and request coalescing.
   */
  async fetchTokenPrice(mint: string): Promise<PriceTick | null> {
    const negativeCacheEntry = this.negativeCache.get(mint);
    if (negativeCacheEntry) {
      const age = Date.now() - negativeCacheEntry.timestamp;
      if (age < NEGATIVE_CACHE_TTL) {
        return null;
      } else {
        this.negativeCache.set(mint, { timestamp: 0, reason: '' });
      }
    }

    const pending = this.pendingRequests.get(mint);
    if (pending) {
      return pending;
    }

    const fetchPromise = this.fetchTokenPriceInternal(mint);
    this.pendingRequests.set(mint, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingRequests.delete(mint);
    }
  }

  /**
   * Batch fetch token prices from DexScreener (up to 30 tokens at once).
   */
  async fetchTokenPricesBatch(mints: string[]): Promise<Map<string, PriceTick>> {
    const result = new Map<string, PriceTick>();
    if (mints.length === 0) return result;

    const BATCH_SIZE = 30;
    const batches: string[][] = [];
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
      batches.push(mints.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      try {
        const dexResult = await this.dexScreenerBreaker.execute(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            const addressesParam = batch.join(',');
            const response = await fetch(
              `https://api.dexscreener.com/tokens/v1/solana/${addressesParam}`,
              {
                signal: controller.signal,
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Solana Sim/1.0'
                }
              }
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
              if (response.status === 429) {
                logger.warn({ batchSize: batch.length }, "DexScreener batch rate limit hit");
                throw new Error('Rate limited');
              }
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const batchResult = new Map<string, PriceTick>();

            if (data.pairs && Array.isArray(data.pairs)) {
              const pairsByToken = new Map<string, any[]>();

              for (const pair of data.pairs) {
                const baseAddress = pair.baseToken?.address;
                if (!baseAddress) continue;
                if (!pairsByToken.has(baseAddress)) {
                  pairsByToken.set(baseAddress, []);
                }
                pairsByToken.get(baseAddress)!.push(pair);
              }

              const solPriceUsd = this.getSolPriceUsd();
              for (const [mint, pairs] of pairsByToken.entries()) {
                const sortedPairs = pairs.sort((a: any, b: any) => {
                  const liqA = parseFloat(a.liquidity?.usd || "0");
                  const liqB = parseFloat(b.liquidity?.usd || "0");
                  return liqB - liqA;
                });

                const pair = sortedPairs[0];
                const priceUsd = parseFloat(pair.priceUsd || "0");

                if (priceUsd > 0) {
                  batchResult.set(mint, {
                    mint,
                    priceUsd,
                    priceSol: priceUsd / solPriceUsd,
                    solUsd: solPriceUsd,
                    timestamp: Date.now(),
                    source: "dexscreener-batch",
                    change24h: parseFloat(pair.priceChange?.h24 || "0"),
                    volume: parseFloat(pair.volume?.h24 || "0"),
                    marketCapUsd: parseFloat(pair.marketCap || "0")
                  });
                }
              }
            }

            return batchResult;
          } catch (err) {
            clearTimeout(timeoutId);
            throw err;
          }
        });

        if (dexResult) {
          for (const [mint, tick] of dexResult.entries()) {
            result.set(mint, tick);
          }
        }
      } catch (error: any) {
        if (error.message !== 'Circuit breaker is OPEN') {
          logger.warn({ batchSize: batch.length, error: error.message }, "DexScreener batch fetch failed");
        }
      }

      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    logger.info({ requested: mints.length, found: result.size }, "Batch price fetch completed");
    return result;
  }

  /**
   * Fetch SOL/USD price from CoinGecko.
   */
  async fetchSolPrice(): Promise<{ priceUsd: number; change24h: number } | null> {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.solana?.usd) {
        return {
          priceUsd: data.solana.usd,
          change24h: data.solana.usd_24h_change || 0
        };
      }
      return null;
    } catch (error) {
      logger.error({ error }, "Failed to fetch SOL price");
      return null;
    }
  }

  getCircuitBreakerStates() {
    return {
      dexscreener: this.dexScreenerBreaker.getState(),
      jupiter: this.jupiterBreaker.getState()
    };
  }

  get pendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  // ------- internal -------

  private async fetchTokenPriceInternal(mint: string): Promise<PriceTick | null> {
    const solPriceUsd = this.getSolPriceUsd();

    // 1) DexScreener
    const dexResult = await this.tryDexScreener(mint, solPriceUsd);
    if (dexResult) return dexResult;

    // 2) Jupiter
    const jupResult = await this.tryJupiter(mint, solPriceUsd);
    if (jupResult) return jupResult;

    // 3) Pump.fun
    const pumpResult = await this.tryPumpFun(mint, solPriceUsd);
    if (pumpResult) return pumpResult;

    // No price found
    this.negativeCache.set(mint, { timestamp: Date.now(), reason: 'not-found' });
    return null;
  }

  private async tryDexScreener(mint: string, solPriceUsd: number): Promise<PriceTick | null> {
    try {
      const dexResult = await this.dexScreenerBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const response = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
            {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Solana Sim/1.0'
              }
            }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 429) {
              logger.warn({ mint }, "DexScreener rate limit hit");
              throw new Error('Rate limited');
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          if (data.pairs && data.pairs.length > 0) {
            const sortedPairs = data.pairs.sort((a: any, b: any) => {
              const liqA = parseFloat(a.liquidity?.usd || "0");
              const liqB = parseFloat(b.liquidity?.usd || "0");
              return liqB - liqA;
            });

            const pair = sortedPairs[0];
            const priceUsd = parseFloat(pair.priceUsd || "0");

            if (priceUsd > 0) {
              return {
                mint,
                priceUsd,
                priceSol: priceUsd / solPriceUsd,
                solUsd: solPriceUsd,
                timestamp: Date.now(),
                source: "dexscreener",
                change24h: parseFloat(pair.priceChange?.h24 || "0"),
                volume: parseFloat(pair.volume?.h24 || "0"),
                marketCapUsd: parseFloat(pair.marketCap || "0")
              };
            }
          }
          return null;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      });

      if (dexResult) return dexResult;
    } catch (error: any) {
      const isExpectedError =
        error.message === 'Circuit breaker is OPEN' ||
        error.message?.includes('aborted') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('404') ||
        error.message?.includes('204');

      if (!isExpectedError) {
        logger.warn({ mint: mint.slice(0, 8), error: error.message }, "DexScreener unexpected error");
      }
    }
    return null;
  }

  private async tryJupiter(mint: string, solPriceUsd: number): Promise<PriceTick | null> {
    try {
      const jupResult = await this.jupiterBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const response = await fetch(
            `https://price.jup.ag/v6/price?ids=${mint}`,
            {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Solana Sim/1.0'
              }
            }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 204) {
              this.negativeCache.set(mint, { timestamp: Date.now(), reason: '204-no-content' });
              return null;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          if (data.data && data.data[mint] && data.data[mint].price) {
            const priceUsd = parseFloat(data.data[mint].price);
            if (priceUsd > 0) {
              return {
                mint,
                priceUsd,
                priceSol: priceUsd / solPriceUsd,
                solUsd: solPriceUsd,
                timestamp: Date.now(),
                source: "jupiter"
              };
            }
          }
          return null;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      });

      if (jupResult) return jupResult;
    } catch (error: any) {
      const isExpectedError =
        error.message === 'Circuit breaker is OPEN' ||
        error.message?.includes('204') ||
        error.message?.includes('aborted') ||
        error.message?.includes('fetch failed') ||
        error.name === 'AbortError';

      if (!isExpectedError) {
        logger.warn({ mint: mint.slice(0, 8), error: error.message }, "Jupiter unexpected error");
      }
    }
    return null;
  }

  private async tryPumpFun(mint: string, solPriceUsd: number): Promise<PriceTick | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://frontend-api.pump.fun/coins/${mint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Solana Sim/1.0'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        if (data && data.usd_market_cap) {
          const supply = 1_000_000_000;
          const priceUsd = data.usd_market_cap / supply;

          if (priceUsd > 0) {
            return {
              mint,
              priceUsd,
              priceSol: priceUsd / solPriceUsd,
              solUsd: solPriceUsd,
              timestamp: Date.now(),
              source: "pump.fun",
              marketCapUsd: data.usd_market_cap
            };
          }
        }
      }
    } catch {
      // Pump.fun failures are expected
    }
    return null;
  }
}
