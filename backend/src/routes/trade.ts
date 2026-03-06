// Enhanced Trade routes with comprehensive response
import { FastifyInstance } from "fastify";
import { fillTrade } from "../services/tradeService.js";
import priceService from "../plugins/priceService.js";
import prisma from "../plugins/prisma.js";
import { authenticateToken, type AuthenticatedRequest } from "../plugins/auth.js";

export default async function (app: FastifyInstance) {
  // Execute a trade
  app.post("/", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;
    const { mint, side, qty } = req.body as {
      mint: string;
      side: "BUY" | "SELL";
      qty: string;
    };

    // Validation
    if (!mint || !side || !qty) {
      return reply.code(400).send({
        error: "Missing required fields: mint, side, qty"
      });
    }

    if (!["BUY", "SELL"].includes(side)) {
      return reply.code(400).send({ 
        error: "Invalid side. Must be 'BUY' or 'SELL'" 
      });
    }

    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return reply.code(400).send({ 
        error: "Invalid quantity. Must be a positive number" 
      });
    }

    try {
      // Execute the trade
      const result = await fillTrade({ userId, mint, side, qty });
      
      // Get current price for real-time updates
      const currentTick = await priceService.getLastTick(mint);
      if (!currentTick) {
        return reply.code(500).send({ 
          error: "Price data unavailable for this token",
          code: "PRICE_UNAVAILABLE"
        });
      }
      
      // Format response for frontend
      return {
        success: true,
        trade: {
          id: result.trade.id,
          userId: result.trade.userId,
          tokenAddress: result.trade.tokenAddress,
          side: result.trade.side,
          quantity: result.trade.quantity.toString(),
          price: result.trade.price.toString(),
          totalCost: result.trade.totalCost.toString(),
          costUsd: result.trade.costUsd?.toString(),
          timestamp: result.trade.timestamp,
          marketCapUsd: result.trade.marketCapUsd?.toString()
        },
        position: {
          mint: result.position.mint,
          quantity: result.position.qty.toString(),
          costBasis: result.position.costBasis.toString(),
          currentPrice: currentTick.priceUsd.toString(),
          unrealizedPnL: result.position.qty.mul(currentTick.priceUsd).sub(
            result.position.costBasis
          ).toString()
        },
        portfolioTotals: {
          totalValueUsd: result.portfolioTotals.totalValueUsd.toString(),
          totalCostBasis: result.portfolioTotals.totalCostBasis.toString(),
          unrealizedPnL: result.portfolioTotals.unrealizedPnL.toString(),
          realizedPnL: result.portfolioTotals.realizedPnL.toString(),
          solBalance: result.portfolioTotals.solBalance.toString()
        },
        rewardPointsEarned: result.rewardPointsEarned.toString(),
        currentPrice: currentTick.priceUsd
      };
    } catch (error: any) {
      app.log.error("Trade execution failed:", error);
      
      // Return specific error messages for better UX
      const errorMessage = error.message || "Trade execution failed";
      return reply.code(400).send({ 
        error: errorMessage,
        code: error.code || "TRADE_FAILED"
      });
    }
  });

  // Get trade history for a user
  app.get("/history/:userId", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;
    const { limit = "50", offset = "0", mint } = req.query as {
      limit?: string;
      offset?: string;
      mint?: string;
    };

    try {
      const trades = await prisma.trade.findMany({
        where: {
          userId,
          ...(mint && { mint })
        },
        orderBy: { timestamp: "desc" },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          user: {
            select: {
              id: true,
              handle: true,
              profileImage: true
            }
          }
        }
      });

      return {
        trades: trades.map((trade: any) => ({
          id: trade.id,
          tokenAddress: trade.tokenAddress,
          side: trade.side,
          quantity: trade.quantity.toString(),
          price: trade.price.toString(),
          totalCost: trade.totalCost.toString(),
          costUsd: trade.costUsd?.toString(),
          timestamp: trade.timestamp,
          marketCapUsd: trade.marketCapUsd?.toString(),
          user: trade.user
        })),
        total: trades.length,
        hasMore: trades.length === parseInt(limit)
      };
    } catch (error: any) {
      app.log.error("Failed to fetch trade history:", error);
      return reply.code(500).send({ error: "Failed to fetch trade history" });
    }
  });
}
