// PnL utility unit tests - no DB or services required
import { describe, it, expect } from "@jest/globals";
import { Decimal } from "@prisma/client/runtime/library";
import { D, vwapBuy, fifoSell } from "../src/utils/pnl";
import { simulateFees } from "../src/utils/decimal-helpers";

describe("vwapBuy", () => {
  it("should calculate VWAP for first buy", () => {
    const result = vwapBuy(D(0), D(0), D(100), D(0.50));
    expect(result.newQty.toString()).toBe("100");
    expect(result.newBasis.toString()).toBe("50"); // 100 * 0.50
  });

  it("should calculate VWAP for subsequent buy at different price", () => {
    // Already hold 100 tokens at $0.50 (basis = $50)
    // Buy 100 more at $1.00
    const result = vwapBuy(D(100), D(50), D(100), D(1.00));
    expect(result.newQty.toString()).toBe("200");
    expect(result.newBasis.toString()).toBe("150"); // 50 + 100
    // Average cost = 150 / 200 = $0.75
    expect(result.newBasis.div(result.newQty).toString()).toBe("0.75");
  });

  it("should include fees in cost basis when fee-adjusted price is passed", () => {
    const qty = D(1000);
    const rawPrice = D(0.001); // $0.001 per token
    const grossSol = qty.mul(D(0.000007)); // token price in SOL
    const fees = simulateFees(grossSol);
    const totalFees = fees.dexFee.plus(fees.l1Fee).plus(fees.tipFee);
    const solUsd = D(140);

    // Fee per token in USD
    const feePerTokenUsd = totalFees.mul(solUsd).div(qty);
    const unitCostWithFees = rawPrice.plus(feePerTokenUsd);

    const result = vwapBuy(D(0), D(0), qty, unitCostWithFees);

    // Cost basis should be higher than raw price * qty
    const rawBasis = qty.mul(rawPrice);
    expect(result.newBasis.gt(rawBasis)).toBe(true);
  });
});

describe("fifoSell", () => {
  it("should consume oldest lot first", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(50), unitCostUsd: D(1.00) },
      { id: "lot2", qtyRemaining: D(50), unitCostUsd: D(2.00) },
    ];

    // Sell 30 at $3.00
    const { realized, consumed } = fifoSell(lots, D(30), D(3.00));

    expect(consumed).toHaveLength(1);
    expect(consumed[0].lotId).toBe("lot1"); // FIFO: oldest first
    expect(consumed[0].qty.toString()).toBe("30");
    // PnL = 30 * (3.00 - 1.00) = 60
    expect(realized.toString()).toBe("60");
  });

  it("should span multiple lots when selling more than first lot", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(20), unitCostUsd: D(1.00) },
      { id: "lot2", qtyRemaining: D(30), unitCostUsd: D(2.00) },
    ];

    // Sell 40 at $3.00
    const { realized, consumed } = fifoSell(lots, D(40), D(3.00));

    expect(consumed).toHaveLength(2);
    expect(consumed[0].lotId).toBe("lot1");
    expect(consumed[0].qty.toString()).toBe("20");
    expect(consumed[1].lotId).toBe("lot2");
    expect(consumed[1].qty.toString()).toBe("20");

    // PnL = 20*(3-1) + 20*(3-2) = 40 + 20 = 60
    expect(realized.toString()).toBe("60");
  });

  it("should throw when selling more than available", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(10), unitCostUsd: D(1.00) },
    ];

    expect(() => fifoSell(lots, D(20), D(3.00))).toThrow("Insufficient quantity");
  });

  it("should calculate negative PnL when selling at a loss", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(100), unitCostUsd: D(5.00) },
    ];

    // Sell 50 at $3.00 (loss of $2 per token)
    const { realized } = fifoSell(lots, D(50), D(3.00));
    // PnL = 50 * (3.00 - 5.00) = -100
    expect(realized.toString()).toBe("-100");
  });

  it("should handle sell-side fees via net sell price", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(100), unitCostUsd: D(1.00) },
    ];

    // Raw sell price $2.00, but with fees deducted: $1.99
    const rawPrice = D(2.00);
    const feePerToken = D(0.01);
    const netSellPrice = rawPrice.minus(feePerToken);

    const { realized } = fifoSell(lots, D(100), netSellPrice);
    // PnL = 100 * (1.99 - 1.00) = 99 (not 100, because fees reduce proceeds)
    expect(realized.toString()).toBe("99");
  });

  it("should handle buy-side fees via fee-inclusive cost basis", () => {
    // Simulates: bought at $1.00 + $0.005 fee per token = $1.005 unit cost
    const lots = [
      { id: "lot1", qtyRemaining: D(100), unitCostUsd: D(1.005) },
    ];

    // Sell at exactly $1.00 (break-even on raw price, but loss due to buy fees)
    const { realized } = fifoSell(lots, D(100), D(1.00));
    // PnL = 100 * (1.00 - 1.005) = -0.5
    expect(realized.toNumber()).toBeCloseTo(-0.5, 4);
  });
});

