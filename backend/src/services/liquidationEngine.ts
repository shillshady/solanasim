// Liquidation engine - monitors and liquidates undercollateralized positions
import prisma from "../plugins/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import priceService from "../plugins/priceService.js";
import {
  D,
  calculateUnrealizedPnL,
  calculateMarginBalance,
  shouldLiquidate,
  calculateMarginRatio,
  calculatePerpFee,
} from "../utils/margin.js";
import redlock from "../plugins/redlock.js";
import { loggers } from "../utils/logger.js";
const logger = loggers.liquidation;

// Liquidation engine state
let isRunning = false;
let engineInterval: NodeJS.Timeout | null = null;

// Configuration
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const BATCH_SIZE = 50; // Process 50 positions at a time

export async function startLiquidationEngine() {
  if (isRunning) {
    logger.info("Already running");
    return;
  }

  isRunning = true;
  logger.info("Starting liquidation engine");

  // Run immediately
  await checkAndLiquidatePositions();

  // Then run periodically
  engineInterval = setInterval(async () => {
    try {
      await checkAndLiquidatePositions();
    } catch (error) {
      logger.error({ error }, "Error in periodic check");
    }
  }, CHECK_INTERVAL_MS);

  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Running liquidation engine");
}

export async function stopLiquidationEngine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
  }
  isRunning = false;
  logger.info("Stopped");
}

export async function checkAndLiquidatePositions() {
  try {
    // Get all open positions
    const openPositions = await prisma.perpPosition.findMany({
      where: {
        status: "OPEN",
      },
      take: BATCH_SIZE,
      orderBy: {
        marginRatio: "asc", // Check most at-risk positions first
      },
    });

    if (openPositions.length === 0) {
      return { checked: 0, liquidated: 0 };
    }

    // Only log if there are multiple positions or if we haven't logged recently
    if (openPositions.length > 5) {
      logger.info({ count: openPositions.length }, "Checking positions");
    }

    // Get all unique mints for batch price fetching
    const mints = [...new Set(openPositions.map((p) => p.mint))];
    const prices = await priceService.getPrices(mints);

    let liquidatedCount = 0;

    // Get SOL price for unit conversion
    const solPrice = priceService.getSolPrice();

    // Check each position
    for (const position of openPositions) {
      try {
        const currentPrice = D(prices[position.mint] || 0);
        if (currentPrice.eq(0)) {
          logger.warn({ mint: position.mint.slice(0, 8) }, "No price available, skipping");
          continue;
        }

        // Calculate current unrealized PnL
        const unrealizedPnL = calculateUnrealizedPnL(
          position.side as "LONG" | "SHORT",
          position.entryPrice as Decimal,
          currentPrice,
          position.positionSize as Decimal
        );

        // CRITICAL FIX: Convert marginAmount from SOL to USD before calculating balance
        const marginAmountUsd = (position.marginAmount as Decimal).mul(solPrice);
        const marginBalance = calculateMarginBalance(
          marginAmountUsd,
          unrealizedPnL
        );

        // Calculate position value
        const positionValue = (position.positionSize as Decimal).mul(currentPrice);

        // Check if should liquidate
        if (shouldLiquidate(marginBalance, positionValue)) {
          logger.info(
            { positionId: position.id, userId: position.userId.substring(0, 8), side: position.side, marginBalance: marginBalance.toFixed(2) },
            "Liquidating position"
          );

          await liquidatePosition(position.id, currentPrice);
          liquidatedCount++;
        } else {
          // Update position metrics even if not liquidating
          const marginRatio = calculateMarginRatio(
            marginBalance,
            positionValue,
            position.leverage as Decimal
          );

          await prisma.perpPosition.update({
            where: { id: position.id },
            data: {
              currentPrice,
              unrealizedPnL,
              marginRatio,
            },
          });
        }
      } catch (error) {
        logger.error({ positionId: position.id, error }, "Error checking position");
      }
    }

    if (liquidatedCount > 0) {
      logger.info({ count: liquidatedCount }, "Liquidated positions");
    }

    return {
      checked: openPositions.length,
      liquidated: liquidatedCount,
    };
  } catch (error) {
    logger.error({ error }, "Error in checkAndLiquidatePositions");
    return { checked: 0, liquidated: 0 };
  }
}

async function liquidatePosition(positionId: string, liquidationPrice: Decimal) {
  // Acquire lock to prevent double liquidation
  const lockKey = `perp:liquidate:${positionId}`;
  let lock;

  try {
    lock = await redlock.acquire([lockKey], 5000);
  } catch (error) {
    logger.error({ positionId, error }, "Failed to acquire lock");
    return;
  }

  try {
    // Get position
    const position = await prisma.perpPosition.findUnique({
      where: { id: positionId },
    });

    if (!position || position.status !== "OPEN") {
      logger.info({ positionId }, "Position already closed or not found");
      return;
    }

    const solPrice = priceService.getSolPrice();

    // Calculate final PnL
    const unrealizedPnL = calculateUnrealizedPnL(
      position.side as "LONG" | "SHORT",
      position.entryPrice as Decimal,
      liquidationPrice,
      position.positionSize as Decimal
    );

    // Calculate margin loss (all margin is lost in liquidation)
    const marginLost = position.marginAmount as Decimal;

    // Liquidation fee (taken from remaining margin if any)
    const positionValue = (position.positionSize as Decimal).mul(liquidationPrice);
    const liquidationFee = calculatePerpFee(positionValue, D(0.005)); // 0.5% liquidation fee

    // Execute liquidation in transaction
    await prisma.$transaction(async (tx) => {
      // Update position
      await tx.perpPosition.update({
        where: { id: positionId },
        data: {
          status: "LIQUIDATED",
          closedAt: new Date(),
          currentPrice: liquidationPrice,
          unrealizedPnL,
        },
      });

      // Create liquidation record
      await tx.liquidation.create({
        data: {
          userId: position.userId,
          positionId: position.id,
          mint: position.mint,
          side: position.side,
          liquidationPrice,
          positionSize: position.positionSize,
          marginLost,
        },
      });

      // Create trade record
      await tx.perpTrade.create({
        data: {
          userId: position.userId,
          positionId: position.id,
          mint: position.mint,
          side: position.side,
          action: "LIQUIDATE",
          leverage: position.leverage,
          quantity: position.positionSize,
          entryPrice: position.entryPrice,
          exitPrice: liquidationPrice,
          marginUsed: position.marginAmount,
          pnl: unrealizedPnL,
          fees: liquidationFee.div(solPrice),
        },
      });

      // User loses all margin (no payout)
      // In a real system, any remaining margin after liquidation fee would be returned
      // For simplicity in simulation, all margin is lost
    });

    logger.info(
      { positionId, lossSol: marginLost.toFixed(4), price: liquidationPrice.toFixed(6) },
      "Liquidated position successfully"
    );
  } catch (error) {
    logger.error({ positionId, error }, "Failed to liquidate position");
  } finally {
    await lock.release();
  }
}

// Health check function
export function getLiquidationEngineStatus() {
  return {
    running: isRunning,
    checkInterval: CHECK_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  };
}

// Force check (for testing or manual triggers)
export async function forceCheckPositions() {
  logger.info("Force check triggered");
  return await checkAndLiquidatePositions();
}
