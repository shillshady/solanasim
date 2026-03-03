// Trending routes placeholder
import { FastifyInstance } from "fastify";
import { getTrendingTokens } from "../services/trendingService.js";
import logger from "../utils/logger.js";

export default async function (app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const query = req.query as any;
    const limit = parseInt(query.limit || '20');
    const sortBy = (query.sortBy || 'rank') as 'rank' | 'volume24hUSD' | 'liquidity';

    try {
      const data = await getTrendingTokens(limit, sortBy);
      return { items: data };
    } catch (error: any) {
      logger.error({ err: error }, "Trending endpoint failed");
      return reply.code(500).send({ error: "Failed to fetch trending tokens", items: [] });
    }
  });
}
