/**
 * Standardized Table Cell Components (Production Ready)
 *
 * Consistent cell patterns following the Solana Sim table specification:
 * - Primary line: bold USD value (compact if large)
 * - Secondary line (muted): quantity + symbol
 * - SOL equivalent when space allows
 * - Proper colorization for PnL values
 * - Guards against Infinity%, NaN, and undefined values
 */

import { formatUSD, formatPriceUSD, formatQty, safePercent, formatTokenQuantity } from "@/lib/format";
import { SolEquiv } from "@/lib/sol-equivalent";
import { cn } from "@/lib/utils";

interface MoneyCellProps {
  /** USD value */
  usd: number;
  /** Token quantity (raw amount) */
  qty?: number;
  /** Token symbol */
  symbol?: string;
  /** Mint decimals for quantity scaling */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
  /** Hide SOL equivalent */
  hideSolEquiv?: boolean;
}

/**
 * Money cell showing USD value, quantity + symbol, and SOL equivalent
 * Used for: Bought | Sold | Remaining columns
 */
export function MoneyCell({
  usd,
  qty,
  symbol,
  decimals = 0,
  className,
  hideSolEquiv = false
}: MoneyCellProps) {
  // Guard against invalid values
  const safeUsd = isFinite(usd) ? usd : 0;
  const safeQty = qty !== undefined && isFinite(qty) ? qty : 0;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="font-medium font-mono">{formatUSD(safeUsd)}</span>
      {qty !== undefined && symbol && (
        <span className="text-xs text-muted-foreground font-mono">
          {decimals === 0
            ? formatTokenQuantity(safeQty, symbol)
            : formatQty(safeQty, decimals, symbol)
          }
        </span>
      )}
      {!hideSolEquiv && <SolEquiv usd={safeUsd} />}
    </div>
  );
}

interface PnLCellProps {
  /** PnL amount in USD */
  pnlUSD: number;
  /** Cost basis for percentage calculation */
  costBasisUSD: number;
  /** Additional CSS classes */
  className?: string;
  /** Show SOL equivalent */
  showSolEquiv?: boolean;
}

/**
 * PnL cell showing USD delta and percentage with proper colorization
 * Used for: PnL column
 */
export function PnLCell({
  pnlUSD,
  costBasisUSD,
  className,
  showSolEquiv = false
}: PnLCellProps) {
  // Guard against invalid values
  const safePnl = isFinite(pnlUSD) ? pnlUSD : 0;
  const safeCost = isFinite(costBasisUSD) ? costBasisUSD : 0;

  const percentage = safePercent(safePnl, safeCost);
  const color = safePnl > 0 ? "text-green-400" : safePnl < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className={cn("font-medium font-mono", color)}>{formatUSD(safePnl)}</span>
      <span className={cn("text-xs font-mono", color)}>{percentage}</span>
      {showSolEquiv && <SolEquiv usd={Math.abs(safePnl)} />}
    </div>
  );
}

interface PriceCellProps {
  /** Price in USD */
  priceUSD: number;
  /** Price change in USD */
  priceChangeUSD?: number;
  /** Price change percentage */
  priceChangePercent?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show SOL equivalent */
  showSolEquiv?: boolean;
}

/**
 * Price cell showing current price with optional change indicators
 * Used for: token price displays
 */
export function PriceCell({
  priceUSD,
  priceChangeUSD,
  priceChangePercent,
  className,
  showSolEquiv = true
}: PriceCellProps) {
  // Guard against invalid values
  const safePrice = isFinite(priceUSD) ? priceUSD : 0;
  const hasChange =
    priceChangeUSD !== undefined &&
    priceChangePercent !== undefined &&
    isFinite(priceChangeUSD) &&
    isFinite(priceChangePercent);
  const changeColor = hasChange
    ? priceChangeUSD > 0
      ? "text-green-400"
      : priceChangeUSD < 0
      ? "text-red-400"
      : "text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="font-medium font-mono">{formatPriceUSD(safePrice)}</span>
      {hasChange && (
        <span className={cn("text-xs font-mono", changeColor)}>
          {priceChangeUSD > 0 ? "+" : ""}{formatUSD(priceChangeUSD)} ({priceChangePercent > 0 ? "+" : ""}{priceChangePercent.toFixed(2)}%)
        </span>
      )}
      {showSolEquiv && <SolEquiv usd={safePrice} />}
    </div>
  );
}

interface TokenCellProps {
  /** Token symbol */
  symbol: string;
  /** Token name */
  name?: string;
  /** Token image URL */
  imageUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Token cell showing symbol, name, and optional image
 * Used for: Token column
 */
export function TokenCell({ symbol, name, imageUrl, className }: TokenCellProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={symbol}
          className="w-8 h-8 rounded-full bg-muted flex-shrink-0 object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate">{symbol}</span>
        {name && name !== symbol && (
          <span className="text-xs text-muted-foreground truncate">{name}</span>
        )}
      </div>
    </div>
  );
}

interface QuantityCellProps {
  /** Quantity (raw amount) */
  qty: number;
  /** Token symbol */
  symbol: string;
  /** Mint decimals for scaling */
  decimals: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Quantity cell showing formatted token amount with symbol
 * Used for: quantity-only displays
 */
export function QuantityCell({ qty, symbol, decimals, className }: QuantityCellProps) {
  const safeQty = isFinite(qty) ? qty : 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <span className="font-medium font-mono">{formatQty(safeQty, decimals, symbol)}</span>
    </div>
  );
}

interface PercentageCellProps {
  /** Percentage value */
  percentage: number;
  /** Denominator for safe calculation (optional) */
  denominator?: number;
  /** Additional CSS classes */
  className?: string;
  /** Force color regardless of value */
  forceColor?: "green" | "red" | "neutral";
}

/**
 * Percentage cell with proper colorization and sign handling
 * Used for: change percentages, performance metrics
 */
export function PercentageCell({
  percentage,
  denominator,
  className,
  forceColor
}: PercentageCellProps) {
  const safePercentage = isFinite(percentage) ? percentage : 0;
  const displayValue = denominator !== undefined
    ? safePercent(safePercentage, denominator)
    : safePercent(safePercentage, 100); // Assume it's already a percentage

  const color = forceColor
    ? forceColor === "green" ? "text-green-400" : forceColor === "red" ? "text-red-400" : "text-muted-foreground"
    : safePercentage > 0
      ? "text-green-400"
      : safePercentage < 0
        ? "text-red-400"
        : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-medium font-mono", color)}>{displayValue}</span>
    </div>
  );
}

// Export all formatting functions for direct use
export { formatUSD, formatPriceUSD, formatQty, safePercent } from "@/lib/format";