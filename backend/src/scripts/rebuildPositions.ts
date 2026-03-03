// Script to rebuild Position and PositionLot data from Trade history
// Run this to fix positions created before FIFO implementation
import prisma from "../plugins/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { D } from "../utils/pnl.js";

async function rebuildPositions() {
  console.log("🔧 Starting position data rebuild...\n");

  // Get all users with trades
  const users = await prisma.user.findMany({
    where: {
      trades: {
        some: {}
      }
    },
    select: { id: true, email: true }
  });

  console.log(`Found ${users.length} users with trades\n`);

  let totalPositionsFixed = 0;
  let totalLotsCreated = 0;

  for (const user of users) {
    console.log(`\n📊 Processing user: ${user.email} (${user.id})`);

    // Get all trades for this user, ordered chronologically
    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" }
    });

    console.log(`  Found ${trades.length} trades`);

    // Group trades by mint
    const tradesByMint = new Map<string, typeof trades>();
    for (const trade of trades) {
      if (!tradesByMint.has(trade.mint)) {
        tradesByMint.set(trade.mint, []);
      }
      tradesByMint.get(trade.mint)!.push(trade);
    }

    console.log(`  Processing ${tradesByMint.size} unique tokens`);

    // Process each token
    for (const [mint, tokenTrades] of tradesByMint.entries()) {
      console.log(`\n  🪙 Token: ${mint.slice(0, 8)}...`);
      console.log(`     ${tokenTrades.length} trades to process`);

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

          console.log(`     BUY: ${qty.toFixed(4)} @ $${priceUsd.toFixed(6)} = $${costAdded.toFixed(2)}`);

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
            console.warn(`     ⚠️ SELL: Insufficient quantity! Needed ${qty.toFixed(4)}, short by ${toSell.toFixed(4)}`);
            // Skip this trade as data may be corrupted
            continue;
          }

          currentQty = currentQty.sub(qty);
          currentCostBasis = currentCostBasis.sub(totalConsumedCost);

          // Prevent negative cost basis
          if (currentCostBasis.lt(0)) {
            console.warn(`     ⚠️ Negative cost basis detected, clamping to zero`);
            currentCostBasis = D(0);
          }

          console.log(`     SELL: ${qty.toFixed(4)} @ $${priceUsd.toFixed(6)}, cost basis reduced by $${totalConsumedCost.toFixed(2)}`);
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

      console.log(`     ✅ Final: qty=${currentQty.toFixed(4)}, costBasis=$${currentCostBasis.toFixed(2)}, ${lotsCreated} lots created`);
      totalPositionsFixed++;
      totalLotsCreated += lotsCreated;
    }
  }

  console.log(`\n✅ Rebuild complete!`);
  console.log(`   Positions fixed: ${totalPositionsFixed}`);
  console.log(`   Lots created: ${totalLotsCreated}`);
}

// Run the script
rebuildPositions()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
