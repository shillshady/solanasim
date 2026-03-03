// Debug routes for price service monitoring
import { FastifyInstance } from "fastify";
import priceService from "../plugins/priceService.js";
import logger from "../utils/logger.js";

export default async function debugRoutes(app: FastifyInstance) {
  // Debug endpoint to check price service status
  app.get("/api/debug/price-service", async (request, reply) => {
    try {
      const stats = priceService.getStats();
      const allPrices = priceService.getAllCachedPrices();
      
      return {
        success: true,
        stats,
        prices: allPrices,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error }, "Debug price service error");
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Force price update for testing
  app.post("/api/debug/force-price-update", async (request, reply) => {
    try {
      logger.info("Forcing price update via debug endpoint");
      
      // Trigger SOL price update manually
      await (priceService as any).updateSolPrice();
      
      const stats = priceService.getStats();
      
      return {
        success: true,
        message: "Price update triggered",
        stats,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error }, "Force price update error");
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test WebSocket subscribers
  app.get("/api/debug/websocket-subscribers", async (request, reply) => {
    try {
      const subscriberCount = priceService.listenerCount('price');
      
      return {
        success: true,
        subscriberCount,
        message: `${subscriberCount} active WebSocket price subscribers`,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error }, "WebSocket subscriber debug error");
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}