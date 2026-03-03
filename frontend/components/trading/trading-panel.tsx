"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Wallet, AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { useToast } from "@/hooks/use-toast"
import { formatNumber, formatTokenQuantity } from "@/lib/format"
import { formatSolEquivalent } from "@/lib/sol-equivalent-utils"
import { UsdWithSol } from "@/lib/sol-equivalent"
import * as api from "@/lib/api"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { ScreenReaderAnnouncements } from "@/components/shared/screen-reader-announcements"
import { useScreenReaderAnnouncements } from "@/hooks/use-screen-reader-announcements"
import { useAuth } from "@/hooks/use-auth"
import { usePortfolio, usePosition } from "@/hooks/use-portfolio"
import { BuyOrderForm } from "./buy-order-form"
import { SellOrderForm } from "./sell-order-form"

type TokenDetails = {
  tokenAddress: string
  tokenSymbol: string | null
  tokenName: string | null
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  volume24h: number
  marketCap: number
  imageUrl: string | null
  lastUpdated: string
}

interface TradingPanelProps {
  tokenAddress?: string
}

function TradingPanelComponent({ tokenAddress: propTokenAddress }: TradingPanelProps = {}) {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const defaultTokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" // BONK
  const tokenAddress = propTokenAddress || searchParams.get("token") || defaultTokenAddress

  const { user, isAuthenticated, getUserId } = useAuth()
  const { connected: wsConnected, prices: livePrices, subscribe, unsubscribe } = usePriceStreamContext()
  const { toast } = useToast()

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioErrorObj,
    refetch: refreshPortfolio
  } = usePortfolio()

  const portfolioError = portfolioErrorObj ? (portfolioErrorObj as Error).message : null

  const {
    announcement,
    urgentAnnouncement,
    announcePriceChange,
    announceTradeComplete,
    announceTradeError,
    announceBalanceUpdate,
  } = useScreenReaderAnnouncements()

  const tokenHolding = usePosition(tokenAddress)
  const solPrice = livePrices.get('So11111111111111111111111111111111111111112')?.price || 208

  // State
  const [userBalance, setUserBalance] = useState<number>(0)
  const [isTrading, setIsTrading] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null)
  const [loadingToken, setLoadingToken] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [customSolAmount, setCustomSolAmount] = useState("")
  const [selectedSolAmount, setSelectedSolAmount] = useState<number | null>(null)
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [lastTradeSuccess, setLastTradeSuccess] = useState(false)
  const [customSellPercentage, setCustomSellPercentage] = useState("")
  const [lastTrade, setLastTrade] = useState<{side: 'buy' | 'sell', amount: number, timestamp: number} | null>(null)

  // Load user balance on auth
  useEffect(() => {
    if (isAuthenticated && user) {
      const loadBalance = async () => {
        try {
          const balanceData = await api.getWalletBalance(user.id)
          setUserBalance(parseFloat(balanceData.balance))
        } catch (err) {
          console.error('Failed to load balance:', err)
        }
      }
      loadBalance()
    }
  }, [isAuthenticated, user])

  // Load last trade from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`lastTrade_${tokenAddress}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setLastTrade(parsed)
        }
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, [tokenAddress])

  // Handle URL params for quick sell
  useEffect(() => {
    const action = searchParams.get('action')
    const percent = searchParams.get('percent')
    if (action === 'sell' && percent) {
      const percentNum = parseInt(percent)
      if (!isNaN(percentNum) && percentNum > 0 && percentNum <= 100) {
        setSelectedPercentage(percentNum)
        setCustomSellPercentage(percentNum.toString())
      }
    }
  }, [searchParams])

  // Load token details
  const loadTokenDetails = useCallback(async (isRefresh = false) => {
    if (!tokenAddress) return
    if (!isRefresh) setLoadingToken(true)
    else setIsRefreshing(true)

    try {
      const token = await api.getTokenDetails(tokenAddress)
      if (token) {
        setTokenDetails({
          tokenAddress: token.address || token.mint || tokenAddress,
          tokenSymbol: token.symbol,
          tokenName: token.name,
          price: parseFloat(token.lastPrice || '0'),
          priceChange24h: parseFloat(token.priceChange24h || '0'),
          priceChangePercent24h: parseFloat(token.priceChange24h || '0'),
          volume24h: parseFloat(token.volume24h || '0'),
          marketCap: parseFloat(token.marketCapUsd || '0'),
          imageUrl: token.imageUrl || token.logoURI || null,
          lastUpdated: token.lastTs || new Date().toISOString()
        })
      } else {
        throw new Error('Token not found')
      }
    } catch (error) {
      import('@/lib/error-logger').then(({ errorLogger }) => {
        errorLogger.error('Failed to load token data', {
          error: error as Error,
          action: 'token_data_load_failed',
          metadata: { tokenAddress: tokenAddress?.substring(0, 8) + '...', component: 'TradingPanel' }
        })
      })
      toast({ title: "Error", description: "Failed to load token information. Please try again.", variant: "destructive" })
    } finally {
      setLoadingToken(false)
      setIsRefreshing(false)
    }
  }, [tokenAddress, toast])

  useEffect(() => { loadTokenDetails() }, [loadTokenDetails])

  // Subscribe to real-time price updates
  useEffect(() => {
    if (!tokenAddress) return
    if (wsConnected) subscribe(tokenAddress)
    return () => { if (wsConnected) unsubscribe(tokenAddress) }
  }, [tokenAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Post-trade handler: refresh state and show toasts
  const handlePostTrade = useCallback(async (
    side: 'buy' | 'sell',
    result: any,
    tokenQuantity: number
  ) => {
    const userId = getUserId()!

    await refreshPortfolio()

    const balanceData = await api.getWalletBalance(userId)
    setUserBalance(parseFloat(balanceData.balance))
    announceBalanceUpdate(parseFloat(balanceData.balance))
    queryClient.invalidateQueries({ queryKey: ['user-balance', userId] })

    const tradedQuantity = formatTokenQuantity(parseFloat(result.trade.quantity))
    const tradedSOL = parseFloat(result.trade.totalCost).toFixed(4)

    toast({
      title: side === 'buy' ? "Trade Executed Successfully!" : "Sell Trade Executed!",
      description: `${side === 'buy' ? 'Bought' : 'Sold'} ${tradedQuantity} tokens for ${tradedSOL} SOL`,
      duration: 5000,
    })

    announceTradeComplete(side, tokenDetails?.tokenSymbol || 'tokens', parseFloat(result.trade.quantity), parseFloat(result.trade.totalCost))

    if (parseFloat(result.rewardPointsEarned) > 0) {
      toast({ title: "Reward Points Earned!", description: `+${formatNumber(parseFloat(result.rewardPointsEarned))} points`, duration: 3000 })
    }

    setLastTradeSuccess(true)
    setTimeout(() => setLastTradeSuccess(false), 3000)

    const tradeInfo = { side, amount: tokenQuantity, timestamp: Date.now() }
    setLastTrade(tradeInfo)
    localStorage.setItem(`lastTrade_${tokenAddress}`, JSON.stringify(tradeInfo))

    // Reset form
    setSelectedSolAmount(null)
    setSelectedPercentage(null)
    setCustomSolAmount("")
    setShowCustomInput(false)
  }, [getUserId, refreshPortfolio, queryClient, toast, announceBalanceUpdate, announceTradeComplete, tokenDetails, tokenAddress])

  // Execute trade (buy or sell)
  const executeTrade = useCallback(async (side: 'buy' | 'sell', tokenQuantity: number) => {
    setIsTrading(true)
    setTradeError(null)
    try {
      const userId = getUserId()
      if (!userId) throw new Error('Not authenticated')

      const result = await api.trade({ userId, mint: tokenAddress, side: side === 'buy' ? 'BUY' : 'SELL', qty: tokenQuantity.toString() })

      if (result.success) {
        await handlePostTrade(side, result, tokenQuantity)
      }
      return result
    } catch (err) {
      const errorMessage = (err as Error).message
      setTradeError(errorMessage)
      announceTradeError(errorMessage)
      toast({ title: "Trade Failed", description: errorMessage, variant: "destructive", duration: 5000 })
      throw err
    } finally {
      setIsTrading(false)
    }
  }, [getUserId, tokenAddress, handlePostTrade, announceTradeError, toast])

  // Handle trade action from forms
  const handleTrade = useCallback(async (action: 'buy' | 'sell') => {
    if (!user || !tokenDetails) {
      toast({ title: "Error", description: "Please ensure you're logged in and token is loaded", variant: "destructive" })
      return
    }

    setTradeError(null)

    const tokenBalance = tokenHolding ? parseFloat(tokenHolding.qty) : 0

    if (action === 'buy') {
      const amountSol = selectedSolAmount || (customSolAmount ? parseFloat(customSolAmount) : 0)
      if (amountSol <= 0) {
        toast({ title: "Invalid Amount", description: "Please select or enter a valid SOL amount", variant: "destructive" })
        return
      }
      if (amountSol > userBalance) {
        toast({ title: "Insufficient Balance", description: "You don't have enough SOL for this trade", variant: "destructive" })
        return
      }
      const amountUsd = amountSol * solPrice
      const tokenQuantity = Math.round((amountUsd / tokenDetails.price) * 1e9) / 1e9
      try { await executeTrade('buy', tokenQuantity) } catch { /* handled in executeTrade */ }
    } else {
      if (!tokenHolding) {
        toast({ title: "No Token Holdings", description: `You don't have any ${tokenDetails?.tokenName || 'tokens'} to sell.`, variant: "destructive" })
        return
      }
      if (!selectedPercentage) {
        toast({ title: "Select Amount", description: "Please select a percentage of your holdings to sell", variant: "destructive" })
        return
      }
      const holdingQuantity = parseFloat(tokenHolding.qty)
      if (isNaN(holdingQuantity) || holdingQuantity <= 0) {
        toast({ title: "Invalid Holdings", description: "Your token balance appears to be invalid. Try refreshing your portfolio.", variant: "destructive" })
        return
      }
      const tokenQuantity = Math.round(((tokenBalance * selectedPercentage) / 100) * 1e9) / 1e9
      try { await executeTrade('sell', tokenQuantity) } catch { /* handled in executeTrade */ }
    }
  }, [user, tokenDetails, tokenHolding, selectedSolAmount, customSolAmount, selectedPercentage, userBalance, solPrice, executeTrade, toast])

  // Loading state
  if (loadingToken) {
    return (
      <div className="p-6 rounded-lg bg-card border border-border/50">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (!tokenDetails) {
    return (
      <div className="p-6 rounded-lg bg-card border border-border/50">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load token information. Please try again.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const livePrice = livePrices.get(tokenAddress)
  const currentPrice = livePrice ? livePrice.price : (tokenDetails.price || 0)
  const balance = userBalance
  const tokenBalance = tokenHolding ? parseFloat(tokenHolding.qty) : 0

  return (
    <div className="p-4 sm:p-6 rounded-lg bg-card border border-border/50">
      <div className="space-y-4 sm:space-y-6">
        {/* Trade Status */}
        {tradeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{tradeError}</AlertDescription>
          </Alert>
        )}

        {lastTradeSuccess && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>Trade executed successfully!</AlertDescription>
          </Alert>
        )}

        {/* Token header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">Trade {tokenDetails.tokenSymbol || 'Token'}</h3>
              {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="font-mono">{balance.toFixed(2)} SOL</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <AnimatedNumber value={currentPrice} prefix="$" decimals={8} className="font-mono text-2xl font-bold text-foreground" colorize={false} glowOnChange={true} />
            {solPrice > 0 && <div className="text-xs text-muted-foreground">{formatSolEquivalent(currentPrice, solPrice)}</div>}
            {(livePrice?.change24h !== undefined || tokenDetails.priceChange24h) && (
              <AnimatedNumber
                value={livePrice?.change24h ?? tokenDetails.priceChange24h}
                suffix="%" prefix={(livePrice?.change24h ?? tokenDetails.priceChange24h) >= 0 ? '+' : ''}
                decimals={2} className="text-sm font-medium" colorize={true} glowOnChange={true}
              />
            )}
          </div>
          {tokenHolding && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Holdings: {formatTokenQuantity(tokenHolding.qty)} {tokenDetails.tokenSymbol}
              </div>
              <div className="text-xs text-muted-foreground">
                Value: <UsdWithSol usd={parseFloat(tokenHolding.qty) * currentPrice} className="inline" compact />
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue={searchParams.get('action') === 'sell' ? 'sell' : 'buy'} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 sm:h-12 gap-1">
            <TabsTrigger value="buy" className="tab-buy font-bold text-base sm:text-sm h-12 sm:h-auto">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="tab-sell font-bold text-base sm:text-sm h-12 sm:h-auto" disabled={!tokenHolding || tokenBalance <= 0}>Sell</TabsTrigger>
          </TabsList>

          {/* Repeat Last Trade */}
          {lastTrade && (
            <div className="mt-3">
              <Button
                variant="outline" size="sm"
                className="w-full border-primary/30 hover:bg-primary/10 text-xs"
                onClick={() => {
                  if (lastTrade.side === 'buy') {
                    const solAmount = lastTrade.amount * solPrice / (tokenDetails?.price || 1)
                    setSelectedSolAmount(solAmount)
                    setCustomSolAmount("")
                  } else if (tokenHolding) {
                    const percentage = (lastTrade.amount / parseFloat(tokenHolding.qty)) * 100
                    setSelectedPercentage(Math.min(100, Math.round(percentage)))
                  }
                }}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Repeat Last {lastTrade.side === 'buy' ? 'Buy' : 'Sell'}
              </Button>
            </div>
          )}

          <TabsContent value="buy">
            <BuyOrderForm
              tokenSymbol={tokenDetails.tokenSymbol}
              currentPrice={currentPrice}
              solPrice={solPrice}
              balance={balance}
              marketCap={tokenDetails.marketCap}
              isTrading={isTrading}
              isRefreshing={isRefreshing}
              selectedSolAmount={selectedSolAmount}
              customSolAmount={customSolAmount}
              showCustomInput={showCustomInput}
              onSelectSolAmount={(amount) => { setSelectedSolAmount(amount); setCustomSolAmount("") }}
              onCustomSolAmountChange={(val) => { setCustomSolAmount(val); setSelectedSolAmount(null) }}
              onToggleCustomInput={() => setShowCustomInput(!showCustomInput)}
              onTrade={() => handleTrade('buy')}
            />
          </TabsContent>

          <TabsContent value="sell">
            <SellOrderForm
              tokenSymbol={tokenDetails.tokenSymbol}
              currentPrice={currentPrice}
              solPrice={solPrice}
              tokenBalance={tokenBalance}
              tokenHolding={tokenHolding}
              isTrading={isTrading}
              isRefreshing={isRefreshing}
              portfolioLoading={portfolioLoading}
              portfolioError={portfolioError}
              selectedPercentage={selectedPercentage}
              customSellPercentage={customSellPercentage}
              onSelectPercentage={(p) => { setSelectedPercentage(p); setCustomSellPercentage("") }}
              onCustomPercentageChange={(val) => {
                setCustomSellPercentage(val)
                if (val && !isNaN(parseFloat(val))) {
                  setSelectedPercentage(Math.min(100, Math.max(0, parseFloat(val))))
                }
              }}
              onRefreshPortfolio={() => refreshPortfolio()}
              onRefreshToken={() => loadTokenDetails(true)}
              onTrade={() => handleTrade('sell')}
            />
          </TabsContent>
        </Tabs>

        <ScreenReaderAnnouncements politeMessage={announcement} urgentMessage={urgentAnnouncement} />
      </div>
    </div>
  )
}

export const TradingPanel = memo(TradingPanelComponent)
