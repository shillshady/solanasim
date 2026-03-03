/**
 * PnL Computation Service - Worker-Safe with Integer-Only Math
 * 
 * Key principles:
 * 1. All quantities stored as integer strings in base units
 * 2. Never JSON-encode BigInt; always use string
 * 3. FIFO lot tracking for realized PnL
 * 4. Single canonical mark price for unrealized PnL
 * 5. Proper fee apportionment across partial fills
 * 
 * Base units:
 * - SOL amounts: lamports (1 SOL = 1,000,000,000 lamports)
 * - Token amounts: mint-scaled units (respecting token decimals)
 * - Prices: lamports per base unit
 */

import { loggers } from "../utils/logger.js";
const logger = loggers.trade;

export type Fill = {
  side: "BUY" | "SELL";
  qtyBaseUnits: string;     // integer string in token's base units
  priceLamports: string;    // integer string - lamports per base unit
  feeLamports: string;      // integer string - total fee in lamports
  ts: number;               // timestamp for FIFO ordering
  solUsdAtFill: string;     // SOL→USD FX rate at fill time
  fillId?: string;          // optional unique identifier
};

export type PnLResult = {
  realizedLamports: string;      // total realized PnL in lamports
  realizedUsd: string;           // total realized PnL in USD (frozen at sell time)
  unrealizedLamports: string;    // unrealized PnL based on mark price
  unrealizedUsd: string;         // unrealized PnL in USD (using current SOL price)
  openQuantity: string;          // remaining open position in base units
  averageCostLamports: string;   // average cost per base unit (0 if no position)
  averageCostUsd: string;        // average cost per base unit in USD (0 if no position)
  totalCostBasis: string;        // total cost basis of open position in lamports
  totalCostBasisUsd: string;     // total cost basis of open position in USD
  openLots: Array<{              // individual lots for debugging
    qty: string;
    costLamports: string;
    costUsd: string;
    avgPrice: string;
    solUsdAtBuy: string;         // SOL→USD rate when lot was created
  }>;
};

/**
 * Compute PnL for a series of fills using FIFO lot tracking with dual currency support
 *
 * @param fills - Array of fills, will be sorted by timestamp
 * @param markPriceLamports - Current market price in lamports per base unit
 * @param currentSolUsd - Current SOL→USD exchange rate for unrealized USD PnL
 * @returns Complete PnL breakdown with integer precision for both SOL and USD
 */
