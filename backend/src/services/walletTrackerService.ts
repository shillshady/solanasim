// Wallet tracker service with enhanced swap detection
import prisma from "../plugins/prisma.js";
import { robustFetch } from "../utils/fetch.js";
import { getTokenMetaBatch } from "./tokenService.js";
import priceService from "../plugins/priceService.js";
import { loggers } from "../utils/logger.js";
const logger = loggers.walletTracker;

const HELIUS_API = process.env.HELIUS_API!;

// Base mints that we consider "stables" or "common pairs" (not the main token)
const BASE_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // WSOL
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // WETH (Wormhole)
]);

interface WalletTrade {
  signature: string;
  timestamp: number;
  type: "BUY" | "SELL";
  tokenMint: string;
  tokenAmount: string;   // human-readable string (already decimals-adjusted)
  tokenDecimals: number;
  // Enriched metadata
  tokenSymbol?: string | null;
  tokenName?: string | null;
  tokenLogoURI?: string | null;
  priceUsd?: number | null;
  marketCapUsd?: number | null;
  program?: string;      // Raydium/Orca/Pump/Jupiter route
}

// Add a wallet to follow
export async function followWallet(userId: string, address: string, alias?: string) {
  return prisma.walletTrack.create({
    data: { userId, address, alias }
  });
}

// Remove a tracked wallet
export async function unfollowWallet(userId: string, address: string) {
  return prisma.walletTrack.deleteMany({
    where: { userId, address }
  });
}

// List wallets a user is tracking
export async function listTrackedWallets(userId: string) {
  return prisma.walletTrack.findMany({ where: { userId } });
}

/**
 * Fetch recent buys/sells from a wallet (swap-only)
 * 
 * This version:
 * - Reads events.swap correctly from Helius
 * - Computes BUY/SELL relative to the tracked wallet
 * - Emits token mints/amounts you can later enrich with metadata/prices
 * - Integrates with existing tokenService and priceService
 */
