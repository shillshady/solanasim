"use client"

/**
 * Compact Position P&L Component
 *
 * Features:
 * - Smaller, compact display
 * - Coin/star badges for stats
 * - Quick action buttons
 * - Gamified progress indicators
 */

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Package,
  Target,
  Star,
  Coins,
  Zap,
  Trophy
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { usePortfolio } from "@/hooks/use-portfolio"
import { useAuth } from "@/hooks/use-auth"
import { formatUSD, safePercent, formatTokenQuantity } from "@/lib/format"
import { UsdWithSol } from "@/lib/sol-equivalent"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import * as Backend from "@/lib/types/backend"

interface PositionPnLProps {
  tokenAddress: string
  tokenSymbol?: string
  tokenName?: string
}

export function PositionPnL({ tokenAddress, tokenSymbol, tokenName }: PositionPnLProps) {
  const { user } = useAuth()
  const { prices } = usePriceStreamContext()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCoinAnimation, setShowCoinAnimation] = useState(false)

  const {
    data: portfolio,
    isLoading,
    error,
    refetch
  } = usePortfolio()

  // Find the specific token position
  const tokenPosition = portfolio?.positions?.find((position: Backend.PortfolioPosition) =>
    position.mint === tokenAddress && parseFloat(position.qty) > 0
  )

  // Get live price for this token
  const livePrice = prices.get(tokenAddress)

  // Calculate real-time P&L if we have live price
  const calculateRealTimePnL = () => {
    if (!tokenPosition || !livePrice) return null

    const qty = parseFloat(tokenPosition.qty)
    const avgCost = parseFloat(tokenPosition.avgCostUsd)
    const currentValue = qty * livePrice.price
    const costBasis = avgCost * qty
    const unrealizedPnL = currentValue - costBasis

    // Guard against division by zero
    const unrealizedPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0

    return {
      unrealizedPnL,
      unrealizedPercent,
      currentValue,
      costBasis
    }
  }

  const realTimePnL = calculateRealTimePnL()
  const displayPnL = realTimePnL || {
    unrealizedPnL: tokenPosition ? parseFloat(tokenPosition.unrealizedUsd) : 0,
    unrealizedPercent: tokenPosition ? parseFloat(tokenPosition.unrealizedPercent) : 0,
    currentValue: tokenPosition ? parseFloat(tokenPosition.valueUsd) : 0,
    costBasis: tokenPosition ? parseFloat(tokenPosition.avgCostUsd) * parseFloat(tokenPosition.qty) : 0
  }

  // Guard against invalid values
  const safeUnrealizedPnL = isFinite(displayPnL.unrealizedPnL) ? displayPnL.unrealizedPnL : 0
  const safeCostBasis = isFinite(displayPnL.costBasis) ? displayPnL.costBasis : 0
  const safeCurrentValue = isFinite(displayPnL.currentValue) ? displayPnL.currentValue : 0

  const isPositive = safeUnrealizedPnL >= 0
  const hasPosition = !!tokenPosition
  const PnLIcon = isPositive ? TrendingUp : TrendingDown

  // Trigger coin animation when PnL becomes positive
  useEffect(() => {
    if (isPositive && hasPosition && safeUnrealizedPnL > 0) {
      setShowCoinAnimation(true)
      const timer = setTimeout(() => setShowCoinAnimation(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isPositive, hasPosition, safeUnrealizedPnL])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card border border-border p-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-primary/20 rounded-full animate-bounce" />
          <div className="h-4 bg-muted rounded w-32" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card border border-border p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Failed to load position data
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // No position state
  if (!hasPosition) {
    return (
      <div className="bg-card border border-border bg-gradient-to-br from-muted to-muted/50 p-4">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold mb-1">No Position</p>
          <p className="text-xs text-muted-foreground">
            Buy {tokenSymbol || 'tokens'} to start!
          </p>
        </div>
      </div>
    )
  }

  // Calculate percentage for display
  const pnlPercent = safePercent(safeUnrealizedPnL, safeCostBasis)

  return (
    <div className="bg-card border border-border relative overflow-hidden p-4">
      {/* Animated Coin Background */}
      <AnimatePresence>
        {showCoinAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: 0 }}
            animate={{ opacity: 1, scale: 1.5, rotate: 360 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute top-2 right-2 text-4xl z-0"
          >
            <Coins className="h-8 w-8 text-amber-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 border border-border px-2 py-1">
            <Coins className="h-4 w-4 text-foreground" />
          </div>
          <span className="font-mono uppercase tracking-wider text-sm text-foreground">P&L</span>
          {livePrice && (
            <Badge variant="secondary" className="text-xs bg-green-500 text-white border border-border">
              LIVE
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-7 w-7 hover:bg-primary/20"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Main P&L Display - Compact Coin Counter Style */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "p-3 border border-border mb-3 relative overflow-hidden",
          isPositive
            ? "bg-gradient-to-br from-green-500/20 to-green-500/10"
            : "bg-gradient-to-br from-destructive/20 to-destructive/10"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full border border-border flex items-center justify-center",
              isPositive ? "bg-green-500" : "bg-destructive"
            )}>
              <PnLIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unrealized</p>
              <UsdWithSol
                usd={safeUnrealizedPnL}
                className={cn(
                  "text-xl font-bold font-mono uppercase tracking-wider",
                  isPositive ? "text-green-500" : "text-destructive"
                )}
                solClassName="text-xs"
              />
            </div>
          </div>

          <div className={cn(
            "px-3 py-1 rounded-full border border-border font-mono uppercase tracking-wider text-sm",
            isPositive
              ? "bg-green-500 text-white"
              : "bg-destructive text-white"
          )}>
            {pnlPercent}
          </div>
        </div>
      </motion.div>

      {/* Quick Stats - Block Style */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-card border border-border p-2">
          <div className="flex items-center gap-1 mb-1">
            <Star className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-semibold text-foreground">Value</span>
          </div>
          <UsdWithSol usd={safeCurrentValue} className="text-sm font-bold text-foreground" solClassName="text-xs" />
        </div>

        <div className="bg-card border border-border p-2">
          <div className="flex items-center gap-1 mb-1">
            <Target className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-foreground">Cost</span>
          </div>
          <UsdWithSol usd={safeCostBasis} className="text-sm font-bold text-foreground" solClassName="text-xs" />
        </div>
      </div>

      {/* Position Details */}
      {tokenPosition && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-mono font-semibold">
              {formatTokenQuantity(tokenPosition.qty)} {tokenSymbol || 'tokens'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Avg Entry</span>
            <UsdWithSol
              usd={parseFloat(tokenPosition.avgCostUsd)}
              className="font-mono text-xs font-semibold"
              solClassName="text-xs"
            />
          </div>
          {livePrice && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current Price</span>
              <UsdWithSol
                usd={livePrice.price}
                className="font-mono text-xs font-semibold"
                solClassName="text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="font-mono uppercase tracking-wider text-xs">
            {isPositive ? "WINNING!" : "HODL STRONG!"}
          </span>
          <Trophy className="h-3 w-3 text-amber-500" />
        </div>
      </div>
    </div>
  )
}
