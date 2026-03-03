// Trending service for popular tokens
import prisma from "../plugins/prisma.js";
import priceService from "../plugins/priceService.js";
import { getTokenMetaBatch } from "./tokenService.js";
import { robustFetch, fetchJSON } from "../utils/fetch.js";
import redis from "../plugins/redis.js";
import { safeStringify, safeParse } from "../utils/json.js";
import { loggers } from "../utils/logger.js";
const logger = loggers.trending;

export interface TrendingToken {
  mint: string;
  symbol: string | null;
  name: string | null;
  logoURI: string | null;
  priceUsd: number;
  priceChange24h: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  volume24h: number;
  marketCapUsd: number | null;
  tradeCount: number;
  uniqueTraders: number;
}

export type BirdeyeSortBy = 'rank' | 'volume24hUSD' | 'liquidity';

export async function getTrendingTokens(limit: number = 20, sortBy: BirdeyeSortBy = 'rank'): Promise<TrendingToken[]> {
  // Check Redis cache first (60 second TTL for trending data)
  const cacheKey = `trending:${sortBy}:${limit}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug("Returning cached trending tokens");
      return safeParse(cached);
    }
  } catch (error) {
    logger.warn({ err: error }, "Redis cache read failed for trending");
  }

  try {
    logger.info({ limit, sortBy }, "Fetching trending tokens");

    // Use Birdeye for trending data first
    const birdeyeTrending = await getBirdeyeTrending(limit, sortBy);
    logger.info({ count: birdeyeTrending.length }, "Birdeye returned tokens");

    if (birdeyeTrending.length > 0) {
      logger.info({ count: birdeyeTrending.length }, "Using Birdeye data for trending tokens (fast mode)");

      // Cache result in Redis for 60 seconds
      try {
        await redis.setex(cacheKey, 60, safeStringify(birdeyeTrending));
      } catch (error) {
        logger.warn({ err: error }, "Failed to cache trending tokens");
      }

      return birdeyeTrending;
    }

    // Fallback to DexScreener if Birdeye fails
    logger.info("Birdeye failed, trying DexScreener fallback");
    const dexTrending = await getDexScreenerTrending(limit);
    logger.info({ count: dexTrending.length }, "DexScreener returned tokens (fast mode)");
    // Skip internal enrichment for performance - DexScreener data is sufficient

    // Cache DexScreener result
    try {
      await redis.setex(cacheKey, 60, safeStringify(dexTrending));
    } catch (error) {
      logger.warn({ err: error }, "Failed to cache trending tokens");
    }

    return dexTrending;

  } catch (error) {
    logger.error({ err: error }, "Error fetching trending tokens");

    // Fallback to internal data only
    logger.info("All external APIs failed, using internal data fallback");
    return getInternalTrendingTokens(limit);
  }
}

async function getBirdeyeTrending(limit: number, sortBy: BirdeyeSortBy = 'rank'): Promise<TrendingToken[]> {
  try {
    // Temporarily hardcode the API key for testing
    const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || "caa61fdc964643e197d86d70d5d70671";

    logger.debug({ hasApiKey: !!BIRDEYE_API_KEY, sortBy }, "Fetching Birdeye trending tokens");

    // Use the correct Birdeye trending endpoint with dynamic sort_by
    const response = await robustFetch(`https://public-api.birdeye.so/defi/token_trending?sort_by=${sortBy}&sort_type=desc&offset=0&limit=${limit}&ui_amount_mode=scaled`, {
      headers: {
        'Accept': 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': BIRDEYE_API_KEY,
      },
      timeout: 10000,
      retries: 2,
      retryDelay: 1000
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      logger.error({ status: response.status, statusText: response.statusText, errorText }, "Birdeye API error");
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json() as any;
    logger.debug({ keys: Object.keys(data) }, "Birdeye API response structure");

    // Handle the Birdeye trending API response structure
    let tokens = [];
    if (data.data?.tokens) {
      tokens = data.data.tokens;
    } else if (data.tokens) {
      tokens = data.tokens;
    } else {
      logger.warn({ keys: Object.keys(data) }, "Unexpected Birdeye response structure");
      return [];
    }

    logger.info({ count: tokens.length }, "Found tokens from Birdeye trending API");

    return tokens
      .map((token: any) => {
        // Map Birdeye trending API fields to our TrendingToken interface
        const mint = token.address;
        const price = parseFloat(token.price || '0');

        // Extract all available price change fields
        const priceChange5m = token.price5mChangePercent !== undefined ? parseFloat(token.price5mChangePercent) : undefined;
        const priceChange1h = token.price1hChangePercent !== undefined ? parseFloat(token.price1hChangePercent) : undefined;
        const priceChange6h = token.price6hChangePercent !== undefined ? parseFloat(token.price6hChangePercent) : undefined;
        const priceChange24h = parseFloat(token.price24hChangePercent || '0');

        const volume24h = parseFloat(token.volume24hUSD || '0');
        const marketCap = parseFloat(token.marketcap || '0') || null;

        return {
          mint,
          symbol: token.symbol,
          name: token.name || token.symbol,
          logoURI: token.logoURI || null,
          priceUsd: price,
          priceChange24h,
          priceChange5m,
          priceChange1h,
          priceChange6h,
          volume24h,
          marketCapUsd: marketCap,
          tradeCount: 0,
          uniqueTraders: 0
        };
      })
      .filter((token: any) => {
        // Final validation
        const isValid = token.mint && token.symbol && token.priceUsd > 0;
        if (!isValid) {
          logger.debug({ token }, "Filtering out invalid token");
        }
        return isValid;
      });

  } catch (error) {
    logger.error({ err: error }, "Birdeye trending fetch failed");
    return [];
  }
}
/**
 * OPTIMIZED: Batch enrichment with internal data using single queries
 * OLD: 40+ queries for 20 tokens | NEW: 2 queries (10x faster)
 */
