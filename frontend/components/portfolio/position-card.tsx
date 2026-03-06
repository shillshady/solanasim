"use client"

/**
 * Position Card Component - Mobile-optimized portfolio position display
 * Used as alternative to table view on small screens
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import { formatUSD, formatNumber, safePercent } from "@/lib/format"
import { CurrencyValue, PriceDisplay, PnLDisplay } from "@/components/shared/currency-display"
import { cn } from "@/lib/utils"
import type * as Backend from "@/lib/types/backend"
import type { EnhancedPosition } from "./types"

// Extended position with live data for position card
interface LiveEnhancedPosition extends EnhancedPosition {
  livePriceNumber?: number
  liveValue?: number
  livePnL?: number
  livePnLPercent?: number
}

interface PositionCardProps {
  position: LiveEnhancedPosition
}

export function PositionCard({ position }: PositionCardProps) {
  const isProfitable = (position.livePnL || 0) >= 0
  const PnLIcon = isProfitable ? TrendingUp : TrendingDown

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        {/* Token Info */}
        <div className="flex items-center gap-3">
          {position.tokenImage && (
            <img
              src={position.tokenImage}
              alt={position.tokenSymbol || 'Token'}
              className="w-10 h-10 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <div>
            <div className="font-semibold text-base">{position.tokenSymbol}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
              {position.tokenName}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link href={`/trade?token=${position.mint}`}>
          <Button variant="outline" size="sm">
            Trade
          </Button>
        </Link>
      </div>

      {/* Price and Holdings */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
          <PriceDisplay
            priceUSD={position.livePriceNumber || 0}
            showSol={true}
            className="text-sm font-mono"
          />
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Holdings</div>
          <div className="font-mono text-sm font-medium">
            {formatNumber(parseFloat(position.qty), { maxDecimals: 0 })}
          </div>
        </div>
      </div>

      {/* Value and Avg Cost */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Current Value</div>
          <CurrencyValue
            usd={position.liveValue || 0}
            primary="USD"
            showSecondary={true}
            primaryClassName="text-sm font-semibold"
            secondaryClassName="text-xs text-muted-foreground"
          />
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Avg Cost</div>
          <PriceDisplay
            priceUSD={parseFloat(position.avgCostUsd)}
            showSol={true}
            className="text-sm font-mono"
          />
        </div>
      </div>

      {/* P&L */}
      <div className="flex items-center justify-between pt-3 border-t">
        <span className="text-xs text-muted-foreground">Unrealized PnL</span>
        <PnLDisplay
          pnlUSD={position.livePnL || 0}
          costBasisUSD={
            parseFloat(position.costBasisRaw || '0') || (parseFloat(position.avgCostUsd) * parseFloat(position.qty))
          }
          showSol={true}
          className="text-right"
        />
      </div>
    </div>
  )
}
