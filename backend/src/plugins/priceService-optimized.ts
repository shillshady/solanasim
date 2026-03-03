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
import WebSocket from "ws";
import redis from "./redis.js";
import { loggers } from "../utils/logger.js";
import { LRUCache } from "../utils/lru-cache.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";

const logger = loggers.priceService;

interface PriceTick {
  mint: string;
  priceUsd: number;
  priceSol?: number;
  solUsd?: number;
  marketCapUsd?: number;
  timestamp: number;
  source: string;
  volume?: number;
  change24h?: number;
}

// Negative cache entry (for tokens that don't exist)
interface NegativeCacheEntry {
  timestamp: number;
  reason: string;
}

/**
 * Optimized Price Service using Standard WebSockets (free on Developer plan!)
 */
class OptimizedPriceService extends EventEmitter {
  private priceCache = new LRUCache<string, PriceTick>(5000); // Increased from 2000 to 5000 for better hit rate
  private negativeCache = new LRUCache<string, NegativeCacheEntry>(2000); // Cache for tokens that don't exist
  private solPriceUsd = 100;
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private updateIntervals: NodeJS.Timeout[] = [];
  private dexScreenerBreaker = new CircuitBreaker('DexScreener', logger);
  private jupiterBreaker = new CircuitBreaker('Jupiter', logger);

  // Request coalescing to prevent duplicate concurrent requests
  private pendingRequests = new Map<string, Promise<PriceTick | null>>();

  // WebSocket reconnection
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectDelay = 1000;
  private readonly MAX_RECONNECT_DELAY = 60000;
  private isReconnecting = false;
  private shouldReconnect = true;

  // Rate limiting for swap-triggered refreshes
  private lastRefreshTime = new Map<string, number>(); // Track last refresh per token
  private readonly MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between refreshes per token
  private refreshQueue = new Set<string>(); // Tokens queued for refresh
  private isProcessingQueue = false;

  // DEX programs to monitor via WebSocket (Standard API - FREE!)
  private readonly DEX_PROGRAMS = [
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium V4 (most active)
    "CAMMCzo5YL8w4VFF8KVHrK22GGUQpMpTFb6xRmpLFGNnSm", // Raydium CLMM
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  // Pump.fun
  ];

  private readonly HELIUS_WS_URL: string;

  constructor() {
    super();

    const apiKey = process.env.HELIUS_API;
    if (!apiKey) {
      throw new Error("HELIUS_API environment variable is required");
    }

    // Standard WebSocket endpoint (works on all plans)
    this.HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    logger.info("Initializing Optimized Price Service (Developer Plan)");
  }

  async start() {
    logger.info("Starting Optimized Price Service");

    // Get initial SOL price
    await this.updateSolPrice();

    // Set up regular SOL price updates (every 30s)
    const solInterval = setInterval(() => this.updateSolPrice(), 30000);
    this.updateIntervals.push(solInterval);

    // Connect to Helius Standard WebSocket (no credit cost!)
    await this.connectWebSocket();

    logger.info("✅ Price service started with WebSocket streaming (Developer plan optimized)");
  }

