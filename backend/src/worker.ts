/**
 * Background Worker Service for Solana Sim
 *
 * Jobs:
 * 1. Trending Token Calculator - Calculates momentum/trending scores every 5 minutes
 * 2. Price Cache Pre-warmer - Keeps popular token prices fresh every 30 seconds
 *
 * This runs as a separate Railway service to offload heavy background tasks
 * from the main API service, improving overall performance.
 */

import { Decimal } from "@prisma/client/runtime/library";
import prisma from "./plugins/prisma.js";
import priceService from "./plugins/priceService-optimized.js";
import { loggers } from "./utils/logger.js";

const logger = loggers.priceService;

// Configuration
const TRENDING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PRICE_WARMUP_INTERVAL = 30 * 1000; // 30 seconds
const TOP_TOKENS_COUNT = 100; // Pre-warm top 100 most traded tokens

/**
 * Job 1: Calculate Trending Scores for All Tokens
 *
 * Analyzes price changes, volume changes, and momentum to determine
 * which tokens are "trending" and should appear on the trending page.
 */
async function calculateTrendingScores() {
  try {
    logger.info("🔥 Starting trending token calculation...");

    // Get all tokens that have been traded recently
    const tokens = await prisma.token.findMany({
      where: {
        volume24h: { gt: 0 }
      },
      orderBy: {
        volume24h: 'desc'
      },
      take: 500 // Limit to top 500 by volume
    });

    logger.info({ count: tokens.length }, "Tokens to analyze");

    let updated = 0;
    let errors = 0;

    // Process tokens in batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (token) => {
          try {
            // Get current price from cache (fast)
            const currentPrice = await priceService.getPrice(token.address);

            if (currentPrice === 0) {
              // Skip tokens with no price data
              return;
            }

            // Calculate price change from last known price
            const lastPriceNum = token.lastPrice ? parseFloat(token.lastPrice.toString()) : 0;
            const priceChange = lastPriceNum > 0
              ? ((currentPrice - lastPriceNum) / lastPriceNum) * 100
              : 0;

            // Get volume metrics (using existing price change fields for volume indicators)
            const volume24h = token.volume24h ? parseFloat(token.volume24h.toString()) : 0;
            const volume1h = token.volume1h ? parseFloat(token.volume1h.toString()) : 0;

            // Calculate volume velocity (1h volume extrapolated to 24h vs actual 24h)
            const volumeVelocity = volume1h > 0 ? (volume1h * 24) / Math.max(volume24h, 1) : 1;

            // Calculate momentum score
            // Formula: (price_change × 0.5) + (volume_score × 0.3) + (velocity × 0.2)
            const volumeScore = Math.min(volume24h / 10000, 100); // Normalize to 0-100
            const momentum = (
              (priceChange * 0.5) +
              (volumeScore * 0.3) +
              (volumeVelocity * 20) // Scale velocity
            );

            // Update token with new metrics
            await prisma.token.update({
              where: { address: token.address },
              data: {
                lastPrice: new Decimal(currentPrice),
                momentumScore: new Decimal(momentum.toFixed(2)),
                isTrending: momentum > 50, // Mark as trending if momentum > 50
                lastUpdatedAt: new Date()
              }
            });

            updated++;

          } catch (err) {
            errors++;
            logger.debug({ address: token.address, error: err }, "Failed to update token");
          }
        })
      );

      // Small delay between batches to avoid database overload
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info({
      updated,
      errors,
      total: tokens.length
    }, "✅ Trending calculation complete");

  } catch (error) {
    logger.error({ error }, "❌ Error calculating trending scores");
  }
}

/**
 * Job 2: Pre-warm Price Cache for Popular Tokens
 *
 * Fetches prices for the most actively traded tokens to ensure
 * they're always in cache when users request them. This dramatically
 * improves API response times for popular tokens.
 */
async function prewarmPriceCache() {
  try {
    logger.debug("♨️  Pre-warming price cache...");

    // Get top tokens by 24h volume (most likely to be requested)
    const popularTokens = await prisma.token.findMany({
      where: {
        volume24h: { gt: 0 }
      },
      orderBy: {
        volume24h: 'desc'
      },
      take: TOP_TOKENS_COUNT,
      select: {
        address: true,
        symbol: true
      }
    });

    logger.debug({ count: popularTokens.length }, "Tokens to pre-warm");

    // Fetch prices in batches to respect rate limits
    const addresses = popularTokens.map(t => t.address);
    const prices = await priceService.getPrices(addresses);

    const cached = Object.keys(prices).filter(address => prices[address] > 0).length;

    logger.info({
      requested: addresses.length,
      cached,
      hitRate: `${((cached / addresses.length) * 100).toFixed(1)}%`
    }, "✅ Price cache pre-warmed");

  } catch (error) {
    logger.error({ error }, "❌ Error pre-warming price cache");
  }
}

/**
 * Main Worker Service
 */
async function startWorker() {
  logger.info("🚀 Solana Sim Worker Service Starting...");

  // Initialize price service
  await priceService.start();
  logger.info("✅ Price service connected");

  // Verify database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("✅ Database connected");
  } catch (dbError) {
    const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
    logger.error({ error: dbError }, "❌ Database connection failed");
    throw new Error(`Database connection failed: ${errorMsg}`);
  }

  // Run initial jobs immediately
  logger.info("Running initial jobs...");
  try {
    await Promise.all([
      prewarmPriceCache(),
      calculateTrendingScores()
    ]);
    logger.info("✅ Initial jobs completed");
  } catch (jobError) {
    const errorMsg = jobError instanceof Error ? jobError.message : String(jobError);
    logger.error({ error: jobError }, "❌ Initial jobs failed");
    throw new Error(`Initial jobs failed: ${errorMsg}`);
  }

  // Schedule recurring jobs
  logger.info({
    trendingInterval: `${TRENDING_INTERVAL / 1000 / 60}m`,
    priceWarmupInterval: `${PRICE_WARMUP_INTERVAL / 1000}s`
  }, "⏰ Scheduling background jobs");

  // Job 1: Trending Calculator (every 5 minutes)
  setInterval(calculateTrendingScores, TRENDING_INTERVAL);

  // Job 2: Price Pre-warmer (every 30 seconds)
  setInterval(prewarmPriceCache, PRICE_WARMUP_INTERVAL);

  logger.info("✅ Worker service running");
}

// Graceful shutdown (prisma singleton handles its own disconnect)
process.on('SIGTERM', async () => {
  logger.info("🛑 Received SIGTERM, shutting down gracefully...");
  await priceService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info("🛑 Received SIGINT, shutting down gracefully...");
  await priceService.stop();
  process.exit(0);
});

// Start the worker
startWorker().catch((error) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    name: error.name
  }, "Worker service failed to start");
  process.exit(1);
});
