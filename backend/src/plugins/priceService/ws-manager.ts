import WebSocket from "ws";
import { loggers } from "../../utils/logger.js";
import { detectSwapActivity } from "./dex-parser.js";
import type { PriceTick } from "./types.js";

const logger = loggers.priceService;

export interface WsManagerDeps {
  fetchTokenPrice: (mint: string) => Promise<PriceTick | null>;
  updatePrice: (tick: PriceTick) => Promise<void>;
}

/**
 * Manages the Helius Standard WebSocket connection for real-time
 * DEX swap monitoring with reconnection, health checks, and
 * rate-limited refresh queueing.
 */
export class WsManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // Reconnection state
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectDelay = 1000;
  private readonly MAX_RECONNECT_DELAY = 60000;
  private isReconnecting = false;
  private shouldReconnect = true;

  // Rate limiting for swap-triggered refreshes
  private lastRefreshTime = new Map<string, number>();
  private readonly MIN_REFRESH_INTERVAL = 5000; // 5s minimum between refreshes per token
  private refreshQueue = new Set<string>();
  private isProcessingQueue = false;

  // DEX programs to monitor
  private readonly DEX_PROGRAMS = [
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  // Raydium V4
    "CAMMCzo5YL8w4VFF8KVHrK22GGUQpMpTFb6xRmpLFGNnSm", // Raydium CLMM
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",   // Pump.fun
  ];

  private readonly wsUrl: string;
  private deps: WsManagerDeps;

  constructor(wsUrl: string, deps: WsManagerDeps) {
    this.wsUrl = wsUrl;
    this.deps = deps;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get currentReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn("WebSocket already connected");
      return;
    }

    try {
      logger.info("Connecting to Helius Standard WebSocket...");
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        logger.info("WebSocket connected successfully");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isReconnecting = false;
        this.subscribeToPrograms();
        this.startHealthChecks();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
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

  close() {
    this.shouldReconnect = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ------- internal -------

  private subscribeToPrograms() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error("Cannot subscribe: WebSocket not connected");
      return;
    }

    this.DEX_PROGRAMS.forEach((programId, index) => {
      const subscribeRequest = {
        jsonrpc: "2.0",
        id: index + 1,
        method: "logsSubscribe",
        params: [
          { mentions: [programId] },
          { commitment: "confirmed" }
        ]
      };
      this.ws!.send(JSON.stringify(subscribeRequest));
    });

    logger.info({ programs: this.DEX_PROGRAMS.length }, "Subscribed to DEX programs via logsSubscribe");
  }

  private startHealthChecks() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        logger.debug("Ping sent");
      }
    }, 30000);
  }

  private handleMessage(data: WebSocket.Data) {
    try {
      const messageStr = data.toString('utf8');
      const message = JSON.parse(messageStr);

      if (message.result !== undefined && message.id) {
        logger.info({ subscriptionId: message.result, id: message.id }, "Subscription confirmed");
        return;
      }

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
      const swapSignal = detectSwapActivity(logs);

      if (swapSignal.isSwap) {
        logger.debug({
          signature: signature?.slice(0, 16),
          dex: swapSignal.dex
        }, "Swap detected - triggering price refresh");

        if (swapSignal.involvedTokens.length > 0) {
          this.triggerPriceRefresh(swapSignal.involvedTokens);
        }
      }
    } catch (error) {
      logger.error({ error }, "Failed to process log notification");
    }
  }

  private triggerPriceRefresh(tokenAddresses: string[]) {
    const quoteTokens = new Set([
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    ]);

    const targetTokens = tokenAddresses.filter(addr => !quoteTokens.has(addr));
    if (targetTokens.length === 0) return;

    const now = Date.now();

    for (const mint of targetTokens) {
      const lastRefresh = this.lastRefreshTime.get(mint) || 0;
      const timeSinceRefresh = now - lastRefresh;

      if (timeSinceRefresh < this.MIN_REFRESH_INTERVAL) {
        logger.debug({
          mint: mint.slice(0, 8),
          timeSinceRefresh: Math.round(timeSinceRefresh / 1000)
        }, "Skipping swap-triggered refresh (too recent)");
        continue;
      }

      this.refreshQueue.add(mint);
    }

    this.processRefreshQueue();
  }

  private async processRefreshQueue() {
    if (this.isProcessingQueue || this.refreshQueue.size === 0) return;

    this.isProcessingQueue = true;

    try {
      const tokensToProcess = Array.from(this.refreshQueue).slice(0, 1);

      for (const mint of tokensToProcess) {
        this.refreshQueue.delete(mint);
        this.lastRefreshTime.set(mint, Date.now());

        logger.debug({
          mint: mint.slice(0, 8),
          queueRemaining: this.refreshQueue.size
        }, "Processing swap-triggered refresh");

        try {
          const tick = await this.deps.fetchTokenPrice(mint);
          if (tick) {
            await this.deps.updatePrice(tick);
            logger.info({
              mint: mint.slice(0, 8),
              price: tick.priceUsd.toFixed(6),
              source: tick.source
            }, "Price refreshed from swap signal");
          }
        } catch (err) {
          logger.debug({ mint: mint.slice(0, 8), error: err }, "Swap-triggered refresh failed");
        }

        if (this.refreshQueue.size > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

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
        await this.connect();
      } catch (error) {
        logger.error({ error }, "Reconnection failed");
      }
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
      this.isReconnecting = false;
    }, this.reconnectDelay);
  }
}