export function computePnL(fills: Fill[], markPriceLamports: string, currentSolUsd: string = "0"): PnLResult {
  // Validate inputs
  if (!markPriceLamports || markPriceLamports === "0") {
    throw new Error("Mark price must be provided and non-zero");
  }

  // Sort fills by timestamp for FIFO processing
  const sortedFills = [...fills].sort((a, b) => a.ts - b.ts);

  // FIFO lot tracking - each lot has quantity and total cost in both SOL and USD
  const openLots: Array<{
    qty: bigint;
    costLamports: bigint;
    costUsd: bigint;
    solUsdAtBuy: bigint;
  }> = [];
  let realizedLamports = 0n;
  let realizedUsd = 0n;

  const currentSolUsdBigInt = BigInt(Math.round(parseFloat(currentSolUsd) * 1_000_000)); // 6 decimal precision for USD

  logger.info({ fillCount: sortedFills.length, markPriceLamports, currentSolUsd }, "Computing PnL");

  for (const fill of sortedFills) {
    try {
      const qty = BigInt(fill.qtyBaseUnits);
      const price = BigInt(fill.priceLamports);
      const fee = BigInt(fill.feeLamports);
      const solUsdAtFill = BigInt(Math.round(parseFloat(fill.solUsdAtFill) * 1_000_000));

      logger.debug({ side: fill.side, qty: qty.toString(), price: price.toString(), fee: fee.toString(), solUsdAtFill: solUsdAtFill.toString() }, "Processing fill");

      if (fill.side === "BUY") {
        // Add new lot: cost = quantity × price + allocated fee
        const totalCostLamports = qty * price + fee;
        const totalCostUsd = (totalCostLamports * solUsdAtFill) / 1_000_000_000n; // Convert lamports to SOL then to USD

        openLots.push({
          qty,
          costLamports: totalCostLamports,
          costUsd: totalCostUsd,
          solUsdAtBuy: solUsdAtFill
        });

        logger.debug({ qty: qty.toString(), costLamports: totalCostLamports.toString(), costUsd: totalCostUsd.toString() }, "Added lot");

      } else { // SELL
        let remainingToSell = qty;
        let totalSellFee = fee;

        while (remainingToSell > 0n && openLots.length > 0) {
          const lot = openLots[0];

          // Determine how much to take from this lot
          const takeFromLot = remainingToSell < lot.qty ? remainingToSell : lot.qty;

          // Calculate proportional cost basis for this portion (in lamports)
          const proportionalCostLamports = lot.costLamports * takeFromLot / lot.qty;

          // Calculate proportional cost basis in USD (frozen at buy time)
          const proportionalCostUsd = lot.costUsd * takeFromLot / lot.qty;

          // Calculate proceeds from this portion
          const grossProceeds = takeFromLot * price;

          // Apportion sell fee proportionally
          const proportionalFee = totalSellFee * takeFromLot / qty;
          const netProceeds = grossProceeds - proportionalFee;

          // Convert net proceeds to USD using sell-time FX rate
          const netProceedsUsd = (netProceeds * solUsdAtFill) / 1_000_000_000n;

          // Realized PnL in lamports = net proceeds - cost basis
          const realizedForThisPortionLamports = netProceeds - proportionalCostLamports;

          // Realized PnL in USD = net proceeds (in USD) - cost basis (in USD, frozen at buy)
          const realizedForThisPortionUsd = netProceedsUsd - proportionalCostUsd;

          realizedLamports += realizedForThisPortionLamports;
          realizedUsd += realizedForThisPortionUsd;

          logger.debug({
            closedUnits: takeFromLot.toString(),
            costBasisLamports: proportionalCostLamports.toString(),
            costBasisUsd: proportionalCostUsd.toString(),
            netProceedsLamports: netProceeds.toString(),
            netProceedsUsd: netProceedsUsd.toString(),
            realizedPnlLamports: realizedForThisPortionLamports.toString(),
            realizedPnlUsd: realizedForThisPortionUsd.toString(),
          }, "Closed portion");

          // Update lot
          lot.qty -= takeFromLot;
          lot.costLamports -= proportionalCostLamports;
          lot.costUsd -= proportionalCostUsd;

          // Remove lot if fully consumed
          if (lot.qty === 0n) {
            openLots.shift();
            logger.debug("Lot fully closed");
          }

          remainingToSell -= takeFromLot;
        }

        // If we still have quantity to sell but no lots, that's a short position
        // For now, we'll treat this as an error, but could support shorts later
        if (remainingToSell > 0n) {
          logger.warn({ remainingToSell: remainingToSell.toString() }, "Attempted to sell more than position allows");
          // Could throw error or handle as short position
        }
      }

    } catch (error) {
      logger.error({ fill, err: error }, "Error processing fill");
      throw new Error(`Failed to process fill: ${error}`);
    }
  }

  // Calculate unrealized PnL from remaining open lots
  const markPrice = BigInt(markPriceLamports);
  let unrealizedLamports = 0n;
  let unrealizedUsd = 0n;
  let totalOpenQty = 0n;
  let totalCostBasis = 0n;
  let totalCostBasisUsd = 0n;

  for (const lot of openLots) {
    const markValueLamports = lot.qty * markPrice;

    // Unrealized PnL in lamports = mark value - cost basis
    const unrealizedForLotLamports = markValueLamports - lot.costLamports;

    // Unrealized PnL in USD = (mark value in SOL * current SOL/USD rate) - cost basis in USD
    const markValueSol = markValueLamports / 1_000_000_000n; // Convert lamports to SOL
    const markValueUsd = (markValueSol * currentSolUsdBigInt) / 1_000_000n; // Convert SOL to USD
    const unrealizedForLotUsd = markValueUsd - lot.costUsd;

    unrealizedLamports += unrealizedForLotLamports;
    unrealizedUsd += unrealizedForLotUsd;
    totalOpenQty += lot.qty;
    totalCostBasis += lot.costLamports;
    totalCostBasisUsd += lot.costUsd;

    logger.debug({
      qty: lot.qty.toString(),
      costLamports: lot.costLamports.toString(),
      costUsd: lot.costUsd.toString(),
      markValueLamports: markValueLamports.toString(),
      markValueUsd: markValueUsd.toString(),
      unrealizedLamports: unrealizedForLotLamports.toString(),
      unrealizedUsd: unrealizedForLotUsd.toString(),
    }, "Open lot");
  }

  // Calculate average cost per unit (avoid division by zero)
  const averageCostLamports = totalOpenQty > 0n ? totalCostBasis / totalOpenQty : 0n;
  const averageCostUsd = totalOpenQty > 0n ? totalCostBasisUsd / totalOpenQty : 0n;

  logger.info({
    realizedLamports: realizedLamports.toString(),
    realizedUsd: realizedUsd.toString(),
    unrealizedLamports: unrealizedLamports.toString(),
    unrealizedUsd: unrealizedUsd.toString(),
    openQuantity: totalOpenQty.toString(),
    averageCostLamports: averageCostLamports.toString(),
    averageCostUsd: averageCostUsd.toString(),
  }, "PnL computation complete");

  return {
    realizedLamports: realizedLamports.toString(),
    realizedUsd: realizedUsd.toString(),
    unrealizedLamports: unrealizedLamports.toString(),
    unrealizedUsd: unrealizedUsd.toString(),
    openQuantity: totalOpenQty.toString(),
    averageCostLamports: averageCostLamports.toString(),
    averageCostUsd: averageCostUsd.toString(),
    totalCostBasis: totalCostBasis.toString(),
    totalCostBasisUsd: totalCostBasisUsd.toString(),
    openLots: openLots.map(lot => ({
      qty: lot.qty.toString(),
      costLamports: lot.costLamports.toString(),
      costUsd: lot.costUsd.toString(),
      avgPrice: lot.qty > 0n ? (lot.costLamports / lot.qty).toString() : "0",
      solUsdAtBuy: lot.solUsdAtBuy.toString()
    }))
  };
}