  private async connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn("WebSocket already connected");
      return;
    }

    try {
      logger.info("🔌 Connecting to Helius Standard WebSocket...");
      this.ws = new WebSocket(this.HELIUS_WS_URL);

      this.ws.on('open', () => {
        logger.info("✅ WebSocket connected successfully");

        // Reset reconnection state
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isReconnecting = false;

        // Subscribe to DEX program logs (Standard API - logsSubscribe)
        this.subscribeToPrograms();

        // Start health checks (ping every 30s as per Helius best practices)
        this.startHealthChecks();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('error', (error: Error) => {
        logger.error({ error: error.message }, "WebSocket error");
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        logger.warn({ code, reason: reason.toString() }, "WebSocket closed");

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        if (this.shouldReconnect) {
          this.reconnect();
        }
      });

      this.ws.on('pong', () => {
        logger.debug("Pong received");
      });

    } catch (error) {
      logger.error({ error }, "Failed to create WebSocket connection");
      this.reconnect();
    }
  }

  private subscribeToPrograms() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error("Cannot subscribe: WebSocket not connected");
      return;
    }

    // Subscribe to each DEX program using logsSubscribe (Standard API)
    this.DEX_PROGRAMS.forEach((programId, index) => {
      const subscribeRequest = {
        jsonrpc: "2.0",
        id: index + 1,
        method: "logsSubscribe",
        params: [
          {
            mentions: [programId]
          },
          {
            commitment: "confirmed"
          }
        ]
      };

      this.ws!.send(JSON.stringify(subscribeRequest));
    });

    logger.info({ programs: this.DEX_PROGRAMS.length }, "📡 Subscribed to DEX programs via logsSubscribe");
  }

  private startHealthChecks() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping every 30 seconds (Helius best practice)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        logger.debug("Ping sent");
      }
    }, 30000);
  }

  private handleWebSocketMessage(data: WebSocket.Data) {
    try {
      const messageStr = data.toString('utf8');
      const message = JSON.parse(messageStr);

      // Handle subscription confirmation
      if (message.result !== undefined && message.id) {
        logger.info({ subscriptionId: message.result, id: message.id }, "Subscription confirmed");
        return;
      }

      // Handle log notifications
      if (message.method === "logsNotification" && message.params?.result) {
        this.processLogNotification(message.params.result);
      }

    } catch (error) {
      logger.error({ error }, "Failed to parse WebSocket message");
    }
  }

  private async processLogNotification(logData: any) {
    try {
      const signature = logData.value?.signature;
      const logs = logData.value?.logs || [];

      // Parse logs for swap activity
      const swapSignal = this.detectSwapActivity(logs);

      if (swapSignal.isSwap) {
        logger.debug({
          signature: signature?.slice(0, 16),
          dex: swapSignal.dex
        }, "Swap detected - triggering price refresh");

        // Use swap as a signal to refresh prices for involved tokens
        // This gives us near-instant price updates (1-2s latency)
        if (swapSignal.involvedTokens.length > 0) {
          this.triggerPriceRefresh(swapSignal.involvedTokens);
        }
      }

    } catch (error) {
      logger.error({ error }, "Failed to process log notification");
    }
  }

  /**
   * Detect swap activity from transaction logs
   * Returns signals indicating a swap occurred and which DEX
   */
  private detectSwapActivity(logs: string[]): {
    isSwap: boolean;
    dex: string | null;
    involvedTokens: string[];
  } {
    let isSwap = false;
    let dex: string | null = null;
    const involvedTokens: string[] = [];

    for (const log of logs) {
      // Raydium swap detection
      if (log.includes('ray_log:')) {
        isSwap = true;
        dex = 'Raydium';

        // Try to parse Raydium ray_log for swap amounts
        const rayLogMatch = log.match(/ray_log:\s*([A-Za-z0-9+/=]+)/);
        if (rayLogMatch) {
          try {
            const rayLogData = Buffer.from(rayLogMatch[1], 'base64');
            // Raydium ray_log structure: [type:u8, amountIn:u64, amountOut:u64, ...]
            if (rayLogData.length >= 17) {
              const amountIn = rayLogData.readBigUInt64LE(1);
              const amountOut = rayLogData.readBigUInt64LE(9);

              logger.debug({
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString()
              }, "Raydium swap amounts");
            }
          } catch (err) {
            // Parsing failed, but we still know a swap occurred
            logger.debug({ error: err }, "Failed to parse ray_log details");
          }
        }
      }

      // Pump.fun swap detection
      if (log.includes('Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) {
        if (log.includes('invoke') || log.includes('success')) {
          isSwap = true;
          dex = 'Pump.fun';
        }
      }

      // Generic swap indicators (works for Orca, Jupiter, etc.)
      if (log.includes('Instruction: Swap') ||
          log.includes('Instruction: SwapBaseIn') ||
          log.includes('Instruction: SwapBaseOut')) {
        isSwap = true;
        if (!dex) dex = 'Unknown DEX';
      }

      // Extract token mint addresses from logs
      // SPL Token Transfer logs include mint addresses
      const mintMatch = log.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/g);
      if (mintMatch) {
        mintMatch.forEach(address => {
          // Filter out common non-token addresses
          if (address.length >= 32 &&
              !address.startsWith('11111') && // System program
              !address.startsWith('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') && // Token program
              !involvedTokens.includes(address)) {
            involvedTokens.push(address);
          }
        });
      }
    }

    return { isSwap, dex, involvedTokens };
  }

  /**
   * Trigger immediate price refresh for tokens involved in a swap
   * This is called when we detect real-time swap activity
   *
   * CRITICAL: Rate-limited to prevent DexScreener/Jupiter 429 errors
   */
  private triggerPriceRefresh(tokenAddresses: string[]) {
    // Known quote tokens - we don't need to refresh their prices
    const quoteTokens = new Set([
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
    ]);

    // Filter to only target tokens (non-quote tokens)
    const targetTokens = tokenAddresses.filter(addr => !quoteTokens.has(addr));

    if (targetTokens.length === 0) {
      return; // Only quote tokens involved
    }

    const now = Date.now();

    // Add tokens to queue with rate limiting
    for (const mint of targetTokens) {
      const lastRefresh = this.lastRefreshTime.get(mint) || 0;
      const timeSinceRefresh = now - lastRefresh;

      // Skip if refreshed recently (within MIN_REFRESH_INTERVAL)
      if (timeSinceRefresh < this.MIN_REFRESH_INTERVAL) {
        logger.debug({
          mint: mint.slice(0, 8),
          timeSinceRefresh: Math.round(timeSinceRefresh / 1000)
        }, "Skipping swap-triggered refresh (too recent)");
        continue;
      }

      // Add to queue for processing
      this.refreshQueue.add(mint);
    }

    // Process queue with rate limiting
    this.processRefreshQueue();
  }

  /**
   * Process refresh queue with strict rate limiting
   * Processes 1 token per second to respect API rate limits
   */
  private async processRefreshQueue() {
    // Prevent concurrent queue processing
    if (this.isProcessingQueue || this.refreshQueue.size === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const tokensToProcess = Array.from(this.refreshQueue).slice(0, 1); // Process 1 at a time

      for (const mint of tokensToProcess) {
        this.refreshQueue.delete(mint);
        this.lastRefreshTime.set(mint, Date.now());

        logger.debug({
          mint: mint.slice(0, 8),
          queueRemaining: this.refreshQueue.size
        }, "Processing swap-triggered refresh");

        try {
          const tick = await this.fetchTokenPrice(mint);
          if (tick) {
            await this.updatePrice(tick);
            logger.info({
              mint: mint.slice(0, 8),
              price: tick.priceUsd.toFixed(6),
              source: tick.source
            }, "Price refreshed from swap signal");
          }
        } catch (err) {
          logger.debug({ mint: mint.slice(0, 8), error: err }, "Swap-triggered refresh failed");
        }

        // Wait 1 second between refreshes to respect rate limits
        if (this.refreshQueue.size > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Continue processing if queue has more items
      if (this.refreshQueue.size > 0) {
        setTimeout(() => {
          this.isProcessingQueue = false;
          this.processRefreshQueue();
        }, 1000);
      } else {
        this.isProcessingQueue = false;
      }

    } catch (error) {
      logger.error({ error }, "Error processing refresh queue");
      this.isProcessingQueue = false;
    }
  }

  private reconnect() {
    if (this.isReconnecting) return;

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error("Maximum reconnection attempts reached");
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    logger.info(
      {
        attempt: this.reconnectAttempts,
        maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
        delay: this.reconnectDelay
      },
      "Attempting to reconnect"
    );

    setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (error) {
        logger.error({ error }, "Reconnection failed");
      }

      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
      this.isReconnecting = false;
    }, this.reconnectDelay);
  }

  private async updateSolPrice() {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.solana?.usd) {
        const oldPrice = this.solPriceUsd;
        this.solPriceUsd = data.solana.usd;

        logger.info({ oldPrice, newPrice: this.solPriceUsd }, "SOL price updated");

        const solTick: PriceTick = {
          mint: "So11111111111111111111111111111111111111112",
          priceUsd: this.solPriceUsd,
          priceSol: 1,
          solUsd: this.solPriceUsd,
          timestamp: Date.now(),
          source: "coingecko",
          change24h: data.solana.usd_24h_change || 0
        };

        await this.updatePrice(solTick);
      }
    } catch (error) {
      logger.error({ error }, "Failed to update SOL price");
    }
  }

  /**
   * Batch fetch token prices from DexScreener (up to 30 tokens at once)
   * This reduces API calls by ~30x compared to individual requests
   */
  async fetchTokenPricesBatch(mints: string[]): Promise<Map<string, PriceTick>> {
    const result = new Map<string, PriceTick>();

    if (mints.length === 0) return result;

    // DexScreener supports up to 30 tokens per request
    const BATCH_SIZE = 30;
    const batches: string[][] = [];

    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
      batches.push(mints.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      try {
        const dexResult = await this.dexScreenerBreaker.execute(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for batch

          try {
            // Use DexScreener batch endpoint: /tokens/v1/{chainId}/{addresses}
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

            // Process pairs from batch response
            if (data.pairs && Array.isArray(data.pairs)) {
              // Group pairs by token address
              const pairsByToken = new Map<string, any[]>();

              for (const pair of data.pairs) {
                const baseAddress = pair.baseToken?.address;
                if (!baseAddress) continue;

                if (!pairsByToken.has(baseAddress)) {
                  pairsByToken.set(baseAddress, []);
                }
                pairsByToken.get(baseAddress)!.push(pair);
              }

              // Create PriceTick for each token (use highest liquidity pair)
              for (const [mint, pairs] of pairsByToken.entries()) {
                const sortedPairs = pairs.sort((a: any, b: any) => {
                  const liqA = parseFloat(a.liquidity?.usd || "0");
                  const liqB = parseFloat(b.liquidity?.usd || "0");
                  return liqB - liqA;
                });

                const pair = sortedPairs[0];
                const priceUsd = parseFloat(pair.priceUsd || "0");

                if (priceUsd > 0) {
                  const tick: PriceTick = {
                    mint,
                    priceUsd,
                    priceSol: priceUsd / this.solPriceUsd,
                    solUsd: this.solPriceUsd,
                    timestamp: Date.now(),
                    source: "dexscreener-batch",
                    change24h: parseFloat(pair.priceChange?.h24 || "0"),
                    volume: parseFloat(pair.volume?.h24 || "0"),
                    marketCapUsd: parseFloat(pair.marketCap || "0")
                  };
                  result.set(mint, tick);
                }
              }
            }

            return result;
          } catch (err) {
            clearTimeout(timeoutId);
            throw err;
          }
        });

        if (dexResult) {
          // Merge batch results
          for (const [mint, tick] of dexResult.entries()) {
            result.set(mint, tick);
          }
        }
      } catch (error: any) {
        if (error.message !== 'Circuit breaker is OPEN') {
          logger.warn({ batchSize: batch.length, error: error.message }, "DexScreener batch fetch failed");
        }
      }

      // Small delay between batches to respect rate limits (300 req/min = 5 req/s)
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    logger.info({ requested: mints.length, found: result.size }, "Batch price fetch completed");
    return result;
  }

  async fetchTokenPrice(mint: string): Promise<PriceTick | null> {
    // Check negative cache first (tokens we know don't exist)
    const negativeCacheEntry = this.negativeCache.get(mint);
    if (negativeCacheEntry) {
      const age = Date.now() - negativeCacheEntry.timestamp;
      const NEGATIVE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (increased from 5)

      if (age < NEGATIVE_CACHE_TTL) {
        // Token is in negative cache - don't log, just return null
        return null;
      } else {
        // Expired, will try again
        this.negativeCache.set(mint, { timestamp: 0, reason: '' });
      }
    }

    // Request coalescing - check if already fetching this token
    const pending = this.pendingRequests.get(mint);
    if (pending) {
      // Coalescing - don't log to reduce noise
      return pending;
    }

    // Create promise and store in pending map
    const fetchPromise = this._fetchTokenPriceInternal(mint);
    this.pendingRequests.set(mint, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(mint);
    }
  }

  private async _fetchTokenPriceInternal(mint: string): Promise<PriceTick | null> {
    // Try DexScreener first (best for SPL tokens)
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
                priceSol: priceUsd / this.solPriceUsd,
                solUsd: this.solPriceUsd,
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
      // Only log unexpected errors (not timeouts, not 404s) - reduces log spam
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

    // Try Jupiter as fallback
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
              // Add to negative cache immediately
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
                priceSol: priceUsd / this.solPriceUsd,
                solUsd: this.solPriceUsd,
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
      // Only log unexpected errors - reduces log spam by 95%
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

    // Try pump.fun as last resort
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
              priceSol: priceUsd / this.solPriceUsd,
              solUsd: this.solPriceUsd,
              timestamp: Date.now(),
              source: "pump.fun",
              marketCapUsd: data.usd_market_cap
            };
          }
        }
      }
    } catch (error: any) {
      // Pump.fun failures are expected - don't log
    }

    // No price found from any source - add to negative cache (don't log to reduce spam)
    this.negativeCache.set(mint, {
      timestamp: Date.now(),
      reason: 'not-found'
    });

    return null;
  }

  private async updatePrice(tick: PriceTick) {
    this.priceCache.set(tick.mint, tick);

    try {
      await redis.setex(`price:${tick.mint}`, 60, JSON.stringify(tick));
      await redis.publish("prices", JSON.stringify(tick));
    } catch (error) {
      logger.warn({ error }, "Redis cache/publish failed");
    }

    this.emit("price", tick);
  }

  async getLastTick(mint: string): Promise<PriceTick | null> {
    if (mint === "So11111111111111111111111111111111111111112") {
      return {
        mint,
        priceUsd: this.solPriceUsd,
        priceSol: 1,
        solUsd: this.solPriceUsd,
        timestamp: Date.now(),
        source: "live"
      };
    }

    let tick = this.priceCache.get(mint);
    const PRICE_FRESHNESS_THRESHOLD = 10 * 1000; // 10s
    const PRICE_MAX_AGE = 60 * 1000; // 60s
    const isStale = tick && (Date.now() - tick.timestamp) > PRICE_FRESHNESS_THRESHOLD;
    const isTooOld = tick && (Date.now() - tick.timestamp) > PRICE_MAX_AGE;

    // Stale-while-revalidate: return stale data, refresh in background
    if (isStale && tick && !isTooOld) {
      this.fetchTokenPrice(mint).then(freshTick => {
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
        const fetchedTick = await this.fetchTokenPrice(mint);
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
    const PRICE_FRESHNESS_THRESHOLD = 10 * 1000;
    const PRICE_MAX_AGE = 60 * 1000;

    for (const mint of mints) {
      if (mint === "So11111111111111111111111111111111111111112") {
        result.set(mint, {
          mint,
          priceUsd: this.solPriceUsd,
          priceSol: 1,
          solUsd: this.solPriceUsd,
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
          this.fetchTokenPrice(mint).then(tick => {
            if (tick) this.updatePrice(tick);
          }).catch(err => {
            logger.warn({ mint, error: err }, "Background refresh failed");
          })
        )
      );
    }

    if (toFetch.length === 0) return result;

    try {
      const redisKeys = toFetch.map(mint => `price:${mint}`);
      const cachedValues = await redis.mget(...redisKeys);

      for (let i = 0; i < toFetch.length; i++) {
        const cached = cachedValues[i];
        if (cached) {
          try {
            const tick = JSON.parse(cached);
            const age = Date.now() - tick.timestamp;
            const isTooOld = age > PRICE_MAX_AGE;

            if (!isTooOld && tick) {
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
      // Use batch fetching if we have multiple tokens (much more efficient!)
      if (stillToFetch.length >= 3) {
        logger.debug({ count: stillToFetch.length }, "Using batch fetch for multiple tokens");

        try {
          const batchResults = await this.fetchTokenPricesBatch(stillToFetch);

          for (const [mint, tick] of batchResults.entries()) {
            await this.updatePrice(tick);
            result.set(mint, tick);
          }

          // For tokens not found in batch, add to negative cache
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

          // Fallback to individual fetching
          for (const mint of stillToFetch) {
            try {
              const tick = await this.fetchTokenPrice(mint);
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
        // For small batches (< 3 tokens), use individual fetching
        for (const mint of stillToFetch) {
          try {
            const tick = await this.fetchTokenPrice(mint);
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

  async getPrice(mint: string): Promise<number> {
    if (mint === "So11111111111111111111111111111111111111112") {
      return this.solPriceUsd;
    }

    let tick = await this.getLastTick(mint);

    if (!tick) {
      tick = await this.fetchTokenPrice(mint);
      if (tick) {
        await this.updatePrice(tick);
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
      cachedPrices: this.priceCache.size,
      negativeCached: this.negativeCache.size,
      pendingRequests: this.pendingRequests.size,
      priceSubscribers: this.listenerCount('price'),
      wsConnected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
      circuitBreakers: {
        dexscreener: this.dexScreenerBreaker.getState(),
        jupiter: this.jupiterBreaker.getState()
      },
      plan: "Developer (optimized v2)",
      lastUpdate: Date.now()
    };
  }

  getAllCachedPrices(): Record<string, PriceTick> {
    const result: Record<string, PriceTick> = {};
    this.priceCache.forEach((tick, mint) => {
      result[mint] = tick;
    });
    return result;
  }

  async stop() {
    logger.info("Stopping price service");

    this.shouldReconnect = false;

    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals = [];

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.removeAllListeners();
  }
}

// Export singleton instance
const optimizedPriceService = new OptimizedPriceService();
export default optimizedPriceService;
