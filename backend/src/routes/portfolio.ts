// Portfolio routes with enhanced functionality
import { FastifyInstance } from "fastify";
import {
  getPortfolio,
  getPortfolioWithRealTimePrices,
  getPortfolioTradingStats,
  getPortfolioPerformance
} from "../services/portfolioService.js";
import { authenticateToken, type AuthenticatedRequest } from "../plugins/auth.js";
import { loggers } from "../utils/logger.js";

const logger = loggers.portfolio;

export default async function (app: FastifyInstance) {
  // Main portfolio endpoint with metadata enrichment
  app.get("/", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;

    try {
      const data = await getPortfolio(userId);
      return data;
    } catch (error) {
      logger.error("Portfolio fetch error:", error);
      return reply.code(500).send({
        error: "Failed to fetch portfolio data"
      });
    }
  });

  // Real-time portfolio endpoint with live price updates
  app.get("/realtime", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;

    try {
      const data = await getPortfolioWithRealTimePrices(userId);
      return data;
    } catch (error) {
      logger.error("Real-time portfolio fetch error:", error);
      return reply.code(500).send({
        error: "Failed to fetch real-time portfolio data"
      });
    }
  });

  // Trading statistics endpoint
  app.get("/stats", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;

    try {
      const stats = await getPortfolioTradingStats(userId);
      return stats;
    } catch (error) {
      logger.error("Portfolio stats fetch error:", error);
      return reply.code(500).send({
        error: "Failed to fetch portfolio statistics"
      });
    }
  });

  // Portfolio performance over time
  app.get("/performance", { preHandler: [authenticateToken] }, async (req: AuthenticatedRequest, reply) => {
    const userId = req.user!.id;
    const { days: daysStr } = req.query as { days?: string };
    const days = parseInt(daysStr || "30") || 30;

    try {
      const performance = await getPortfolioPerformance(userId, days);
      return { performance };
    } catch (error) {
      logger.error("Portfolio performance fetch error:", error);
      return reply.code(500).send({
        error: "Failed to fetch portfolio performance"
      });
    }
  });
}
