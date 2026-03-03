"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingDown, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatUSD, formatTokenQuantity, formatPriceUSD } from "@/lib/format"
import { formatSolEquivalent } from "@/lib/sol-equivalent-utils"
import type { PortfolioPosition } from "@/lib/types/backend"

interface SellOrderFormProps {
  tokenSymbol: string | null
  currentPrice: number
  solPrice: number
  tokenBalance: number
  tokenHolding: PortfolioPosition | null
  isTrading: boolean
  isRefreshing: boolean
  portfolioLoading: boolean
  portfolioError: string | null
  selectedPercentage: number | null
  customSellPercentage: string
  onSelectPercentage: (percent: number) => void
  onCustomPercentageChange: (value: string) => void
  onRefreshPortfolio: () => void
  onRefreshToken: () => void
  onTrade: () => void
}

const SELL_PERCENTAGES = [25, 50, 75, 100]

export function SellOrderForm({
  tokenSymbol,
  currentPrice,
  solPrice,
  tokenBalance,
  tokenHolding,
  isTrading,
  isRefreshing,
  portfolioLoading,
  portfolioError,
  selectedPercentage,
  customSellPercentage,
  onSelectPercentage,
  onCustomPercentageChange,
  onRefreshPortfolio,
  onRefreshToken,
  onTrade,
}: SellOrderFormProps) {
  if (!tokenHolding || parseFloat(tokenHolding.qty || '0') <= 0) {
    return (
      <div className="space-y-3 mt-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't own any {tokenSymbol || 'tokens'} to sell.
            {portfolioLoading ? " Loading your holdings..." : " Purchase some tokens first to enable selling."}
          </AlertDescription>
        </Alert>

        {portfolioError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading portfolio.
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefreshPortfolio}
                className="ml-2"
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Show current holdings */}
      <div className="bg-muted/20 rounded-lg p-4 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">Your Holdings</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshToken}
            disabled={isRefreshing}
            className="h-6 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="font-mono text-lg font-semibold mb-2">
          {formatTokenQuantity(tokenHolding.qty)} {tokenSymbol || 'tokens'}
        </div>
        <div className={`text-sm ${parseFloat(tokenHolding.unrealizedUsd) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <div>{formatUSD(parseFloat(tokenHolding.unrealizedUsd))}</div>
          {solPrice > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatSolEquivalent(Math.abs(parseFloat(tokenHolding.unrealizedUsd)), solPrice)}
            </div>
          )}
          <div>({parseFloat(tokenHolding.unrealizedPercent).toFixed(2)}%)</div>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-sm font-bold">Amount (% of holdings)</Label>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {SELL_PERCENTAGES.map((percent) => (
            <Button
              key={percent}
              variant={selectedPercentage === percent ? "default" : "outline"}
              className={cn(
                "h-14 sm:h-12 font-mono text-lg sm:text-base transition-all active:scale-95",
                selectedPercentage === percent
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 ring-2 ring-destructive ring-offset-2"
                  : "bg-card hover:bg-muted"
              )}
              onClick={() => onSelectPercentage(percent)}
            >
              {percent === 100 ? "ALL" : `${percent}%`}
            </Button>
          ))}
        </div>

        {/* Custom Percentage Slider */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs text-muted-foreground">Custom Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={customSellPercentage}
                onChange={(e) => onCustomPercentageChange(e.target.value)}
                placeholder="0"
                className={cn(
                  "w-16 h-8 text-xs text-center font-mono transition-colors",
                  customSellPercentage && parseFloat(customSellPercentage) > 0 && parseFloat(customSellPercentage) <= 100 && "border-green-500",
                  customSellPercentage && (parseFloat(customSellPercentage) <= 0 || parseFloat(customSellPercentage) > 100) && "border-red-500"
                )}
                aria-invalid={customSellPercentage ? (parseFloat(customSellPercentage) <= 0 || parseFloat(customSellPercentage) > 100) : false}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <Slider
            value={[selectedPercentage || 0]}
            onValueChange={(value) => {
              onSelectPercentage(value[0])
              onCustomPercentageChange(value[0].toString())
            }}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span className="font-semibold">
              {selectedPercentage || 0}% = {formatTokenQuantity((tokenBalance * (selectedPercentage || 0)) / 100)} tokens
            </span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="sell-amount" className="text-sm font-bold">Selling ({tokenSymbol})</Label>
        <Input
          id="sell-amount"
          type="text"
          value={selectedPercentage ? formatTokenQuantity((tokenBalance * selectedPercentage) / 100) : ""}
          readOnly
          className="font-mono bg-muted"
          aria-label={`Tokens to sell: ${selectedPercentage ? formatTokenQuantity((tokenBalance * selectedPercentage) / 100) : "0"} ${tokenSymbol}`}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="receive-sol" className="text-sm font-bold">You'll receive (SOL)</Label>
        <Input
          id="receive-sol"
          type="text"
          value={selectedPercentage && solPrice > 0 ? (((tokenBalance * selectedPercentage) / 100) * currentPrice / solPrice).toFixed(6) : ""}
          readOnly
          className="font-mono bg-muted"
          aria-label={`SOL you will receive: ${selectedPercentage && solPrice > 0 ? (((tokenBalance * selectedPercentage) / 100) * currentPrice / solPrice).toFixed(6) : "0"} SOL`}
        />
      </div>

      <div className="space-y-3 rounded-lg bg-muted/20 p-4 text-sm border border-border/50" role="region" aria-label="Token selling information">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Price</span>
          <span className="font-mono" aria-label={`Current price: ${formatPriceUSD(currentPrice).replace('$', '')} dollars`}>{formatPriceUSD(currentPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Holdings</span>
          <span className="font-mono" aria-label={`Total holdings: ${formatTokenQuantity(tokenBalance)} ${tokenSymbol}`}>{formatTokenQuantity(tokenBalance)} {tokenSymbol}</span>
        </div>
        {tokenHolding && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg. Cost</span>
            <span className="font-mono" aria-label={`Average cost: ${formatPriceUSD(parseFloat(tokenHolding.avgCostUsd)).replace('$', '')} dollars`}>{formatPriceUSD(parseFloat(tokenHolding.avgCostUsd))}</span>
          </div>
        )}
      </div>

      <Button
        className="w-full btn-sell h-16 sm:h-14 text-xl sm:text-lg font-bold active:scale-[0.98] transition-transform"
        size="lg"
        onClick={onTrade}
        disabled={
          isTrading ||
          isRefreshing ||
          !selectedPercentage ||
          !tokenSymbol
        }
        aria-label={
          isTrading ? 'Processing sell order' :
          !tokenSymbol ? 'Select a token to trade' :
          !selectedPercentage ? 'Select percentage to sell' :
          `Sell ${selectedPercentage}% of ${tokenSymbol} for ${((tokenBalance * selectedPercentage) / 100 * currentPrice).toFixed(6)} SOL`
        }
        aria-describedby="sell-button-help"
      >
        <TrendingDown className="mr-2 h-6 w-6 sm:h-5 sm:w-5" aria-hidden="true" />
        {isTrading ? 'Processing...' :
         !tokenSymbol ? 'Select a Token' :
         `Sell ${tokenSymbol}`}
      </Button>
      <div id="sell-button-help" className="sr-only">
        {!selectedPercentage
          ? 'Select a percentage of your holdings to sell'
          : `This will sell ${selectedPercentage}% of your ${tokenSymbol || 'tokens'} at the current market price`
        }
      </div>
    </div>
  )
}
