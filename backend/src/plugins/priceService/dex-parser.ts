import { loggers } from "../../utils/logger.js";
import type { SwapSignal } from "./types.js";

const logger = loggers.priceService;

/**
 * Detect swap activity from transaction logs.
 * Returns signals indicating a swap occurred and which DEX.
 */
export function detectSwapActivity(logs: string[]): SwapSignal {
  let isSwap = false;
  let dex: string | null = null;
  const involvedTokens: string[] = [];

  for (const log of logs) {
    // Raydium swap detection
    if (log.includes('ray_log:')) {
      isSwap = true;
      dex = 'Raydium';

      const rayLogMatch = log.match(/ray_log:\s*([A-Za-z0-9+/=]+)/);
      if (rayLogMatch) {
        try {
          const rayLogData = Buffer.from(rayLogMatch[1], 'base64');
          // Raydium ray_log structure: [type:u8, amountIn:u64, amountOut:u64, ...]
          if (rayLogData.length >= 17) {
            const amountIn = rayLogData.readBigUInt64LE(1);
            const amountOut = rayLogData.readBigUInt64LE(9);

            logger.debug({
              amountIn: amountIn.toString(),
              amountOut: amountOut.toString()
            }, "Raydium swap amounts");
          }
        } catch (err) {
          logger.debug({ error: err }, "Failed to parse ray_log details");
        }
      }
    }

    // Pump.fun swap detection
    if (log.includes('Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) {
      if (log.includes('invoke') || log.includes('success')) {
        isSwap = true;
        dex = 'Pump.fun';
      }
    }

    // Generic swap indicators (works for Orca, Jupiter, etc.)
    if (log.includes('Instruction: Swap') ||
        log.includes('Instruction: SwapBaseIn') ||
        log.includes('Instruction: SwapBaseOut')) {
      isSwap = true;
      if (!dex) dex = 'Unknown DEX';
    }

    // Extract token mint addresses from logs
    const mintMatch = log.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/g);
    if (mintMatch) {
      mintMatch.forEach(address => {
        if (address.length >= 32 &&
            !address.startsWith('11111') &&
            !address.startsWith('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') &&
            !involvedTokens.includes(address)) {
          involvedTokens.push(address);
        }
      });
    }
  }

  return { isSwap, dex, involvedTokens };
}
