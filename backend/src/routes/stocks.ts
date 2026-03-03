// Stocks routes for tokenized stocks
import { FastifyInstance } from "fastify";
import { getStockTokens } from "../services/stocksService.js";
import logger from "../utils/logger.js";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) => {
    logger.info("Stocks API endpoint hit");

    // Extract query parameters
    const query = req.query as any;
    const limit = parseInt(query.limit || '50');

    logger.info({ limit }, "Fetching tokenized stocks");

    const data = await getStockTokens(limit);
    logger.info({ count: data.length }, "Returning stock tokens");
    return { items: data };
  });
}