async function enrichWithInternalData(tokens: TrendingToken[]): Promise<TrendingToken[]> {
  const startTime = Date.now();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mints = tokens.map(t => t.mint);

  // Query 1: Batch fetch trade counts for all tokens (single query)
  const tradeCounts = await prisma.trade.groupBy({
    by: ['mint'],
    where: { mint: { in: mints }, createdAt: { gte: last24h } },
    _count: { id: true }
  });

  // Query 2: Batch fetch unique traders for all tokens (single query)
  const uniqueTraders = await prisma.trade.groupBy({
    by: ['mint', 'userId'],
    where: { mint: { in: mints }, createdAt: { gte: last24h } }
  });

  // Build lookup maps for O(1) access
  const tradeCountMap = new Map(
    tradeCounts.map(t => [t.mint, t._count.id])
  );

  const traderCountMap = new Map<string, number>();
  for (const { mint } of uniqueTraders) {
    traderCountMap.set(mint, (traderCountMap.get(mint) || 0) + 1);
  }

  // Batch fetch metadata for all tokens (single API call - massive speedup!)
  const metadataResults = await getTokenMetaBatch(mints).catch(err => {
    logger.warn({ err }, "Batch metadata fetch failed");
    return [];
  });

  const metadataMap = new Map();
  metadataResults.forEach(token => {
    if (token?.address) {
      metadataMap.set(token.address, token);
    }
  });

  // Enrich tokens with internal data (in-memory, fast)
  const enrichedTokens = tokens.map(token => {
    const meta = metadataMap.get(token.mint);
    return {
      ...token,
      symbol: meta?.symbol || token.symbol,
      name: meta?.name || token.name,
      logoURI: meta?.logoURI || token.logoURI,
      tradeCount: tradeCountMap.get(token.mint) || 0,
      uniqueTraders: traderCountMap.get(token.mint) || 0
    };
  });

  const duration = Date.now() - startTime;
  logger.info({ durationMs: duration, count: tokens.length }, "Trending enrichment complete");

  return enrichedTokens;
}

