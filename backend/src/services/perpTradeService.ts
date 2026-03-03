// Perpetual trading service for opening/closing leveraged positions
import prisma from "../plugins/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import priceService from "../plugins/priceService.js";
import { loggers } from "../utils/logger.js";
const logger = loggers.trade;
import {
  D,
  calculateInitialMargin,
  calculateLiquidationPriceLong,
  calculateLiquidationPriceShort,
  calculateUnrealizedPnL,
  calculateMarginBalance,
  calculateMarginRatio,
  calculatePerpFee,
  isValidLeverage,
  calculateMaxPositionSize,
} from "../utils/margin.js";
import redlock from "../plugins/redlock.js";
import { isTokenWhitelisted } from "../config/perpWhitelist.js";

interface OpenPerpPositionParams {
  userId: string;
  mint: string;
  side: "LONG" | "SHORT";
  leverage: number;
  marginAmount: string; // In SOL
}

interface ClosePerpPositionParams {
  userId: string;
  positionId: string;
}

export async function openPerpPosition(params: OpenPerpPositionParams) {
  const { userId, mint, side, leverage, marginAmount } = params;

  // Validation
  if (!isTokenWhitelisted(mint)) {
    throw new Error("This token is not available for perpetual trading. Only high market cap tokens are supported.");
  }

  if (!isValidLeverage(leverage)) {
    throw new Error("Invalid leverage. Must be 2, 5, 10, or 20");
  }

  const margin = D(marginAmount);
  if (margin.lte(0)) {
    throw new Error("Margin amount must be greater than 0");
  }

  // Acquire lock to prevent concurrent position opens for same token
  const lockKey = `perp:open:${userId}:${mint}`;
  const lock = await redlock.acquire([lockKey], 5000);

  try {
    // Check if user already has an open position for this token
    const existingPosition = await prisma.perpPosition.findFirst({
      where: {
        userId,
        mint,
        status: "OPEN",
      },
    });

    if (existingPosition) {
      throw new Error("You already have an open position for this token. Close it first or increase the position.");
    }

    // Get user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const userBalance = user.virtualSolBalance as Decimal;
    if (userBalance.lt(margin)) {
      throw new Error(`Insufficient balance. Required: ${margin.toFixed(4)} SOL, Available: ${userBalance.toFixed(4)} SOL`);
    }

    // Get current token price
    const tick = await priceService.getLastTick(mint);
    if (!tick || !tick.priceUsd || tick.priceUsd <= 0) {
      throw new Error("Unable to fetch valid token price");
    }

    const entryPrice = D(tick.priceUsd);
    const solPrice = priceService.getSolPrice();
    if (solPrice <= 0) {
      throw new Error("Unable to fetch SOL price");
    }

    // Convert margin from SOL to USD
    const marginUsd = margin.mul(solPrice);

    // Calculate position size
    const positionSize = calculateMaxPositionSize(marginUsd, entryPrice, D(leverage));
    const positionValue = positionSize.mul(entryPrice);

    // Calculate liquidation price
    const liquidationPrice =
      side === "LONG"
        ? calculateLiquidationPriceLong(entryPrice, D(leverage))
        : calculateLiquidationPriceShort(entryPrice, D(leverage));

    // Calculate fees (0.1% of position value)
    const fee = calculatePerpFee(positionValue);
    const feeInSol = fee.div(solPrice);

    // Deduct margin + fees from user balance
    const totalCost = margin.add(feeInSol);
    if (userBalance.lt(totalCost)) {
      throw new Error(`Insufficient balance for margin + fees. Required: ${totalCost.toFixed(4)} SOL`);
    }

    // Create position and trade in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualSolBalance: {
            decrement: totalCost,
          },
        },
      });

      // Calculate initial margin ratio based on leverage
      // For Nx leverage: marginRatio = (1/N) / maintenanceMargin = (1/N) / 0.025 = 40/N
      const initialMarginRatio = D(40).div(leverage);

      // Create position
      const position = await tx.perpPosition.create({
        data: {
          userId,
          mint,
          side,
          leverage: D(leverage),
          entryPrice,
          currentPrice: entryPrice,
          positionSize,
          marginAmount: margin,
          unrealizedPnL: D(0),
          marginRatio: initialMarginRatio, // Correct initial ratio based on leverage
          liquidationPrice,
          status: "OPEN",
        },
      });

      // Create trade record
      const trade = await tx.perpTrade.create({
        data: {
          userId,
          positionId: position.id,
          mint,
          side,
          action: "OPEN",
          leverage: D(leverage),
          quantity: positionSize,
          entryPrice,
          marginUsed: margin,
          fees: feeInSol,
        },
      });

      return { position, trade };
    });

    logger.info({ userId, mint: mint.substring(0, 8), side, leverage, positionSize: positionSize.toString() }, "Opened perp position");

    return {
      success: true,
      position: result.position,
      trade: result.trade,
      message: `Opened ${side} position with ${leverage}x leverage`,
    };
  } finally {
    await lock.release();
  }
}

