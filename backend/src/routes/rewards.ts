// Rewards routes for VSOL token claims
import { FastifyInstance } from "fastify";
import prisma from "../plugins/prisma.js";
import { authenticateToken, type AuthenticatedRequest } from "../plugins/auth.js";

export default async function rewardsRoutes(app: FastifyInstance) {
  // Claim VSOL rewards
  app.post("/claim", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;
    const { epoch, wallet } = req.body as {
      epoch: number;
      wallet: string;
    };

    if (!epoch || !wallet) {
      return reply.code(400).send({ error: "epoch and wallet required" });
    }
    
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return reply.code(403).send({
          error: "Email verification required",
          message: "Please verify your email address before claiming rewards"
        });
      }

      // Check if already claimed for this epoch
      const existingClaim = await prisma.rewardClaim.findUnique({
        where: {
        userId_epoch: {
          userId,
          epoch: parseInt(epoch.toString())
        }
        }
      });
      
      if (existingClaim) {
        return reply.code(409).send({ error: "Already claimed for this epoch" });
      }
      
      // Calculate reward amount based on user's performance metrics
      const [tradeCount, totalVolume, winRate] = await Promise.all([
        prisma.trade.count({ where: { userId } }),
        prisma.trade.aggregate({
          where: { userId },
          _sum: { totalCost: true }
        }),
        prisma.realizedPnL.aggregate({
          where: { userId, pnl: { gt: 0 } },
          _count: { id: true }
        })
      ]);
      
      const totalTrades = await prisma.trade.count({ where: { userId } });
      const winRatePercent = totalTrades > 0 ? (winRate._count.id / totalTrades) * 100 : 0;
      const volumeUsd = parseFloat(totalVolume._sum.totalCost?.toString() || "0");
      
      // Daily reward calculation based on multiple factors (scaled down from weekly)
      let rewardAmount = 0;
      rewardAmount += tradeCount * 1; // Base reward per trade (reduced for daily)
      rewardAmount += Math.floor(volumeUsd / 100) * 2; // Volume bonus (reduced)
      rewardAmount += Math.floor(winRatePercent / 10) * 10; // Win rate bonus (reduced)

      // Cap at 200 VSOL per day (scaled down from 2000/week)
      rewardAmount = Math.min(rewardAmount, 200);
      
      // Create reward claim record
      const claim = await prisma.rewardClaim.create({
        data: {
          userId,
          epoch: parseInt(epoch.toString()),
          wallet,
          amount: rewardAmount,
          status: "PENDING" // Processed by blockchain service
        }
      });
      
      return {
        claimId: claim.id,
        amount: rewardAmount,
        status: "PENDING",
        message: "Reward claim submitted for processing"
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to claim rewards" });
    }
  });

  // Get user's reward claims
  app.get("/claims/:userId", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;
    
    try {
      const claims = await prisma.rewardClaim.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
      
      return { claims };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch claims" });
    }
  });

  // Admin/Cron: Create reward snapshot
  app.post("/snapshot", async (req, reply) => {
    const { epoch, adminKey } = req.body as {
      epoch: number;
      adminKey: string;
    };
    
    // Simple admin key check (in production use proper auth)
    if (adminKey !== process.env.ADMIN_KEY) {
      return reply.code(403).send({ error: "Unauthorized" });
    }
    
    try {
      // Calculate rewards for all eligible users
      const users = await prisma.user.findMany({
        include: {
          trades: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          },
          positions: true
        }
      });
      
      // Calculate total points for the epoch
      let totalPoints = 0;
      for (const user of users) {
        const tradeCount = user.trades.length;
        const positionCount = user.positions.length;
        
        // Calculate points based on activity
        let userPoints = 0;
        if (tradeCount > 0) userPoints += tradeCount * 5;
        if (positionCount > 0) userPoints += positionCount * 2;
        
        totalPoints += userPoints;
      }
      
      // Default pool amount (can be configured) - scaled for daily
      const poolAmount = 1000; // 1,000 VSOL tokens per day
      
      // Store snapshot for this epoch
      await prisma.rewardSnapshot.create({
        data: {
          epoch: parseInt(epoch.toString()),
          totalPoints,
          poolAmount
        }
      });
      
      return {
        epoch: parseInt(epoch.toString()),
        totalPoints,
        poolAmount
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to create snapshot" });
    }
  });

  // Get reward statistics
  app.get("/stats", async (req, reply) => {
    try {
      const [totalClaims, totalAmount, pendingClaims] = await Promise.all([
        prisma.rewardClaim.count(),
        prisma.rewardClaim.aggregate({
          _sum: { amount: true }
        }),
        prisma.rewardClaim.count({
          where: { status: "PENDING" }
        })
      ]);
      
      return {
        totalClaims,
        totalAmount: totalAmount._sum.amount || 0,
        pendingClaims
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch reward stats" });
    }
  });
}