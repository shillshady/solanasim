// Enhanced Wallet Tracker Routes V2
import { FastifyInstance } from "fastify";
import prisma from "../plugins/prisma.js";
import { WalletActivityService } from "../services/walletActivityService.js";
import logger from "../utils/logger.js";

export default async function walletTrackerV2Routes(app: FastifyInstance) {
  const activityService = new WalletActivityService(app.log);

  // Get all tracked wallet activities for a user (main feed)
  app.get("/feed/:userId", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { limit = "50", offset = "0", tokenMint, type } = req.query as any;

    try {
      // Get user's tracked wallets
      const trackedWallets = await prisma.walletTrack.findMany({
        where: { userId },
        select: { address: true }
      });

      if (trackedWallets.length === 0) {
        return { activities: [], hasMore: false };
      }

      const walletAddresses = trackedWallets.map(w => w.address);

      // Get filtered activities
      const activities = await activityService.getFilteredActivities({
        walletAddresses,
        tokenMint,
        type,
        limit: parseInt(limit) + 1, // Get one extra to check if there's more
        offset: parseInt(offset)
      });

      const hasMore = activities.length > parseInt(limit);
      if (hasMore) {
        activities.pop(); // Remove the extra item
      }

      // Format activities for frontend
      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        walletAddress: activity.walletAddress,
        signature: activity.signature,
        type: activity.type,
        tokenIn: {
          mint: activity.tokenInMint,
          symbol: activity.tokenInSymbol,
          amount: activity.tokenInAmount?.toString(),
          logoURI: activity.tokenInLogoURI
        },
        tokenOut: {
          mint: activity.tokenOutMint,
          symbol: activity.tokenOutSymbol,
          amount: activity.tokenOutAmount?.toString(),
          logoURI: activity.tokenOutLogoURI
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

      return {
        activities: formattedActivities,
        hasMore,
        nextOffset: hasMore ? parseInt(offset) + parseInt(limit) : null
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch activity feed" });
    }
  });

  // Sync wallet activities (fetch latest from blockchain)
  app.post("/sync/:walletAddress", async (req, reply) => {
    const { walletAddress } = req.params as { walletAddress: string };
    const { limit = "100" } = req.body as { limit?: string };

    try {
      const activities = await activityService.syncWalletActivities(
        walletAddress,
        parseInt(limit)
      );

      return {
        message: "Wallet activities synced",
        activitiesCount: activities.length,
        latestActivity: activities[0] ? {
          signature: activities[0].signature,
          timestamp: activities[0].timestamp
        } : null
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to sync wallet activities" });
    }
  });

  // Get wallet statistics
  app.get("/stats/:walletAddress", async (req, reply) => {
    const { walletAddress } = req.params as { walletAddress: string };
    const { period = "day" } = req.query as { period?: 'day' | 'week' | 'month' };

    try {
      const stats = await activityService.getWalletStats(walletAddress, period);

      // Get wallet label if tracked
      const trackedWallet = await prisma.walletTrack.findFirst({
        where: { address: walletAddress },
        select: { alias: true }
      });

      return {
        walletAddress,
        label: trackedWallet?.alias,
        period,
        stats
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to get wallet stats" });
    }
  });

  // Get aggregated stats for all tracked wallets
  app.get("/aggregated-stats/:userId", async (req, reply) => {
    const { userId } = req.params as { userId: string };

    try {
      const trackedWallets = await prisma.walletTrack.findMany({
        where: { userId },
        select: { address: true, alias: true }
      });

      const aggregatedStats = {
        totalWallets: trackedWallets.length,
        totalTrades24h: 0,
        totalVolume24h: 0,
        topTraders: [] as any[]
      };

      for (const wallet of trackedWallets) {
        const stats = await activityService.getWalletStats(wallet.address, 'day');

        aggregatedStats.totalTrades24h += stats.totalTrades;
        aggregatedStats.totalVolume24h += stats.totalVolume;

        aggregatedStats.topTraders.push({
          address: wallet.address,
          label: wallet.alias,
          trades24h: stats.totalTrades,
          volume24h: stats.totalVolume,
          profitLoss: stats.profitLoss
        });
      }

      // Sort top traders by volume
      aggregatedStats.topTraders.sort((a, b) => b.volume24h - a.volume24h);
      aggregatedStats.topTraders = aggregatedStats.topTraders.slice(0, 10);

      return aggregatedStats;
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to get aggregated stats" });
    }
  });

  // Enhanced copy trade with better position sizing
  app.post("/copy-trade-v2", async (req, reply) => {
    const {
      userId,
      activityId,
      percentage = 100,
      maxUsdAmount
    } = req.body as {
      userId: string;
      activityId: string;
      percentage?: number;
      maxUsdAmount?: number;
    };

    if (!userId || !activityId) {
      return reply.code(400).send({ error: "userId and activityId required" });
    }

    try {
      // Get the activity to copy
      const activity = await prisma.walletActivity.findUnique({
        where: { id: activityId }
      });

      if (!activity) {
        return reply.code(404).send({ error: "Activity not found" });
      }

      // Only allow copying BUY activities
      if (activity.type !== 'BUY') {
        return reply.code(400).send({ error: "Can only copy BUY trades" });
      }

      if (!activity.tokenOutMint || !activity.priceUsd) {
        return reply.code(400).send({ error: "Insufficient trade data for copying" });
      }

      // Calculate copy amount
      let copyAmountUsd = (activity.priceUsd.toNumber() * percentage) / 100;

      if (maxUsdAmount && copyAmountUsd > maxUsdAmount) {
        copyAmountUsd = maxUsdAmount;
      }

      // Execute the copy trade
      const { fillTrade } = await import("../services/tradeService.js");

      // Calculate quantity based on current price
      const currentPrice = await getCurrentTokenPrice(activity.tokenOutMint);
      const quantity = copyAmountUsd / currentPrice;

      const tradeResult = await fillTrade({
        userId,
        mint: activity.tokenOutMint,
        side: "BUY",
        qty: quantity.toString()
      });

      // Log the copy trade
      await prisma.copyTrade.create({
        data: {
          userId,
          walletAddress: activity.walletAddress,
          mint: activity.tokenOutMint,
          side: "BUY",
          qty: quantity,
          priceUsd: currentPrice,
          status: "EXECUTED",
          executedAt: new Date()
        }
      });

      return {
        success: true,
        copyTradeId: tradeResult.trade.id,
        originalActivity: {
          signature: activity.signature,
          amount: activity.priceUsd.toString()
        },
        copiedTrade: {
          amount: copyAmountUsd,
          percentage,
          token: activity.tokenOutSymbol || activity.tokenOutMint,
          quantity
        }
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: error.message || "Failed to copy trade" });
    }
  });

  // Clear activities for a wallet (useful for re-syncing)
  app.delete("/activities/:walletAddress", async (req, reply) => {
    const { walletAddress } = req.params as { walletAddress: string };

    try {
      const deleted = await prisma.walletActivity.deleteMany({
        where: { walletAddress }
      });

      return {
        message: "Activities cleared",
        deletedCount: deleted.count
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to clear activities" });
    }
  });

  // Auto-sync all tracked wallets (for background job)
  app.post("/auto-sync", async (req, reply) => {
    const { secret } = req.body as { secret?: string };

    // Simple auth for cron job
    if (secret !== process.env.CRON_SECRET) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    try {
      // Get all unique tracked wallets
      const trackedWallets = await prisma.walletTrack.findMany({
        select: { address: true },
        distinct: ['address']
      });

      let syncedCount = 0;
      let totalActivities = 0;

      for (const wallet of trackedWallets) {
        try {
          const activities = await activityService.syncWalletActivities(wallet.address, 50);
          if (activities.length > 0) {
            syncedCount++;
            totalActivities += activities.length;
          }
        } catch (error) {
          app.log.warn(`Failed to sync wallet ${wallet.address}: ${error}`);
        }
      }

      return {
        success: true,
        walletsProcessed: trackedWallets.length,
        walletsSynced: syncedCount,
        totalActivities
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Auto-sync failed" });
    }
  });
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

// Helper function to get current token price
async function getCurrentTokenPrice(mint: string): Promise<number> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        return parseFloat(data.pairs[0].priceUsd || 0);
      }
    }
  } catch (error) {
    logger.error({ mint, error }, "Failed to get price for token");
  }

  // Default to a small amount if price fetch fails
  return 0.001;
}