export async function getWalletTrades(address: string, limit = 25): Promise<WalletTrade[]> {
  const params = new URLSearchParams({
    "api-key": HELIUS_API,
    limit: String(limit),
    // Optional: ask Helius for swap-only tx (reduces noise)
    // Uncomment if you want to filter at HTTP level:
    // type: "SWAP",
  });

  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?${params.toString()}`;

  const res = await robustFetch(url, { timeout: 10000, retries: 2, retryDelay: 1000 });
  if (!res.ok) throw new Error("Helius wallet tx fetch failed");
  const txs = await res.json() as any[];

  const swaps: WalletTrade[] = [];

  for (const tx of txs) {
    const swap = tx?.events?.swap;
    if (!swap) continue;

    // Gather per-mint deltas for THIS wallet
    type Delta = { mint: string; decimals: number; amount: bigint };
    const deltas = new Map<string, Delta>();

    const addDelta = (mint: string, decimals: number, amt: bigint) => {
      const prev = deltas.get(mint) ?? { mint, decimals, amount: BigInt(0) };
      deltas.set(mint, { mint, decimals, amount: prev.amount + amt });
    };

    // Token inputs: wallet sends tokens (negative)
    for (const ti of swap.tokenInputs ?? []) {
      if (ti.userAccount === address) {
        const amt = BigInt(ti.rawTokenAmount.tokenAmount); // raw integer
        addDelta(ti.mint, ti.rawTokenAmount.decimals, -amt);
      }
    }

    // Token outputs: wallet receives tokens (positive)
    for (const to of swap.tokenOutputs ?? []) {
      if (to.userAccount === address) {
        const amt = BigInt(to.rawTokenAmount.tokenAmount);
        addDelta(to.mint, to.rawTokenAmount.decimals, amt);
      }
    }

    // Native SOL deltas (rarely needed for token mint choice but good for classification)
    let nativeDeltaLamports = 0n;
    if (swap.nativeInput?.account === address) {
      nativeDeltaLamports -= BigInt(swap.nativeInput.amount);
    }
    if (swap.nativeOutput?.account === address) {
      nativeDeltaLamports += BigInt(swap.nativeOutput.amount);
    }

    // Pick the "actual token" (exclude base mints). If none, fall back to largest abs delta.
    const nonBase = [...deltas.values()].filter(d => !BASE_MINTS.has(d.mint) && d.amount !== 0n);
    const focus = (nonBase.length > 0 ? nonBase : [...deltas.values()])
      .sort((a, b) => {
        const absA = a.amount < 0n ? -a.amount : a.amount;
        const absB = b.amount < 0n ? -b.amount : b.amount;
        return absB > absA ? 1 : -1;
      })[0];

    if (!focus || focus.amount === 0n) continue;

    const isBuy = focus.amount > 0n; // received the non-base token => BUY; sent => SELL
    const abs = focus.amount > 0n ? focus.amount : -focus.amount;

    // Convert to human units
    const denom = BigInt(10) ** BigInt(focus.decimals);
    const whole = (abs / denom).toString();
    const frac = (abs % denom).toString().padStart(focus.decimals, "0").replace(/0+$/, "");
    const human = frac ? `${whole}.${frac}` : whole;

    // Extract program info
    const program = swap?.innerSwaps?.[0]?.programInfo?.source ?? tx?.source ?? undefined;

    swaps.push({
      signature: tx.signature,
      timestamp: tx.timestamp * 1000, // ms for UI
      type: isBuy ? "BUY" : "SELL",
      tokenMint: focus.mint,
      tokenAmount: human,
      tokenDecimals: focus.decimals,
      program,
      // These will be enriched below
      tokenSymbol: undefined,
      tokenName: undefined,
      tokenLogoURI: undefined,
      priceUsd: undefined,
      marketCapUsd: undefined,
    });
  }

  // Now enrich all swaps with metadata and prices
  await enrichWalletTrades(swaps);

  return swaps;
}

/**
 * Enrich wallet trades with token metadata and current prices
 * Uses batch API for massive performance improvement (1 call instead of N calls)
 */
async function enrichWalletTrades(trades: WalletTrade[]): Promise<void> {
  // Get unique mints
  const mints = [...new Set(trades.map(t => t.tokenMint))];

  // Fetch metadata and prices in parallel - using BATCH API for metadata
  const [metadataResults, priceResults] = await Promise.all([
    getTokenMetaBatch(mints).catch(err => {
      logger.warn({ err }, "Batch metadata fetch failed");
      return [];
    }),
    Promise.all(mints.map(mint =>
      priceService.getPrice(mint).catch(err => {
        logger.warn({ mint, err }, "Failed to fetch price");
        return null;
      })
    ))
  ]);

  // Create lookup maps
  const metadataMap = new Map<string, any>();
  const priceMap = new Map<string, number>();

  // Map metadata results by address
  metadataResults.forEach(token => {
    if (token?.address) {
      metadataMap.set(token.address, token);
    }
  });

  // Map price results
  mints.forEach((mint, idx) => {
    if (priceResults[idx]) {
      priceMap.set(mint, priceResults[idx]);
    }
  });

  // Enrich each trade
  for (const trade of trades) {
    const metadata = metadataMap.get(trade.tokenMint);
    const price = priceMap.get(trade.tokenMint);

    if (metadata) {
      trade.tokenSymbol = metadata.symbol;
      trade.tokenName = metadata.name;
      trade.tokenLogoURI = metadata.logoURI;
    }

    if (price !== null && price !== undefined) {
      trade.priceUsd = price;
    }

    // Try to get market cap from priceService tick if available
    try {
      const tick = await priceService.getLastTick(trade.tokenMint);
      if (tick?.marketCapUsd) {
        trade.marketCapUsd = tick.marketCapUsd;
      }
    } catch {
      // Market cap not critical, skip if unavailable
    }
  }
}