async function getDexScreenerTrending(limit: number): Promise<TrendingToken[]> {
  try {
    // Get trending pairs from DexScreener - improved endpoint
    const response = await robustFetch(`https://api.dexscreener.com/latest/dex/tokens/trending?chainId=solana`, {
      timeout: 10000,
      retries: 2,
      retryDelay: 1000
    });

    if (!response.ok) {
      // Fallback to search endpoint
      const searchResponse = await robustFetch(`https://api.dexscreener.com/latest/dex/search/?q=SOL&orderBy=volume24hDesc&limit=${limit * 2}`, {
        timeout: 10000,
        retries: 2,
        retryDelay: 1000
      });
      if (!searchResponse.ok) {
        throw new Error(`DexScreener API error: ${searchResponse.status}`);
      }
      const searchData = await searchResponse.json() as any;
      return processDexScreenerPairs(searchData.pairs || [], limit);
    }

    const data = await response.json() as any;
    return processDexScreenerPairs(data.pairs || [], limit);

  } catch (error: any) {
    logger.error({ code: error.code, err: error.message }, "DexScreener trending failed");

    // Fallback to popular Solana tokens with current prices
    return getPopularSolanaTokens();
  }
}

function processDexScreenerPairs(pairs: any[], limit: number): TrendingToken[] {
  // Filter for Solana tokens and convert to our format
  const solanaPairs = pairs.filter((pair: any) => 
    pair.chainId === 'solana' && 
    pair.baseToken?.address &&
    pair.priceUsd &&
    parseFloat(pair.volume?.h24 || '0') > 1000 // Minimum volume filter
  ).slice(0, limit);

  return solanaPairs.map((pair: any) => ({
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    logoURI: pair.info?.imageUrl || null,
    priceUsd: parseFloat(pair.priceUsd || '0'),
    priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
    volume24h: parseFloat(pair.volume?.h24 || '0'),
    marketCapUsd: parseFloat(pair.marketCap || '0') || null,
    tradeCount: 0,
    uniqueTraders: 0
  }));
}

async function getPopularSolanaTokens(): Promise<TrendingToken[]> {
  // Fallback list of popular Solana tokens with more realistic data
  const popularTokens = [
    {
      mint: "So11111111111111111111111111111111111111112", // SOL
      symbol: "SOL",
      name: "Solana",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      priceUsd: 190.25,
      priceChange24h: 5.2,
      volume24h: 2500000000,
      marketCapUsd: 104000000000
    },
    {
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      symbol: "USDC",
      name: "USD Coin",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
      priceUsd: 1.00,
      priceChange24h: 0.1,
      volume24h: 1200000000,
      marketCapUsd: 12000000000
    },
    {
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
      symbol: "BONK",
      name: "Bonk",
      logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
      priceUsd: 0.000013,
      priceChange24h: 15.8,
      volume24h: 85000000,
      marketCapUsd: 1164000000
    },
    {
      mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
      symbol: "JUP",
      name: "Jupiter",
      logoURI: "https://static.jup.ag/jup/icon.png",
      priceUsd: 0.33,
      priceChange24h: 8.4,
      volume24h: 45000000,
      marketCapUsd: 1126000000
    },
    {
      mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
      symbol: "POPCAT",
      name: "POPCAT",
      logoURI: "https://popcatsol.com/img/logo.png",
      priceUsd: 0.149,
      priceChange24h: 12.3,
      volume24h: 35000000,
      marketCapUsd: 146000000
    },
    {
      mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
      symbol: "WIF",
      name: "dogwifhat",
      logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link",
      priceUsd: 0.458,
      priceChange24h: -2.1,
      volume24h: 28000000,
      marketCapUsd: 457000000
    },
    {
      mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
      symbol: "RAY",
      name: "Raydium",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
      priceUsd: 2.01,
      priceChange24h: 6.7,
      volume24h: 32000000,
      marketCapUsd: 1117000000
    },
    {
      mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
      symbol: "mSOL",
      name: "Marinade staked SOL",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
      priceUsd: 253.22,
      priceChange24h: 4.8,
      volume24h: 25000000,
      marketCapUsd: 818000000
    }
  ];

  const tokens: TrendingToken[] = [];
  
  for (const tokenData of popularTokens) {
    try {
      // Use static fallback data - this only runs if all APIs fail
      tokens.push({
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        logoURI: tokenData.logoURI,
        priceUsd: tokenData.priceUsd,
        priceChange24h: tokenData.priceChange24h,
        volume24h: tokenData.volume24h,
        marketCapUsd: tokenData.marketCapUsd,
        tradeCount: 0, // No internal data available in fallback mode
        uniqueTraders: 0  // No internal data available in fallback mode
      });
    } catch (error) {
      logger.error({ mint: tokenData.mint, err: error }, "Error loading popular token");
    }
  }
  
  return tokens;
}

