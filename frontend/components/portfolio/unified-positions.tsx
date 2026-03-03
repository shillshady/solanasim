"use client"

import { memo, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { formatUSD, formatPriceUSD, formatNumber, safePercent, formatTokenQuantity } from "@/lib/format"
import { UsdWithSol } from "@/lib/sol-equivalent"
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet,
  ChevronRight,
  ExternalLink,
  BarChart3,
  MoreVertical,
  ArrowDownToLine
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { useTokenMetadataBatch } from "@/hooks/use-token-metadata"
import { useCallback, useState, useEffect } from "react"
import * as Backend from "@/lib/types/backend"
import { useAuth } from "@/hooks/use-auth"
import { usePortfolio } from "@/hooks/use-portfolio"
import { cn } from "@/lib/utils"
import { ProfitLossValue, PortfolioValue } from "@/components/ui/financial-value"
import { AuthCTA } from "@/components/auth/auth-cta"
import type { EnhancedPosition } from "./types"

// Enhanced position with live price data for display
interface LiveEnhancedPosition extends EnhancedPosition {
  livePriceNumber?: number;
  currentValueUsd?: number;
  liveUnrealizedUsd?: number;
  liveUnrealizedPercent?: number;
}

// Component props
interface UnifiedPositionsProps {
  variant?: 'full' | 'compact'
  maxPositions?: number
  showHeader?: boolean
  showSummary?: boolean
  showViewAllButton?: boolean
  className?: string
}

// PERFORMANCE: Memoized position row to prevent unnecessary re-renders
const PositionRow = memo(function PositionRow({
  position,
  index,
  onNavigate
}: {
  position: LiveEnhancedPosition
  index: number
  onNavigate: (mint: string, symbol?: string, name?: string, action?: string, percent?: number) => void
}) {
  const pnl = position.liveUnrealizedUsd || 0
  const pnlPercent = position.liveUnrealizedPercent || 0

  return (
    <motion.tr
      key={position.mint}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border-b hover:bg-muted/50 transition-colors"
    >
      <td className="p-2">
        <Link
          href={`/trade?token=${position.mint}&symbol=${position.tokenSymbol}&name=${position.tokenName}`}
          className="flex items-center space-x-2 hover:text-primary transition-colors"
        >
          {position.tokenImage ? (
            <img
              src={position.tokenImage}
              alt={position.tokenSymbol || 'Token'}
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {position.tokenSymbol?.slice(0, 2) || '??'}
            </div>
          )}
          <div>
            <p className="font-medium">{position.tokenSymbol}</p>
            <p className="text-xs text-muted-foreground">
              {position.mint.slice(0, 6)}...{position.mint.slice(-4)}
            </p>
          </div>
        </Link>
      </td>
      <td className="text-right p-2">
        {formatAmount(position.qty)}
      </td>
      <td className="text-right p-2">
        <UsdWithSol
          usd={parseFloat(position.avgCostUsd)}
          className="text-sm"
          solClassName="text-xs"
        />
      </td>
      <td className="text-right p-2">
        {position.livePriceNumber ? (
          <UsdWithSol
            usd={position.livePriceNumber}
            className="text-sm"
            solClassName="text-xs"
          />
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="text-right p-2 font-medium">
        <UsdWithSol
          usd={position.currentValueUsd || 0}
          className="font-medium"
          solClassName="text-xs"
        />
      </td>
      <td className={`text-right p-2 font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
        <UsdWithSol
          usd={pnl}
          prefix={pnl >= 0 ? '+' : ''}
          className="font-medium"
          solClassName="text-xs"
        />
      </td>
      <td className="text-right p-2">
        <Badge
          variant={pnlPercent >= 0 ? "default" : "destructive"}
          className={cn(
            "tabular-nums",
            pnlPercent >= 0 ? "bg-profit/10 text-profit border-profit/20" : ""
          )}
        >
          {pnlPercent.toFixed(2)}%
        </Badge>
      </td>
      <td className="text-center p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Quick Sell</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[25, 50, 75, 100].map((percent) => (
              <DropdownMenuItem
                key={percent}
                onClick={() => onNavigate(position.mint, position.tokenSymbol, position.tokenName, 'sell', percent)}
                className="cursor-pointer"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2 text-red-500" />
                Sell {percent}%
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTokenQuantity((parseFloat(position.qty) * percent) / 100)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </motion.tr>
  )
})

// Helper functions
const formatAmount = (amount: string): string => {
  const num = parseFloat(amount)
  return formatTokenQuantity(num) // Use formatTokenQuantity for large token amounts
}

// Using formatPriceUSD and formatUSD from lib/format.ts

export const UnifiedPositions = memo(function UnifiedPositions({
  variant = 'full',
  maxPositions,
  showHeader = true,
  showSummary = true,
  showViewAllButton = false,
  className
}: UnifiedPositionsProps) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Use centralized portfolio hook
  const {
    data: portfolio,
    isLoading,
    error,
    refetch,
    isRefetching
  } = usePortfolio()

  // Real-time price stream integration
  const { connected: wsConnected, prices: livePrices, subscribeMany, unsubscribeMany } = usePriceStreamContext()
  
  // Get SOL price for conversions (SOL mint address)
  const solPrice = livePrices.get('So11111111111111111111111111111111111111112')?.price || 0
  
  // Subscribe to price updates for all positions
  useEffect(() => {
    if (portfolio?.positions && wsConnected) {
      const mints = portfolio.positions.map(p => p.mint)
      subscribeMany(mints)
      
      return () => {
        unsubscribeMany(mints)
      }
    }
  }, [portfolio?.positions, wsConnected, subscribeMany, unsubscribeMany])

  // Get all mints for metadata fetching
  const mints = useMemo(() => 
    portfolio?.positions?.map(p => p.mint) || [], 
    [portfolio?.positions]
  )

  // Fetch token metadata for all positions
  const { data: metadataResults } = useTokenMetadataBatch(mints, mints.length > 0)

  // Create metadata map for quick lookup
  const metadataMap = useMemo(() => {
    const map = new Map()
    metadataResults?.forEach(result => {
      if (result.data) {
        map.set(result.mint, result.data)
      }
    })
    return map
  }, [metadataResults])

  // Enhance positions with live prices and token metadata
  const enhancedPositions: LiveEnhancedPosition[] = useMemo(() => {
    if (!portfolio?.positions) return []

    let positions = portfolio.positions
      .filter(position => {
        // More robust filtering: check if qty exists and is a valid positive number
        const qty = parseFloat(position.qty || '0')
        return !isNaN(qty) && qty > 0
      })
      .map(position => {
        const livePrice = livePrices.get(position.mint)
        const positionQty = parseFloat(position.qty)
        const avgCostUsd = parseFloat(position.avgCostUsd)
        const backendValueUsd = parseFloat(position.valueUsd)
        const metadata = metadataMap.get(position.mint)
        
        // For current price: live price > derived from backend value > avg cost
        const backendCurrentPrice = positionQty > 0 ? backendValueUsd / positionQty : avgCostUsd
        const currentPrice = livePrice?.price || backendCurrentPrice
        
        // For current value: use live calculation if live price available, otherwise use backend value
        const currentValueUsd = livePrice?.price ? positionQty * livePrice.price : backendValueUsd
        
        // Cost basis and PnL calculations
        const costBasisUsd = positionQty * avgCostUsd
        const liveUnrealizedUsd = currentValueUsd - costBasisUsd
        const liveUnrealizedPercent = costBasisUsd > 0 ? (liveUnrealizedUsd / costBasisUsd) * 100 : 0
        
        return {
          ...position,
          // Update with metadata if available
          tokenSymbol: metadata?.symbol || position.tokenSymbol || position.mint.slice(0, 6) + '...',
          tokenName: metadata?.name || position.tokenName || `Token ${position.mint.slice(0, 8)}`,
          tokenImage: metadata?.imageUrl || metadata?.logoURI || position.tokenImage,
          // Live price calculations
          livePriceNumber: currentPrice,
          currentValueUsd,
          liveUnrealizedUsd,
          liveUnrealizedPercent,
        }
      })
      .sort((a, b) => (b.currentValueUsd || 0) - (a.currentValueUsd || 0)) // Sort by current value desc
    
    // Apply limit if specified
    if (maxPositions && maxPositions > 0) {
      positions = positions.slice(0, maxPositions)
    }
    
    return positions
  }, [portfolio?.positions, livePrices, metadataMap, maxPositions])

  // Calculate live totals
  const liveTotals = useMemo(() => {
    if (!portfolio?.totals) return null
    
    const totalCurrentValue = enhancedPositions.reduce((sum, pos) => sum + (pos.currentValueUsd || 0), 0)
    const totalLiveUnrealized = enhancedPositions.reduce((sum, pos) => sum + (pos.liveUnrealizedUsd || 0), 0)
    const totalRealized = parseFloat(portfolio.totals.totalRealizedUsd)
    const totalLivePnL = totalLiveUnrealized + totalRealized
    // PnL% = pnl / costBasis, where costBasis = currentValue - pnl
    const totalCostBasis = totalCurrentValue - totalLivePnL
    const totalLivePnLPercent = totalCostBasis > 0 ? (totalLivePnL / totalCostBasis) * 100 : 0
    
    return {
      totalValueUsd: totalCurrentValue,
      totalUnrealizedUsd: totalLiveUnrealized,
      totalRealizedUsd: totalRealized,
      totalPnlUsd: totalLivePnL,
      totalPnlPercent: totalLivePnLPercent,
      positionCount: enhancedPositions.length,
      allPositionsCount: portfolio.positions?.length || 0
    }
  }, [enhancedPositions, portfolio?.totals])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  // PERFORMANCE: Memoized navigation handler to prevent row re-renders
  const handleNavigate = useCallback((
    mint: string,
    symbol?: string,
    name?: string,
    action?: string,
    percent?: number
  ) => {
    const params = new URLSearchParams({
      token: mint,
      ...(symbol && { symbol }),
      ...(name && { name }),
      ...(action && { action }),
      ...(percent && { percent: percent.toString() })
    })
    router.push(`/trade?${params.toString()}`)
  }, [router])

  // Auth guard
  if (!isAuthenticated) {
    return (
      <AuthCTA
        variant="card"
        message={`Sign in to view your ${variant === 'compact' ? 'holdings' : 'portfolio positions'}`}
        description="Track your token positions, unrealized P&L, and portfolio value in real time."
        icon={<Wallet className="h-6 w-6" />}
        className={className}
      />
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("border border-border", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {variant === 'compact' ? 'Holdings' : 'Portfolio Positions'}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={showHeader ? "pt-0" : undefined}>
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 mx-auto text-muted-foreground animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Loading portfolio...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("border border-border", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {variant === 'compact' ? 'Holdings' : 'Portfolio Positions'}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={showHeader ? "pt-0" : undefined}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Failed to load portfolio: {error instanceof Error ? error.message : 'Unknown error'}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2 h-6"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (enhancedPositions.length === 0) {
    return (
      <Card className={cn("border border-border", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              {variant === 'compact' ? 'Holdings' : 'Portfolio Positions'}
              <Badge variant="outline" className="text-xs">0</Badge>
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={showHeader ? "pt-0" : undefined}>
          <div className="text-center py-6">
            <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No active positions</p>
            <p className="text-xs text-muted-foreground mb-4">
              Start trading to build your portfolio
            </p>
            <Link href="/trade">
              <Button size="sm">Start Trading</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render compact variant (for sidebar)
  if (variant === 'compact') {
    return (
      <Card className={cn("border border-border", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Holdings
              </CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {liveTotals?.positionCount || 0}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={isRefreshing || isRefetching}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={cn("h-3 w-3", (isRefreshing || isRefetching) && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
        )}
        
        <CardContent className={showHeader ? "pt-0" : undefined}>
          <div className="space-y-2">
            {enhancedPositions.map((position, index) => {
              const unrealizedPnL = position.liveUnrealizedUsd || 0
              const isPositive = unrealizedPnL >= 0
              const currentValue = position.currentValueUsd || 0
              
              return (
                <motion.div
                  key={position.mint}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link 
                    href={`/trade?token=${position.mint}&symbol=${position.tokenSymbol}&name=${position.tokenName}`}
                    className="block"
                  >
                    <div className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {position.tokenImage ? (
                            <img 
                              src={position.tokenImage} 
                              alt={position.tokenSymbol || 'Token'} 
                              className="w-6 h-6 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {position.tokenSymbol?.slice(0, 2) || '??'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium truncate">
                                {position.tokenSymbol || 'Unknown'}
                              </span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatAmount(position.qty)} tokens
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <UsdWithSol 
                            usd={currentValue}
                            className="text-sm font-medium"
                            solClassName="text-xs"
                          />
                          <div className={cn(
                            "text-xs font-medium",
                            isPositive ? "text-profit" : "text-loss"
                          )}>
                            <UsdWithSol 
                              usd={unrealizedPnL}
                              prefix={isPositive ? "+" : ""}
                              className="text-xs"
                              solClassName="text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
          
          {showViewAllButton && liveTotals && liveTotals.allPositionsCount > liveTotals.positionCount && (
            <div className="mt-3 pt-3 border-t border-border">
              <Link href="/portfolio">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View All {liveTotals.allPositionsCount} Positions
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Render full variant (for portfolio page)
  return (
    <div className={cn("space-y-6", className)}>
      {/* Portfolio Summary */}
      {showSummary && liveTotals && (
        <Card className="p-6 trading-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Portfolio Overview
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isRefetching}
            >
              {(isRefreshing || isRefetching) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <div className="text-2xl font-bold">
                <UsdWithSol 
                  usd={liveTotals.totalValueUsd}
                  className="text-2xl font-bold"
                  solClassName="text-sm"
                />
              </div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total PnL</p>
              <div className="flex items-center justify-center space-x-1">
                {liveTotals.totalPnlUsd >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <div className={`text-2xl font-bold ${liveTotals.totalPnlUsd >= 0 ? 'text-profit' : 'text-loss'}`}>
                  <UsdWithSol 
                    usd={liveTotals.totalPnlUsd}
                    prefix={liveTotals.totalPnlUsd >= 0 ? '+' : ''}
                    className="text-2xl font-bold"
                    solClassName="text-sm"
                  />
                </div>
              </div>
              <p className={`text-sm ${liveTotals.totalPnlPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                {liveTotals.totalPnlPercent.toFixed(2)}%
              </p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Active Positions</p>
              <p className="text-2xl font-bold">{liveTotals.positionCount}</p>
            </div>
          </div>

          {/* PnL Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-profit/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Realized PnL</p>
              <div className={`text-lg font-semibold ${liveTotals.totalRealizedUsd >= 0 ? 'text-profit' : 'text-loss'}`}>
                <UsdWithSol 
                  usd={liveTotals.totalRealizedUsd}
                  prefix={liveTotals.totalRealizedUsd >= 0 ? '+' : ''}
                  className="text-lg font-semibold"
                  solClassName="text-xs"
                />
              </div>
            </div>
            
            <div className="text-center p-3 bg-muted/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Unrealized PnL</p>
              <div className={`text-lg font-semibold ${liveTotals.totalUnrealizedUsd >= 0 ? 'text-profit' : 'text-loss'}`}>
                <UsdWithSol 
                  usd={liveTotals.totalUnrealizedUsd}
                  prefix={liveTotals.totalUnrealizedUsd >= 0 ? '+' : ''}
                  className="text-lg font-semibold"
                  solClassName="text-xs"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Positions Table */}
      <Card className="p-6 trading-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Active Positions
          </h3>
          {wsConnected && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              Live Prices
            </Badge>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Token</th>
                <th className="text-right p-2">Quantity</th>
                <th className="text-right p-2">Avg Cost</th>
                <th className="text-right p-2">Current Price</th>
                <th className="text-right p-2">Current Value</th>
                <th className="text-right p-2">PnL</th>
                <th className="text-right p-2">PnL %</th>
                <th className="text-center p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enhancedPositions.map((position, index) => (
                <PositionRow
                  key={position.mint}
                  position={position}
                  index={index}
                  onNavigate={handleNavigate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
})