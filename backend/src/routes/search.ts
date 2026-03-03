// Search routes for token discovery
import { FastifyInstance } from "fastify";
import { getTokenMeta, getTokenInfo } from "../services/tokenService.js";
import { robustFetch } from "../utils/fetch.js";
import logger from "../utils/logger.js";

const DEX = process.env.DEXSCREENER_BASE || "https://api.dexscreener.com";
const BIRDEYE = process.env.BIRDEYE_BASE || "https://public-api.birdeye.so";

export default async function searchRoutes(app: FastifyInstance) {
  // Get token details by mint address with price data
  app.get("/token/:mint", async (req, reply) => {
    const { mint } = req.params as { mint: string };
    
    if (!mint) {
      return reply.code(400).send({ error: "mint required" });
    }
    
    try {
      const tokenInfo = await getTokenInfo(mint);
      
      if (!tokenInfo) {
        return reply.code(404).send({ error: "Token not found" });
      }
      
      // Build socials array from individual fields and socials JSON
      const socialsArray: string[] = [];
      if (tokenInfo.twitter) socialsArray.push(tokenInfo.twitter);
      if (tokenInfo.telegram) socialsArray.push(tokenInfo.telegram);

      // Parse and merge socials JSON if it exists
      try {
        const parsedSocials = tokenInfo.socials ? JSON.parse(tokenInfo.socials) : [];
        if (Array.isArray(parsedSocials)) {
          socialsArray.push(...parsedSocials.filter((s: string) =>
            s && !socialsArray.includes(s)
          ));
        }
      } catch (e) {
        // Ignore parse errors
      }

      // Build websites array from individual field and websites JSON
      const websitesArray: string[] = [];
      if (tokenInfo.website) websitesArray.push(tokenInfo.website);

      // Parse and merge websites JSON if it exists
      try {
        const parsedWebsites = tokenInfo.websites ? JSON.parse(tokenInfo.websites) : [];
        if (Array.isArray(parsedWebsites)) {
          websitesArray.push(...parsedWebsites.filter((w: string) =>
            w && !websitesArray.includes(w)
          ));
        }
      } catch (e) {
        // Ignore parse errors
      }

      return {
        mint: tokenInfo.address,
        address: tokenInfo.address, // For compatibility
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        logoURI: tokenInfo.logoURI,
        imageUrl: tokenInfo.logoURI, // For compatibility
        website: tokenInfo.website,
        twitter: tokenInfo.twitter,
        telegram: tokenInfo.telegram,
        websites: JSON.stringify(websitesArray),
        socials: JSON.stringify(socialsArray),
        lastPrice: tokenInfo.lastPrice,
        lastTs: tokenInfo.lastTs,
        volume24h: tokenInfo.volume24h,
        priceChange24h: tokenInfo.priceChange24h,
        marketCapUsd: tokenInfo.marketCapUsd,
        liquidityUsd: tokenInfo.liquidityUsd,
        holderCount: tokenInfo.holderCount,
        firstSeenAt: tokenInfo.firstSeenAt,
        isNew: tokenInfo.isNew,
        isTrending: tokenInfo.isTrending,
        lastUpdated: tokenInfo.lastUpdated
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: error.message || "Failed to fetch token details" });
    }
  });

  // Search tokens by symbol/name
  app.get("/tokens", async (req, reply) => {
    const { q, limit = "20" } = req.query as any;
    
    if (!q || q.length < 2) {
      return reply.code(400).send({ error: "Query must be at least 2 characters" });
    }
    
    try {
      const results = await searchTokens(q, parseInt(limit));
      return { query: q, results };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: error.message || "Search failed" });
    }
  });
}

async function searchTokens(query: string, limit: number = 20) {
  const results: any[] = [];

  // Search Dexscreener
  try {
    const res = await robustFetch(`${DEX}/latest/dex/search/?q=${encodeURIComponent(query)}`, {
      timeout: 10000,
      retries: 2,
      retryDelay: 1000
    });
    if (res.ok) {
      const data = await res.json() as any;
      const pairs = data.pairs || [];

      // Parallelize metadata enrichment for better performance
      const enrichedTokens = await Promise.all(
        pairs.slice(0, limit)
          .filter((pair: any) => pair.chainId === "solana" && pair.baseToken)
          .map(async (pair: any) => {
            // Enrich with metadata from multiple sources (Jupiter, Helius, etc.)
            const meta = await getTokenMeta(pair.baseToken.address);

            return {
              mint: pair.baseToken.address,
              symbol: meta?.symbol || pair.baseToken.symbol,
              name: meta?.name || pair.baseToken.name,
              logoURI: meta?.logoURI || pair.info?.imageUrl || null,
              priceUsd: parseFloat(pair.priceUsd || "0"),
              marketCapUsd: pair.marketCap || pair.fdv || null,
              liquidity: pair.liquidity?.usd || null,
              volume24h: pair.volume?.h24 || null,
              priceChange24h: pair.priceChange?.h24 || null,
              source: "dexscreener"
            };
          })
      );

      results.push(...enrichedTokens);
    }
  } catch (error: any) {
    logger.warn({ code: error.code, message: error.message }, "DexScreener search failed");
  }
  
  // Search Birdeye (if API key available)
  if (process.env.BIRDEYE_API_KEY) {
    try {
      const res = await robustFetch(`${BIRDEYE}/defi/search?keyword=${encodeURIComponent(query)}&chain=solana`, {
        headers: { "X-API-KEY": process.env.BIRDEYE_API_KEY },
        timeout: 10000,
        retries: 2,
        retryDelay: 1000
      });

      if (res.ok) {
        const data = await res.json() as any;
        const tokens = data.data || [];

        // Filter out duplicates first, then parallelize metadata enrichment
        const uniqueTokens = tokens.slice(0, limit)
          .filter((token: any) => !results.find(r => r.mint === token.address));

        const enrichedTokens = await Promise.all(
          uniqueTokens.map(async (token: any) => {
            // Enrich with metadata from multiple sources (Jupiter, Helius, etc.)
            const meta = await getTokenMeta(token.address);

            return {
              mint: token.address,
              symbol: meta?.symbol || token.symbol,
              name: meta?.name || token.name,
              logoURI: meta?.logoURI || token.logoURI || null,
              priceUsd: parseFloat(token.price || "0"),
              marketCapUsd: token.marketCap || null,
              liquidity: token.liquidity || null,
              volume24h: token.volume24h || null,
              priceChange24h: token.priceChange24h || null,
              source: "birdeye"
            };
          })
        );

        results.push(...enrichedTokens);
      }
    } catch (error: any) {
      logger.warn({ code: error.code, message: error.message }, "Birdeye search failed");
    }
  }
  
  // Sort by relevance (exact matches first, then by market cap)
  return results
    .sort((a, b) => {
      const aExact = a.symbol?.toLowerCase() === query.toLowerCase() ? 1 : 0;
      const bExact = b.symbol?.toLowerCase() === query.toLowerCase() ? 1 : 0;
      
      if (aExact !== bExact) return bExact - aExact;
      
      const aMcap = a.marketCapUsd || 0;
      const bMcap = b.marketCapUsd || 0;
      return bMcap - aMcap;
    })
    .slice(0, limit);
}
