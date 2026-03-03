"use client"

/**
 * Token Position P&L Component (Enhanced with Actionable Data)
 *
 * Features:
 * - Real-time P&L calculation with live prices
 * - User's trade history for this specific token
 * - Performance metrics (win rate, best/worst trades)
 * - Entry/exit analysis and profit targets
 * - Quick action buttons for trading
 * - Social links and market context
 * - Animated gradient background based on P&L
 * - Comprehensive data validation
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Package,
  Clock,
  Target,
  Trophy,
  ExternalLink,
  Twitter,
  Globe,
  MessageCircle,
  BarChart3,
  Zap,
  Share2
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { usePortfolio } from "@/hooks/use-portfolio"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import * as Backend from "@/lib/types/backend"
import * as api from "@/lib/api"
import { formatUSD, safePercent, formatTokenQuantity } from "@/lib/format"
import { UsdWithSol } from "@/lib/sol-equivalent"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { SharePnLDialog } from "@/components/modals/share-pnl-dialog"
import { AuthCTA } from "@/components/auth/auth-cta"

interface TokenPositionPnLProps {
  tokenAddress: string
  tokenSymbol?: string
  tokenName?: string
}

/**
 * Animated gradient background based on P&L performance
 */
function AnimatedBackground({ isPositive, hasPosition }: { isPositive: boolean; hasPosition: boolean }) {
  if (!hasPosition) return null
  
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg">
      <motion.div 
        className={cn(
          "absolute inset-0 opacity-10 transition-all duration-1000",
          isPositive 
            ? "bg-gradient-to-br from-green-400 to-green-600" 
            : "bg-gradient-to-br from-red-400 to-red-600"
        )}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

/**
 * Empty state when no position exists
 */
function NoPositionState({ tokenSymbol, tokenName }: { tokenSymbol?: string; tokenName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">No Position</h3>
      <p className="text-sm text-muted-foreground mb-4">
        You don't have an active position in {tokenSymbol || tokenName || 'this token'}.
      </p>
      
      <p className="text-xs text-muted-foreground">
        Buy some tokens to start tracking P&L here.
      </p>
    </div>
  )
}

/**
 * Loading skeleton
 */
function PnLLoadingSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-muted rounded w-32" />
        <div className="h-8 bg-muted rounded w-20" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-6 bg-muted rounded w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Stat row component for displaying metrics
 */
function StatRow({ 
  label, 
  value, 
  showSol = true 
}: { 
  label: string; 
  value: number; 
  showSol?: boolean 
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {showSol ? (
        <UsdWithSol usd={value} className="text-lg font-semibold" />
      ) : (
        <p className="text-lg font-semibold">{formatUSD(value)}</p>
      )}
    </div>
  )
}

export function TokenPositionPnL({ tokenAddress, tokenSymbol, tokenName }: TokenPositionPnLProps) {
  const { user } = useAuth()
  const { prices } = usePriceStreamContext()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const {
    data: portfolio,
    isLoading,
    error,
    refetch
  } = usePortfolio()

  // Fetch user profile for share dialog
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return api.getUserProfile(user.id);
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchOnMount: 'always',
  });

  // Fetch user's trade history for this specific token
  const { data: userTradesData } = useQuery({
    queryKey: ['user-token-trades', user?.id, tokenAddress],
    queryFn: () => api.getUserTrades(user!.id, 100, 0),
    enabled: !!user?.id,
    staleTime: 30000,
  })

  // Filter trades for this specific token and calculate metrics
  const tokenTrades = userTradesData?.trades?.filter(
    (trade) => trade.tokenAddress === tokenAddress
  ) || []

  const tradeMetrics = tokenTrades.length > 0 ? {
    totalTrades: tokenTrades.length,
    buyTrades: tokenTrades.filter(t => t.action === 'BUY').length,
    sellTrades: tokenTrades.filter(t => t.action === 'SELL').length,
    profitableTrades: tokenTrades.filter(t =>
      t.realizedPnL && parseFloat(t.realizedPnL) > 0
    ).length,
    winRate: tokenTrades.filter(t => t.action === 'SELL').length > 0
      ? (tokenTrades.filter(t => t.realizedPnL && parseFloat(t.realizedPnL) > 0).length /
         tokenTrades.filter(t => t.action === 'SELL').length) * 100
      : 0,
    totalRealizedPnL: tokenTrades.reduce((sum, t) =>
      sum + (t.realizedPnL ? parseFloat(t.realizedPnL) : 0), 0
    ),
    avgTradeSize: tokenTrades.reduce((sum, t) =>
      sum + parseFloat(t.totalCost), 0
    ) / tokenTrades.length,
    lastTradeTime: tokenTrades[0]?.timestamp,
  } : null

  // Data validation diagnostic
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && portfolio) {
      if (!portfolio.positions) console.warn('[TokenPositionPnL] Positions array missing from portfolio');
    }
  }, [portfolio])

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
  const pnlColor = isPositive ? "text-green-400" : "text-red-400"

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Guest state — show sign-in CTA
  if (!user) {
    return (
      <AuthCTA
        variant="banner"
        message="Sign in to track your P&L"
        icon={<TrendingUp className="h-5 w-5" />}
      />
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <PnLLoadingSkeleton />
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load position data. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // No position state
  if (!hasPosition) {
    return (
      <Card className="relative overflow-hidden">
        <NoPositionState tokenSymbol={tokenSymbol} tokenName={tokenName} />
      </Card>
    )
  }

  // Calculate percentage for display
  const pnlPercent = safePercent(safeUnrealizedPnL, safeCostBasis)

  return (
    <Card className="relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground isPositive={isPositive} hasPosition={hasPosition} />

      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Position P&L</CardTitle>
            {livePrice && (
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
              className="gap-2 h-8"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Share</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-6">
        {/* Main P&L Display */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "p-4 rounded-lg border-2",
            isPositive 
              ? "bg-green-500/5 border-green-500/20" 
              : "bg-red-500/5 border-red-500/20"
          )}
        >
          <div className="flex items-baseline gap-3">
            <PnLIcon className={cn("h-6 w-6", pnlColor)} />
            <div>
              <p className="text-sm text-muted-foreground mb-1">Unrealized P&L</p>
              <UsdWithSol 
                usd={safeUnrealizedPnL} 
                className={cn("text-3xl font-bold", pnlColor)}
              />
              <p className={cn("text-sm mt-1", pnlColor)}>
                {pnlPercent}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <StatRow label="Current Value" value={safeCurrentValue} />
          <StatRow label="Cost Basis" value={safeCostBasis} />
        </div>

        {/* Position Info */}
        {tokenPosition && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">
                {formatTokenQuantity(tokenPosition.qty)} {tokenSymbol || 'tokens'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg Entry</span>
              <UsdWithSol
                usd={parseFloat(tokenPosition.avgCostUsd)}
                className="font-medium text-sm"
                solClassName="text-xs"
              />
            </div>
            {livePrice && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Price</span>
                <UsdWithSol
                  usd={livePrice.price}
                  className="font-medium text-sm"
                  solClassName="text-xs"
                />
              </div>
            )}
            {tokenPosition.priceChange24h && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">24h Change</span>
                <span className={cn(
                  "font-medium",
                  parseFloat(tokenPosition.priceChange24h) >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {parseFloat(tokenPosition.priceChange24h) >= 0 ? '+' : ''}
                  {parseFloat(tokenPosition.priceChange24h).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics - Your Trading Performance on This Token */}
        {tradeMetrics && hasPosition && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Your Performance</h3>
                <Badge variant="outline" className="text-xs">
                  {tradeMetrics.totalTrades} trades
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "text-lg font-bold",
                      tradeMetrics.winRate >= 50 ? "text-green-500" : "text-yellow-500"
                    )}>
                      {tradeMetrics.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tradeMetrics.profitableTrades}/{tradeMetrics.sellTrades} wins
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Realized P&L</div>
                  <div className={cn(
                    "text-lg font-bold",
                    tradeMetrics.totalRealizedPnL >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {tradeMetrics.totalRealizedPnL >= 0 ? '+' : ''}
                    {tradeMetrics.totalRealizedPnL.toFixed(4)} SOL
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    From {tradeMetrics.sellTrades} sell{tradeMetrics.sellTrades !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {tradeMetrics.lastTradeTime && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Last traded {formatDistanceToNow(new Date(tradeMetrics.lastTradeTime), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Profit Targets - Based on Current Position */}
        {hasPosition && tokenPosition && livePrice && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Profit Targets</h3>
              </div>

              <div className="space-y-2">
                {[
                  { label: '10%', multiplier: 1.1, color: 'text-green-400' },
                  { label: '25%', multiplier: 1.25, color: 'text-green-500' },
                  { label: '50%', multiplier: 1.5, color: 'text-green-600' },
                ].map((target) => {
                  const targetPrice = parseFloat(tokenPosition.avgCostUsd) * target.multiplier
                  const targetValue = parseFloat(tokenPosition.qty) * targetPrice
                  const targetProfit = targetValue - (parseFloat(tokenPosition.qty) * parseFloat(tokenPosition.avgCostUsd))

                  return (
                    <div key={target.label} className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", target.color)}>
                          +{target.label}
                        </Badge>
                        <UsdWithSol
                          usd={targetPrice}
                          className="text-xs font-mono"
                          solClassName="text-xs"
                        />
                      </div>
                      <div className={cn("text-xs font-semibold", target.color)}>
                        +{formatUSD(targetProfit)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Social Links & Market Context */}
        {tokenPosition && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Quick Links</h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {tokenPosition.website && (
                  <a
                    href={tokenPosition.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <Globe className="h-3 w-3" />
                    <span>Website</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                )}
                {tokenPosition.twitter && (
                  <a
                    href={tokenPosition.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <Twitter className="h-3 w-3" />
                    <span>Twitter</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                )}
                {tokenPosition.telegram && (
                  <a
                    href={tokenPosition.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <MessageCircle className="h-3 w-3" />
                    <span>Telegram</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                )}
                <a
                  href={`https://dexscreener.com/solana/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                >
                  <Zap className="h-3 w-3" />
                  <span>DexScreener</span>
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </div>

              {tokenPosition.marketCapUsd && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Market Cap: {formatUSD(parseFloat(tokenPosition.marketCapUsd))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Share Dialog - Token Specific */}
      <SharePnLDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        totalPnL={safeUnrealizedPnL}
        totalPnLPercent={parseFloat(pnlPercent.replace(/[^0-9.-]/g, '')) || 0}
        currentValue={safeCurrentValue}
        initialBalance={safeCostBasis}
        userHandle={(userProfile as any)?.handle || (userProfile as any)?.username || (userProfile as any)?.displayName || undefined}
        userAvatarUrl={
          (userProfile as any)?.avatar ||
          (userProfile as any)?.avatarUrl ||
          (userProfile as any)?.profileImage ||
          undefined
        }
        userEmail={(userProfile as any)?.email || user?.email || undefined}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        isTokenSpecific={true}
      />
    </Card>
  )
}
