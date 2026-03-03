// Migration service for data maintenance operations
import prisma from "../plugins/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { D } from "../utils/pnl.js";

interface MigrationResult {
  success: boolean;
  usersProcessed: number;
  positionsFixed: number;
  lotsCreated: number;
  errors: string[];
  details: string[];
}

/**
 * Rebuild Position and PositionLot data from Trade history
 * Fixes positions created before FIFO implementation
 */
export async function rebuildPositions(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    usersProcessed: 0,
    positionsFixed: 0,
    lotsCreated: 0,
    errors: [],
    details: []
  };

  try {
    result.details.push("🔧 Starting position data rebuild...");

    // Get all users with trades
    const users = await prisma.user.findMany({
      where: {
        trades: {
          some: {}
        }
      },
      select: { id: true, email: true }
    });

    result.details.push(`Found ${users.length} users with trades`);

    for (const user of users) {
      try {
        result.details.push(`\n📊 Processing user: ${user.email} (${user.id})`);

        // Get all trades for this user, ordered chronologically
        const trades = await prisma.trade.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" }
        });

        result.details.push(`  Found ${trades.length} trades`);

        // Group trades by mint
        const tradesByMint = new Map<string, typeof trades>();
        for (const trade of trades) {
          if (!tradesByMint.has(trade.mint)) {
            tradesByMint.set(trade.mint, []);
          }
          tradesByMint.get(trade.mint)!.push(trade);
        }

        result.details.push(`  Processing ${tradesByMint.size} unique tokens`);

        // Process each token
        for (const [mint, tokenTrades] of tradesByMint.entries()) {
          result.details.push(`\n  🪙 Token: ${mint.slice(0, 8)}...`);
          result.details.push(`     ${tokenTrades.length} trades to process`);

          // Delete existing position and lots for this token
          await prisma.positionLot.deleteMany({
            where: { userId: user.id, mint }
          });

          await prisma.position.deleteMany({
            where: { userId: user.id, mint }
          });

          // Create new position
          let position = await prisma.position.create({
            data: {
              userId: user.id,
              mint,
              qty: D(0),
              costBasis: D(0)
            }
          });

          // Track lots for FIFO
          interface Lot {
            qtyRemaining: Decimal;
            unitCostUsd: Decimal;
            createdAt: Date;
          }
          const lots: Lot[] = [];

          let currentQty = D(0);
          let currentCostBasis = D(0);

          // Replay all trades
          for (const trade of tokenTrades) {
            const qty = trade.quantity as Decimal;
            const priceUsd = trade.price as Decimal;

            if (trade.side === "BUY") {
              // Add to position
              currentQty = currentQty.add(qty);
              const costAdded = qty.mul(priceUsd);
              currentCostBasis = currentCostBasis.add(costAdded);

              // Create lot
              lots.push({
                qtyRemaining: qty,
                unitCostUsd: priceUsd,
                createdAt: trade.createdAt
              });

              result.details.push(`     BUY: ${qty.toFixed(4)} @ $${priceUsd.toFixed(6)} = $${costAdded.toFixed(2)}`);

            } else if (trade.side === "SELL") {
              // FIFO consume from lots
              let toSell = qty;
              let totalConsumedCost = D(0);

              for (let i = 0; i < lots.length && toSell.gt(0); i++) {
                const lot = lots[i];
                if (lot.qtyRemaining.lte(0)) continue;

                const take = Decimal.min(lot.qtyRemaining, toSell);
                const costConsumed = take.mul(lot.unitCostUsd);

                lot.qtyRemaining = lot.qtyRemaining.sub(take);
                toSell = toSell.sub(take);
                totalConsumedCost = totalConsumedCost.add(costConsumed);
              }

              if (toSell.gt(0)) {
                result.errors.push(`⚠️ SELL: Insufficient quantity for ${mint.slice(0, 8)}! Needed ${qty.toFixed(4)}, short by ${toSell.toFixed(4)}`);
                result.details.push(`     ⚠️ SELL: Insufficient quantity! Needed ${qty.toFixed(4)}, short by ${toSell.toFixed(4)}`);
                // Skip this trade as data may be corrupted
                continue;
              }

              currentQty = currentQty.sub(qty);
              currentCostBasis = currentCostBasis.sub(totalConsumedCost);

              // Prevent negative cost basis
              if (currentCostBasis.lt(0)) {
                result.details.push(`     ⚠️ Negative cost basis detected, clamping to zero`);
                currentCostBasis = D(0);
              }

              result.details.push(`     SELL: ${qty.toFixed(4)} @ $${priceUsd.toFixed(6)}, cost basis reduced by $${totalConsumedCost.toFixed(2)}`);
            }
          }

          // Update final position
          position = await prisma.position.update({
            where: { id: position.id },
            data: {
              qty: currentQty,
              costBasis: currentCostBasis
            }
          });

          // Create PositionLot entries for remaining lots
          let lotsCreated = 0;
          for (const lot of lots) {
            if (lot.qtyRemaining.gt(0)) {
              await prisma.positionLot.create({
                data: {
                  positionId: position.id,
                  userId: user.id,
                  mint,
                  qtyRemaining: lot.qtyRemaining,
                  unitCostUsd: lot.unitCostUsd,
                  createdAt: lot.createdAt
                }
              });
              lotsCreated++;
            }
          }

          result.details.push(`     ✅ Final: qty=${currentQty.toFixed(4)}, costBasis=$${currentCostBasis.toFixed(2)}, ${lotsCreated} lots created`);
          result.positionsFixed++;
          result.lotsCreated += lotsCreated;
        }

        result.usersProcessed++;
      } catch (userError) {
        const errorMsg = `Error processing user ${user.email}: ${userError instanceof Error ? userError.message : String(userError)}`;
        result.errors.push(errorMsg);
        result.details.push(`❌ ${errorMsg}`);
        result.success = false;
      }
    }

    result.details.push(`\n✅ Rebuild complete!`);
    result.details.push(`   Users processed: ${result.usersProcessed}`);
    result.details.push(`   Positions fixed: ${result.positionsFixed}`);
    result.details.push(`   Lots created: ${result.lotsCreated}`);

    if (result.errors.length > 0) {
      result.details.push(`\n⚠️ Errors encountered: ${result.errors.length}`);
    }

  } catch (error) {
    result.success = false;
    const errorMsg = `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    result.details.push(`❌ ${errorMsg}`);
  }

  return result;
}
