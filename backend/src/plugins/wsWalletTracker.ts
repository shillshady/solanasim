// WebSocket plugin for real-time wallet activity streaming
import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import prisma from "./prisma.js";
import { WalletActivityService } from "../services/walletActivityService.js";
import { loggers } from "../utils/logger.js";

const logger = loggers.websocket;

interface WalletTrackerClient {
  ws: WebSocket;
  userId: string;
  trackedWallets: Set<string>;
  lastPing: number;
}

const clients = new Map<string, WalletTrackerClient>();
let activityService: WalletActivityService;
let syncInterval: NodeJS.Timeout | null = null;

export default async function wsWalletTrackerPlugin(app: FastifyInstance) {
  activityService = new WalletActivityService(app.log);

  app.get("/ws/wallet-tracker", { websocket: true }, async (connection: any, request: any) => {
    const ws = connection;
    const clientId = Math.random().toString(36).substring(7);

    app.log.info(`Wallet tracker WebSocket connected: ${clientId}`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      clientId,
      message: "Connected to wallet activity stream"
    }));

    // Initialize client
    const client: WalletTrackerClient = {
      ws,
      userId: "",
      trackedWallets: new Set(),
      lastPing: Date.now()
    };

    clients.set(clientId, client);

    // Handle messages from client
    ws.on("message", async (data: any) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "auth":
            await handleAuth(clientId, message.userId);
            break;

          case "subscribe":
            await handleSubscribe(clientId, message.wallets);
            break;

          case "unsubscribe":
            handleUnsubscribe(clientId, message.wallets);
            break;

          case "ping":
            client.lastPing = Date.now();
            ws.send(JSON.stringify({ type: "pong" }));
            break;

          default:
            ws.send(JSON.stringify({
              type: "error",
              message: `Unknown message type: ${message.type}`
            }));
        }
      } catch (error) {
        app.log.error(`WebSocket message error: ${error}`);
        ws.send(JSON.stringify({
          type: "error",
          message: "Invalid message format"
        }));
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      clients.delete(clientId);
      app.log.info(`Wallet tracker WebSocket disconnected: ${clientId}`);
    });

    ws.on("error", (error: any) => {
      app.log.error(`WebSocket error for ${clientId}: ${error}`);
      clients.delete(clientId);
    });
  });

  // Start background sync if not already running
  if (!syncInterval) {
    startBackgroundSync(app);
  }
}

async function handleAuth(clientId: string, userId: string) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      client.ws.send(JSON.stringify({
        type: "error",
        message: "Invalid user ID"
      }));
      return;
    }

    client.userId = userId;

    // Get user's tracked wallets
    const trackedWallets = await prisma.walletTrack.findMany({
      where: { userId },
      select: { address: true, alias: true }
    });

    // Auto-subscribe to user's tracked wallets
    const walletAddresses = trackedWallets.map(w => w.address);
    walletAddresses.forEach(wallet => client.trackedWallets.add(wallet));

    client.ws.send(JSON.stringify({
      type: "authenticated",
      userId,
      trackedWallets: trackedWallets.map(w => ({
        address: w.address,
        alias: w.alias
      }))
    }));

    // Send recent activities for tracked wallets
    if (walletAddresses.length > 0) {
      const recentActivities = await activityService.getRecentActivities(walletAddresses, 20);

      if (recentActivities.length > 0) {
        client.ws.send(JSON.stringify({
          type: "initial_activities",
          activities: formatActivities(recentActivities)
        }));
      }
    }
  } catch (error) {
    logger.error({ clientId, err: error }, "Auth error for wallet tracker client");
    client.ws.send(JSON.stringify({
      type: "error",
      message: "Authentication failed"
    }));
  }
}

async function handleSubscribe(clientId: string, wallets: string[]) {
  const client = clients.get(clientId);
  if (!client || !client.userId) return;

  wallets.forEach(wallet => client.trackedWallets.add(wallet));

  client.ws.send(JSON.stringify({
    type: "subscribed",
    wallets,
    totalSubscriptions: client.trackedWallets.size
  }));

  // Send recent activities for newly subscribed wallets
  const recentActivities = await activityService.getRecentActivities(wallets, 10);

  if (recentActivities.length > 0) {
    client.ws.send(JSON.stringify({
      type: "activities",
      activities: formatActivities(recentActivities)
    }));
  }
}

function handleUnsubscribe(clientId: string, wallets: string[]) {
  const client = clients.get(clientId);
  if (!client) return;

  wallets.forEach(wallet => client.trackedWallets.delete(wallet));

  client.ws.send(JSON.stringify({
    type: "unsubscribed",
    wallets,
    totalSubscriptions: client.trackedWallets.size
  }));
}

// Background sync to fetch new activities periodically
function startBackgroundSync(app: FastifyInstance) {
  syncInterval = setInterval(async () => {
    try {
      // Get all unique tracked wallets from connected clients
      const allWallets = new Set<string>();
      clients.forEach(client => {
        client.trackedWallets.forEach(wallet => allWallets.add(wallet));
      });

      if (allWallets.size === 0) return;

      // Sync activities for all tracked wallets
      const walletsArray = Array.from(allWallets);

      for (const wallet of walletsArray) {
        try {
          const newActivities = await activityService.syncWalletActivities(wallet, 10);

          if (newActivities.length > 0) {
            // Broadcast to all clients tracking this wallet
            broadcastActivities(wallet, newActivities);
          }
        } catch (error) {
          app.log.warn(`Failed to sync wallet ${wallet}: ${error}`);
        }
      }

      // Clean up disconnected clients
      clients.forEach((client, clientId) => {
        if (Date.now() - client.lastPing > 60000) {
          // No ping for 60 seconds, remove client
          clients.delete(clientId);
          try {
            client.ws.close();
          } catch {}
        }
      });
    } catch (error) {
      app.log.error(`Background sync error: ${error}`);
    }
  }, 15000); // Sync every 15 seconds
}

// Broadcast new activities to relevant clients
function broadcastActivities(walletAddress: string, activities: any[]) {
  const formattedActivities = formatActivities(activities);

  clients.forEach(client => {
    if (client.trackedWallets.has(walletAddress) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify({
          type: "new_activities",
          walletAddress,
          activities: formattedActivities
        }));
      } catch (error) {
        logger.error({ walletAddress, err: error }, "Failed to send activities to client");
      }
    }
  });
}

// Format activities for frontend
function formatActivities(activities: any[]): any[] {
  return activities.map(activity => ({
    id: activity.id,
    walletAddress: activity.walletAddress,
    signature: activity.signature,
    type: activity.type,
    tokenIn: {
      mint: activity.tokenInMint,
      symbol: activity.tokenInSymbol,
      amount: activity.tokenInAmount?.toString()
    },
    tokenOut: {
      mint: activity.tokenOutMint,
      symbol: activity.tokenOutSymbol,
      amount: activity.tokenOutAmount?.toString()
    },
    priceUsd: activity.priceUsd?.toString(),
    solAmount: activity.solAmount?.toString(),
    program: activity.program,
    fee: activity.fee?.toString(),
    marketCap: activity.marketCap?.toString(),
    volume24h: activity.volume24h?.toString(),
    priceChange24h: activity.priceChange24h?.toString(),
    timestamp: activity.timestamp.toISOString(),
    timeAgo: getTimeAgo(activity.timestamp)
  }));
}

// Helper function to get time ago string
function getTimeAgo(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Clean up on shutdown
export function stopWalletTrackerWS() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  clients.forEach(client => {
    try {
      client.ws.close();
    } catch {}
  });

  clients.clear();
}