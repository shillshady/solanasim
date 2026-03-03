// WebSocket plugin for real-time updates with contract-compliant formatting
import { FastifyInstance } from "fastify";
import priceService from "./priceService.js";
import { loggers } from "../utils/logger.js";

const logger = loggers.websocket;

// Convert SOL price to lamports (for contract compliance)
function solToLamports(solPrice: number): string {
  return Math.round(solPrice * 1_000_000_000).toString();
}

// Global broadcast state
const clients = new Set<any>();
let seq = 0;

// Decorator for broadcasting price ticks
declare module "fastify" {
  interface FastifyInstance {
    broadcastPrice: (tick: { mint: string; priceLamports: string; ts?: number }) => void;
  }
}

export default async function wsPlugin(app: FastifyInstance) {
  // Add broadcast method to Fastify instance
  app.decorate("broadcastPrice", (tick: { mint: string; priceLamports: string; ts?: number }) => {
    const frame = JSON.stringify({ 
      t: "price", 
      d: { 
        v: 1, 
        seq: ++seq, 
        mint: tick.mint, 
        priceLamports: tick.priceLamports, 
        ts: tick.ts ?? Date.now() 
      } 
    });
    
    let sent = 0;
    for (const ws of clients) {
      // @ts-ignore
      if (ws.readyState === 1) { // 1 === OPEN
        try { 
          ws.send(frame); 
          sent++;
        } catch (e) {
          // Remove dead connections
          clients.delete(ws);
        }
      }
    }
    
    // Only log broadcasts if there are many clients (reduced log noise)
    if (sent > 10) {
      logger.info({ mint: tick.mint, clientCount: sent }, "Broadcasted price update");
    }
  });

  // Heartbeat cleanup for dead connections
  setInterval(() => {
    for (const ws of clients) {
      // @ts-ignore
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        clients.delete(ws);
        continue;
      }
      // @ts-ignore
      ws.isAlive = false;
      try { 
        // @ts-ignore
        ws.ping(); 
      } catch {}
    }
  }, 25000);

  // Enhanced WebSocket route for price updates with new contract format
  app.get("/ws/prices", { websocket: true }, (socket, req) => {
      logger.info({ ip: req.ip }, "Client connected to price WebSocket");
      
      // @ts-ignore
      socket.isAlive = true;
      clients.add(socket);
      
      const subscribedTokens = new Set<string>();
      const priceSubscriptions = new Map<string, () => void>();
      
      // Send an initial hello message so clients immediately receive a frame
      try {
        socket.send(JSON.stringify({ type: "hello", message: "connected", ts: Date.now() }));
      } catch (e) {
        logger.error({ err: e }, "Failed to send hello message");
      }

      // Handle pong responses
      socket.on("pong", () => {
        // @ts-ignore
        socket.isAlive = true;
      });
      
      // Enhanced subscription with real price service integration
      socket.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          // Reduced logging - only log for debugging if needed

          if (data.type === "subscribe" && data.mint) {
            subscribedTokens.add(data.mint);

            // Send current cached price immediately if available
            if (data.mint === 'So11111111111111111111111111111111111111112') {
              // Special handling for SOL - always send current price
              const solPrice = priceService.getSolPrice();

              socket.send(JSON.stringify({
                type: "price",
                mint: data.mint,
                price: solPrice,
                change24h: 0,
                timestamp: Date.now()
              }));
            } else {
              // For other tokens, try the cache first
              priceService.getLastTick(data.mint).then(tick => {
                if (tick) {
                  socket.send(JSON.stringify({
                    type: "price",
                    mint: data.mint,
                    price: tick.priceUsd,
                    change24h: tick.change24h || 0,
                    timestamp: tick.timestamp
                  }));
                  // Cached price sent successfully (log removed to reduce noise)
                } else {
                  // Send a placeholder response when no price is available
                  socket.send(JSON.stringify({
                    type: "price",
                    mint: data.mint,
                    price: 0,
                    change24h: 0,
                    timestamp: Date.now()
                  }));
                  // No cached price (log removed to reduce noise)
                }
              }).catch(err => {
                logger.error({ mint: data.mint, err }, "Failed to get price");
                // Send a placeholder response so the client knows we received the subscription
                socket.send(JSON.stringify({
                  type: "price",
                  mint: data.mint,
                  price: 0,
                  change24h: 0,
                  timestamp: Date.now()
                }));
              });
            }

            // Subscribe to real-time price updates for this token using manual subscription
            const unsubscribe = priceService.subscribe((tick) => {
              if (tick.mint === data.mint && subscribedTokens.has(data.mint)) {
                try {
                  socket.send(JSON.stringify({
                    type: "price",
                    mint: data.mint,
                    price: tick.priceUsd,
                    change24h: tick.change24h || 0,
                    timestamp: tick.timestamp
                  }));
                } catch (err) {
                  logger.error({ mint: data.mint, err }, "Failed to send price update");
                }
              }
            });

            // Store the unsubscribe function
            priceSubscriptions.set(data.mint, unsubscribe);

          } else if (data.type === "unsubscribe" && data.mint) {
            subscribedTokens.delete(data.mint);

            // Remove price service subscription
            const unsubscribe = priceSubscriptions.get(data.mint);
            if (unsubscribe) {
              unsubscribe();
              priceSubscriptions.delete(data.mint);
            }

          } else if (data.type === "ping") {
            // Respond to client ping with pong
            try {
              socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            } catch (err) {
              logger.error({ err }, "Failed to send pong");
            }
          } else if (data.type === "pong") {
            // Client responded to our ping - connection is healthy (log removed to reduce noise)
          }
        } catch (error) {
          logger.error({ err: error }, "Error parsing message");
        }
      });
      
      socket.on("close", () => {
        logger.info("Client disconnected");
        
        // Remove from clients set
        clients.delete(socket);
        
        // Clean up all price service subscriptions
        priceSubscriptions.forEach((unsubscribe) => {
          unsubscribe();
        });
        priceSubscriptions.clear();
        subscribedTokens.clear();
      });
      
      socket.on("error", (error) => {
        logger.error({ err: error }, "WebSocket error");
        
        // Remove from clients set
        clients.delete(socket);
        
        // Clean up subscriptions
        priceSubscriptions.forEach((unsubscribe) => {
          unsubscribe();
        });
        priceSubscriptions.clear();
      });
  });

  // Price broadcasts are handled by the price service subscriptions above
  // Real-time prices are emitted when the price service detects updates
}