/**
 * Helper to convert display amounts to base units
 * For SOL: display amount × 1e9 = lamports
 * For tokens: display amount × 10^decimals = base units
 */
export function toBaseUnits(displayAmount: number, decimals: number): string {
  const multiplier = 10n ** BigInt(decimals);
  const baseUnits = BigInt(Math.round(displayAmount * Number(multiplier)));
  return baseUnits.toString();
}

/**
 * Helper to convert base units to display amounts
 * For SOL: lamports ÷ 1e9 = display amount
 * For tokens: base units ÷ 10^decimals = display amount
 */
export function fromBaseUnits(baseUnits: string, decimals: number): number {
  const units = BigInt(baseUnits);
  const divisor = 10n ** BigInt(decimals);
  return Number(units) / Number(divisor);
}

/**
 * Helper to create a fill record with proper integer conversion
 */
export function createFill(
  side: "BUY" | "SELL",
  displayQty: number,
  displayPrice: number, // in SOL per token
  feeInSol: number,
  tokenDecimals: number,
  solUsdAtFill: number, // SOL→USD FX rate at fill time
  timestamp: number = Date.now(),
  fillId?: string
): Fill {
  // Convert quantities to base units
  const qtyBaseUnits = toBaseUnits(displayQty, tokenDecimals);
  const priceLamports = toBaseUnits(displayPrice, 9); // SOL has 9 decimals
  const feeLamports = toBaseUnits(feeInSol, 9);
  const solUsdAtFillStr = solUsdAtFill.toFixed(6); // 6 decimal precision for USD rates

  return {
    side,
    qtyBaseUnits,
    priceLamports,
    feeLamports,
    solUsdAtFill: solUsdAtFillStr,
    ts: timestamp,
    fillId
  };
}

/**
 * Validate PnL computation input
 */
export function validateFills(fills: Fill[]): void {
  for (const fill of fills) {
    if (!fill.qtyBaseUnits || !fill.priceLamports || !fill.feeLamports || !fill.solUsdAtFill) {
      throw new Error(`Invalid fill: missing required fields`);
    }

    try {
      BigInt(fill.qtyBaseUnits);
      BigInt(fill.priceLamports);
      BigInt(fill.feeLamports);
      parseFloat(fill.solUsdAtFill);
    } catch {
      throw new Error(`Invalid fill: invalid values detected`);
    }

    if (!["BUY", "SELL"].includes(fill.side)) {
      throw new Error(`Invalid fill side: ${fill.side}`);
    }

    if (parseFloat(fill.solUsdAtFill) <= 0) {
      throw new Error(`Invalid fill: solUsdAtFill must be positive`);
    }
  }
}