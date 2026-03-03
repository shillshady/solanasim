// Trending routes placeholder
import { FastifyInstance } from "fastify";
import { getTrendingTokens } from "../services/trendingService.js";
import logger from "../utils/logger.js";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) => {
    logger.info("Trending API endpoint hit");

    // Extract query parameters
    const query = req.query as any;
    const limit = parseInt(query.limit || '20');
    const sortBy = (query.sortBy || 'rank') as 'rank' | 'volume24hUSD' | 'liquidity';

    logger.info({ sortBy, limit }, "Fetching trending tokens");

    const data = await getTrendingTokens(limit, sortBy);
    logger.info({ count: data.length }, "Returning trending tokens");
    return { items: data };
  });
}