/**
 * OPTIMIZED: Internal trending tokens with batch queries
 * Fallback when external APIs fail
 */
async function getInternalTrendingTokens(limit: number): Promise<TrendingToken[]> {
  const startTime = Date.now();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Query 1: Get trading activity by mint (single query with aggregation)
  const trendingData = await prisma.trade.groupBy({
    by: ["mint"],
    where: {
      createdAt: { gte: last24h }
    },
    _count: {
      id: true,
      userId: true
    },
    _sum: {
      costUsd: true
    },
    orderBy: {
      _count: {
        id: "desc"
      }
    },
    take: limit
  });

  const mints = trendingData.map(d => d.mint);

  // Query 2: Batch fetch unique traders for all trending tokens (single query)
  const uniqueTraders = await prisma.trade.groupBy({
    by: ['mint', 'userId'],
    where: { mint: { in: mints }, createdAt: { gte: last24h } }
  });

  // Build trader count map
  const traderCountMap = new Map<string, number>();
  for (const { mint } of uniqueTraders) {
    traderCountMap.set(mint, (traderCountMap.get(mint) || 0) + 1);
  }

  // Batch fetch current prices (uses priceService batch method)
  const pricesMap = await priceService.getPrices(mints);

  // Batch fetch metadata (single API call - massive speedup!)
  const metadataResults = await getTokenMetaBatch(mints).catch(err => {
    logger.warn({ err }, "Batch metadata fetch failed");
    return [];
  });

  const metadataMap = new Map();
  metadataResults.forEach(token => {
    if (token?.address) {
      metadataMap.set(token.address, token);
    }
  });

  // Build trending tokens (in-memory, fast)
  const trendingTokens: TrendingToken[] = trendingData.map(data => {
    const meta = metadataMap.get(data.mint);
    const currentPrice = pricesMap[data.mint] || 0;

    return {
      mint: data.mint,
      symbol: meta?.symbol || null,
      name: meta?.name || null,
      logoURI: meta?.logoURI || null,
      priceUsd: currentPrice,
      priceChange24h: 0, // Historical data not available in fallback mode
      volume24h: parseFloat(data._sum.costUsd?.toString() || "0"),
      marketCapUsd: null,
      tradeCount: data._count.id,
      uniqueTraders: traderCountMap.get(data.mint) || 0
    };
  });

  const duration = Date.now() - startTime;
  logger.info({ durationMs: duration, count: trendingTokens.length }, "Internal trending complete");

  return trendingTokens.sort((a, b) => b.volume24h - a.volume24h);
}

export async function getTokenTrendingScore(mint: string): Promise<number> {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [tradeCount, uniqueTraders, volume] = await Promise.all([
    prisma.trade.count({
      where: { mint, createdAt: { gte: last24h } }
    }),
    prisma.trade.groupBy({
      by: ["userId"],
      where: { mint, createdAt: { gte: last24h } }
    }),
    prisma.trade.aggregate({
      where: { mint, createdAt: { gte: last24h } },
      _sum: { costUsd: true }
    })
  ]);

  const volumeUsd = parseFloat(volume._sum.costUsd?.toString() || "0");
  
  // Calculate trending score based on multiple factors
  let score = 0;
  score += tradeCount * 1; // 1 point per trade
  score += uniqueTraders.length * 5; // 5 points per unique trader
  score += Math.log10(volumeUsd + 1) * 10; // Volume bonus (logarithmic)
  
  return Math.round(score);
}