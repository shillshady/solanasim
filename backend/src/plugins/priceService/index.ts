/**
 * Optimized Price Service for Helius Developer Plan
 *
 * Key optimizations for Developer plan (10M credits, 50 req/s):
 * - Standard WebSockets for real-time DEX monitoring (no credit cost!)
 * - Aggressive multi-layer caching to minimize API calls
 * - Stale-while-revalidate pattern for better UX
 * - Circuit breakers to prevent credit waste on failing APIs
 * - Smart batching to respect rate limits
 */

import { EventEmitter } from "events";
import { loggers } from "../../utils/logger.js";
import { LRUCache } from "../../utils/lru-cache.js";
import { FallbackApis } from "./fallback-apis.js";
import { WsManager } from "./ws-manager.js";
import { PriceCache } from "./cache.js";
import type { PriceTick, NegativeCacheEntry } from "./types.js";

export type { PriceTick, NegativeCacheEntry } from "./types.js";
export { detectSwapActivity } from "./dex-parser.js";

const logger = loggers.priceService;

class OptimizedPriceService extends EventEmitter {
  private solPriceUsd = 100;
  private updateIntervals: NodeJS.Timeout[] = [];

  // Shared caches
  private priceLru = new LRUCache<string, PriceTick>(5000);
  private negativeLru = new LRUCache<string, NegativeCacheEntry>(2000);

  // Composed sub-modules
  private fallbackApis: FallbackApis;
  private wsManager: WsManager;
  private priceCache: PriceCache;

  constructor() {
    super();

    const apiKey = process.env.HELIUS_API;
    if (!apiKey) {
      throw new Error("HELIUS_API environment variable is required");
    }

    const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    this.fallbackApis = new FallbackApis(
      this.negativeLru,
      () => this.solPriceUsd
    );

    this.wsManager = new WsManager(wsUrl, {
      fetchTokenPrice: (mint) => this.fallbackApis.fetchTokenPrice(mint),
      updatePrice: (tick) => this.handlePriceUpdate(tick),
    });

    this.priceCache = new PriceCache(
      this.priceLru,
      this.negativeLru,
      this.fallbackApis,
      () => this.solPriceUsd
    );

    logger.info("Initializing Optimized Price Service (Developer Plan)");
  }

  async start() {
    logger.info("Starting Optimized Price Service");

    await this.updateSolPrice();

    const solInterval = setInterval(() => this.updateSolPrice(), 30000);
    this.updateIntervals.push(solInterval);

    await this.wsManager.connect();

    logger.info("Price service started with WebSocket streaming (Developer plan optimized)");
  }

  // ------ public API (same signatures as the original monolith) ------

  async fetchTokenPrice(mint: string): Promise<PriceTick | null> {
    return this.fallbackApis.fetchTokenPrice(mint);
  }

  async fetchTokenPricesBatch(mints: string[]): Promise<Map<string, PriceTick>> {
    return this.fallbackApis.fetchTokenPricesBatch(mints);
  }

  async getLastTick(mint: string): Promise<PriceTick | null> {
    return this.priceCache.getLastTick(mint);
  }

  async getLastTicks(mints: string[]): Promise<Map<string, PriceTick>> {
    return this.priceCache.getLastTicks(mints);
  }

  async getPrice(mint: string): Promise<number> {
    if (mint === "So11111111111111111111111111111111111111112") {
      return this.solPriceUsd;
    }

    let tick = await this.getLastTick(mint);

    if (!tick) {
      tick = await this.fetchTokenPrice(mint);
      if (tick) {
        await this.handlePriceUpdate(tick);
      }
    }

    return tick?.priceUsd || 0;
  }

  async getPrices(mints: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const ticksMap = await this.getLastTicks(mints);

    for (const mint of mints) {
      const tick = ticksMap.get(mint);
      prices[mint] = tick?.priceUsd || 0;
    }

    return prices;
  }

  getSolPrice(): number {
    return this.solPriceUsd;
  }

  onPriceUpdate(callback: (tick: PriceTick) => void): () => void {
    this.on("price", callback);
    return () => {
      this.off("price", callback);
    };
  }

  subscribe(callback: (tick: PriceTick) => void): () => void {
    return this.onPriceUpdate(callback);
  }

  getStats() {
    return {
      solPrice: this.solPriceUsd,
      cachedPrices: this.priceCache.memoryCacheSize,
      negativeCached: this.priceCache.negativeCacheSize,
      pendingRequests: this.fallbackApis.pendingRequestCount,
      priceSubscribers: this.listenerCount('price'),
      wsConnected: this.wsManager.isConnected,
      reconnectAttempts: this.wsManager.currentReconnectAttempts,
      circuitBreakers: this.fallbackApis.getCircuitBreakerStates(),
      plan: "Developer (optimized v2)",
      lastUpdate: Date.now()
    };
  }

  getAllCachedPrices(): Record<string, PriceTick> {
    return this.priceCache.getAllCachedPrices();
  }

  async stop() {
    logger.info("Stopping price service");

    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals = [];

    this.wsManager.close();
    this.removeAllListeners();
  }

  // ------ internal ------

  private async handlePriceUpdate(tick: PriceTick) {
    await this.priceCache.updatePrice(tick);
    this.emit("price", tick);
  }

  private async updateSolPrice() {
    const solData = await this.fallbackApis.fetchSolPrice();
    if (!solData) return;

    const oldPrice = this.solPriceUsd;
    this.solPriceUsd = solData.priceUsd;

    logger.info({ oldPrice, newPrice: this.solPriceUsd }, "SOL price updated");

    const solTick: PriceTick = {
      mint: "So11111111111111111111111111111111111111112",
      priceUsd: this.solPriceUsd,
      priceSol: 1,
      solUsd: this.solPriceUsd,
      timestamp: Date.now(),
      source: "coingecko",
      change24h: solData.change24h
    };

    await this.handlePriceUpdate(solTick);
  }
}

// Export singleton instance
const optimizedPriceService = new OptimizedPriceService();
export default optimizedPriceService;
