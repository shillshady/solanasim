import { z } from "zod";

/** All monetary amounts are strings of integers in base units (lamports) */
export const PriceTickV1 = z.object({
  v: z.literal(1),
  seq: z.number().int().nonnegative(),
  mint: z.string(),           // token mint
  priceLamports: z.string(),  // integer string
  ts: z.number().int().positive()
});

export const BalanceUpdateV1 = z.object({
  v: z.literal(1),
  wallet: z.string(),
  mint: z.string(),
  balanceLamports: z.string(),
  ts: z.number().int().positive()
});

export const TradeFillV1 = z.object({
  v: z.literal(1),
  fillId: z.string(),
  wallet: z.string(),
  mint: z.string(),
  side: z.enum(["BUY", "SELL"]),
  qtyBaseUnits: z.string(),     // integer string of token units (respect mint decimals)
  priceLamports: z.string(),    // integer string price in lamports of SOL
  feeLamports: z.string(),      // integer string
  ts: z.number().int().positive()
});

export const WSFrame = z.object({
  t: z.literal("price"),
  d: PriceTickV1
});

export type PriceTick = z.infer<typeof PriceTickV1>;
export type BalanceUpdate = z.infer<typeof BalanceUpdateV1>;
export type TradeFill = z.infer<typeof TradeFillV1>;
export type WSFrameType = z.infer<typeof WSFrame>;