export async function closePerpPosition(params: ClosePerpPositionParams) {
  const { userId, positionId } = params;

  // Acquire lock
  const lockKey = `perp:close:${positionId}`;
  const lock = await redlock.acquire([lockKey], 5000);

  try {
    // Get position
    const position = await prisma.perpPosition.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new Error("Position not found");
    }

    if (position.userId !== userId) {
      throw new Error("Not authorized to close this position");
    }

    if (position.status !== "OPEN") {
      throw new Error("Position is already closed");
    }

    // Get current price
    const tick = await priceService.getLastTick(position.mint);
    if (!tick || !tick.priceUsd || tick.priceUsd <= 0) {
      throw new Error("Unable to fetch valid token price");
    }

    const exitPrice = D(tick.priceUsd);
    const solPrice = priceService.getSolPrice();

    // Calculate PnL
    const unrealizedPnL = calculateUnrealizedPnL(
      position.side as "LONG" | "SHORT",
      position.entryPrice as Decimal,
      exitPrice,
      position.positionSize as Decimal
    );

    // CRITICAL FIX: Convert margin from SOL to USD before calculating balance
    const marginAmountUsd = (position.marginAmount as Decimal).mul(solPrice);
    const marginBalance = calculateMarginBalance(
      marginAmountUsd,
      unrealizedPnL
    );

    // Calculate fees (0.1% of position value at exit)
    const positionValue = (position.positionSize as Decimal).mul(exitPrice);
    const closeFee = calculatePerpFee(positionValue);
    const closeFeeInSol = closeFee.div(solPrice);

    // Final payout = marginBalance - closeFee
    const finalPayoutUsd = marginBalance.sub(closeFee);
    const finalPayoutSol = finalPayoutUsd.div(solPrice);

    // Close position and create trade record
    const result = await prisma.$transaction(async (tx) => {
      // Update position status
      const updatedPosition = await tx.perpPosition.update({
        where: { id: positionId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          currentPrice: exitPrice,
          unrealizedPnL,
        },
      });

      // Create close trade record
      const trade = await tx.perpTrade.create({
        data: {
          userId,
          positionId: position.id,
          mint: position.mint,
          side: position.side,
          action: "CLOSE",
          leverage: position.leverage,
          quantity: position.positionSize,
          entryPrice: position.entryPrice,
          exitPrice,
          marginUsed: position.marginAmount,
          pnl: unrealizedPnL,
          fees: closeFeeInSol,
        },
      });

      // Return margin + PnL to user (minus fees)
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualSolBalance: {
            increment: finalPayoutSol.gt(0) ? finalPayoutSol : D(0),
          },
        },
      });

      return { position: updatedPosition, trade };
    });

    logger.info({ userId, side: position.side, pnlUsd: unrealizedPnL.toFixed(2) }, "Closed perp position");

    return {
      success: true,
      position: result.position,
      trade: result.trade,
      pnl: unrealizedPnL,
      finalPayout: finalPayoutSol,
      message: `Closed position with ${unrealizedPnL.gte(0) ? "profit" : "loss"}`,
    };
  } finally {
    await lock.release();
  }
}

export async function getUserPerpPositions(userId: string) {
  const positions = await prisma.perpPosition.findMany({
    where: {
      userId,
      status: "OPEN",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (positions.length === 0) {
    return [];
  }

  // OPTIMIZATION: Batch fetch all prices at once
  const uniqueMints = [...new Set(positions.map((p) => p.mint))];
  const prices = await priceService.getPrices(uniqueMints);
  const solPrice = priceService.getSolPrice();

  // Process all positions with batched prices
  const updatedPositions = positions.map((position) => {
    try {
      const currentPriceValue = prices[position.mint];
      if (!currentPriceValue || currentPriceValue <= 0) {
        logger.warn({ mint: position.mint }, "No price available, returning stale position");
        return position;
      }

      const currentPrice = D(currentPriceValue);
      const unrealizedPnL = calculateUnrealizedPnL(
        position.side as "LONG" | "SHORT",
        position.entryPrice as Decimal,
        currentPrice,
        position.positionSize as Decimal
      );

      // Convert marginAmount from SOL to USD before calculating balance
      const marginAmountUsd = (position.marginAmount as Decimal).mul(solPrice);
      const marginBalance = calculateMarginBalance(
        marginAmountUsd,
        unrealizedPnL
      );

      const positionValue = (position.positionSize as Decimal).mul(currentPrice);
      const marginRatio = calculateMarginRatio(
        marginBalance,
        positionValue,
        position.leverage as Decimal
      );

      return {
        ...position,
        currentPrice,
        unrealizedPnL,
        marginRatio,
      };
    } catch (error) {
      logger.error({ positionId: position.id, err: error }, "Failed to update position");
      return position;
    }
  });

  return updatedPositions;
}

export async function getPerpTradeHistory(userId: string, limit: number = 50) {
  const trades = await prisma.perpTrade.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return trades;
}