describe("Fee-inclusive PnL round-trip", () => {
  it("should show loss when buying and selling at same price due to fees", () => {
    const qty = D(1000);
    const tokenPriceUsd = D(0.05);
    const solUsd = D(140);
    const priceSol = tokenPriceUsd.div(solUsd);
    const grossSol = qty.mul(priceSol);

    // Buy side fees
    const buyFees = simulateFees(grossSol);
    const totalBuyFees = buyFees.dexFee.plus(buyFees.l1Fee).plus(buyFees.tipFee);
    const buyFeePerTokenUsd = totalBuyFees.mul(solUsd).div(qty);
    const unitCostWithFees = tokenPriceUsd.plus(buyFeePerTokenUsd);

    // Create lot with fee-inclusive cost
    const lots = [
      { id: "lot1", qtyRemaining: qty, unitCostUsd: unitCostWithFees },
    ];

    // Sell side fees (same gross amount since same price)
    const sellFees = simulateFees(grossSol);
    const totalSellFees = sellFees.dexFee.plus(sellFees.l1Fee).plus(sellFees.tipFee);
    const sellFeePerTokenUsd = totalSellFees.mul(solUsd).div(qty);
    const netSellPrice = tokenPriceUsd.minus(sellFeePerTokenUsd);

    const { realized } = fifoSell(lots, qty, netSellPrice);

    // Should be negative: buy fees + sell fees eaten into the position
    expect(realized.toNumber()).toBeLessThan(0);

    // Total fee impact should equal buy fees + sell fees in USD
    const expectedLoss = totalBuyFees.plus(totalSellFees).mul(solUsd).neg();
    expect(realized.toNumber()).toBeCloseTo(expectedLoss.toNumber(), 4);
  });

  it("should show correct profit when price doubles, accounting for fees", () => {
    const qty = D(500);
    const buyPriceUsd = D(0.10);
    const sellPriceUsd = D(0.20); // Price doubled
    const solUsd = D(140);

    const buyPriceSol = buyPriceUsd.div(solUsd);
    const buyGrossSol = qty.mul(buyPriceSol);
    const buyFees = simulateFees(buyGrossSol);
    const totalBuyFees = buyFees.dexFee.plus(buyFees.l1Fee).plus(buyFees.tipFee);
    const buyFeePerTokenUsd = totalBuyFees.mul(solUsd).div(qty);
    const unitCostWithFees = buyPriceUsd.plus(buyFeePerTokenUsd);

    const lots = [
      { id: "lot1", qtyRemaining: qty, unitCostUsd: unitCostWithFees },
    ];

    const sellPriceSol = sellPriceUsd.div(solUsd);
    const sellGrossSol = qty.mul(sellPriceSol);
    const sellFees = simulateFees(sellGrossSol);
    const totalSellFees = sellFees.dexFee.plus(sellFees.l1Fee).plus(sellFees.tipFee);
    const sellFeePerTokenUsd = totalSellFees.mul(solUsd).div(qty);
    const netSellPrice = sellPriceUsd.minus(sellFeePerTokenUsd);

    const { realized } = fifoSell(lots, qty, netSellPrice);

    // Gross profit = 500 * (0.20 - 0.10) = $50
    // Net profit = $50 - buy fees - sell fees (should be slightly less than $50)
    expect(realized.toNumber()).toBeGreaterThan(0);
    expect(realized.toNumber()).toBeLessThan(50);

    const totalFeesUsd = totalBuyFees.plus(totalSellFees).mul(solUsd);
    const expectedProfit = D(50).minus(totalFeesUsd);
    expect(realized.toNumber()).toBeCloseTo(expectedProfit.toNumber(), 4);
  });
});

describe("FIFO ordering correctness", () => {
  it("should exhaust first lot before touching second", () => {
    const lots = [
      { id: "cheap", qtyRemaining: D(10), unitCostUsd: D(1.00) },
      { id: "expensive", qtyRemaining: D(10), unitCostUsd: D(10.00) },
    ];

    // Sell exactly 10 at $5.00 — should only consume "cheap" lot
    const { consumed } = fifoSell(lots, D(10), D(5.00));
    expect(consumed).toHaveLength(1);
    expect(consumed[0].lotId).toBe("cheap");
    expect(consumed[0].qty.toString()).toBe("10");
    // PnL = 10 * (5 - 1) = 40 (not 10*(5-10) = -50)
    expect(consumed[0].pnl.toString()).toBe("40");
  });

  it("should partially consume a lot and leave remainder", () => {
    const lots = [
      { id: "lot1", qtyRemaining: D(100), unitCostUsd: D(2.00) },
    ];

    const { consumed } = fifoSell(lots, D(30), D(3.00));
    expect(consumed[0].qty.toString()).toBe("30");
    // Original lot should still have 70 remaining (caller is responsible for updating)
    // But the consumed record correctly shows 30 was taken
    expect(consumed[0].pnl.toString()).toBe("30"); // 30 * (3 - 2)
  });
});
