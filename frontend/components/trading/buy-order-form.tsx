"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { TrendingUp, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber, formatTokenQuantity, formatPriceUSD } from "@/lib/format"
import { SolEquiv } from "@/lib/sol-equivalent"
import { formatSolEquivalent } from "@/lib/sol-equivalent-utils"

interface BuyOrderFormProps {
  tokenSymbol: string | null
  currentPrice: number
  solPrice: number
  balance: number
  marketCap: number
  isTrading: boolean
  isRefreshing: boolean
  selectedSolAmount: number | null
  customSolAmount: string
  showCustomInput: boolean
  onSelectSolAmount: (amount: number) => void
  onCustomSolAmountChange: (value: string) => void
  onToggleCustomInput: () => void
  onTrade: () => void
}

const PRESET_SOL_AMOUNTS = [1, 5, 10, 20]
const PRESET_BALANCE_PERCENTAGES = [1, 5, 10, 25]

export function BuyOrderForm({
  tokenSymbol,
  currentPrice,
  solPrice,
  balance,
  marketCap,
  isTrading,
  isRefreshing,
  selectedSolAmount,
  customSolAmount,
  showCustomInput,
  onSelectSolAmount,
  onCustomSolAmountChange,
  onToggleCustomInput,
  onTrade,
}: BuyOrderFormProps) {
  return (
    <div className="space-y-6 mt-4">
      {/* Amount selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-bold">Amount (SOL)</Label>
          <Button
            variant={showCustomInput ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-6 px-2 text-xs transition-colors",
              showCustomInput && "bg-primary text-primary-foreground"
            )}
            onClick={onToggleCustomInput}
          >
            <Settings className="h-3 w-3 mr-1" />
            {showCustomInput ? 'Presets' : 'Custom'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {PRESET_SOL_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              size="lg"
              variant={selectedSolAmount === amount ? "default" : "outline"}
              className={cn(
                "h-14 sm:h-12 font-mono text-lg sm:text-base transition-all relative active:scale-95",
                selectedSolAmount === amount
                  ? "bg-accent text-accent-foreground hover:bg-accent/90 ring-2 ring-accent ring-offset-2"
                  : "bg-card hover:bg-muted",
                amount > balance && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => onSelectSolAmount(amount)}
              disabled={amount > balance}
              aria-label={
                amount > balance
                  ? `${amount} SOL - Insufficient balance, you have ${balance.toFixed(2)} SOL available`
                  : `Select ${amount} SOL to spend${selectedSolAmount === amount ? ', currently selected' : ''}`
              }
              aria-pressed={selectedSolAmount === amount}
              title={amount > balance ? `Insufficient balance (need ${amount} SOL)` : undefined}
            >
              {amount} SOL
              {amount > balance && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full" aria-hidden="true" />
              )}
            </Button>
          ))}
        </div>

        {/* Balance Percentage Presets */}
        <div className="pt-2 border-t border-border/50">
          <Label className="text-xs text-muted-foreground mb-2 block">Or % of balance</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_BALANCE_PERCENTAGES.map((percent) => {
              const solAmount = (balance * percent) / 100
              return (
                <Button
                  key={`balance-${percent}`}
                  size="sm"
                  variant={selectedSolAmount === solAmount ? "default" : "outline"}
                  className={cn(
                    "h-10 text-xs font-semibold transition-all active:scale-95",
                    selectedSolAmount === solAmount
                      ? "bg-accent/80 text-accent-foreground"
                      : "bg-card hover:bg-muted"
                  )}
                  onClick={() => onSelectSolAmount(solAmount)}
                  disabled={solAmount <= 0}
                >
                  {percent}%
                  <span className="block text-xs opacity-70 font-normal">
                    {solAmount.toFixed(1)}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        {showCustomInput && (
          <div className="pt-2">
            <Input
              type="number"
              placeholder="Enter custom amount"
              value={customSolAmount}
              onChange={(e) => onCustomSolAmountChange(e.target.value)}
              className={cn(
                "font-mono transition-colors",
                customSolAmount && parseFloat(customSolAmount) > 0 && parseFloat(customSolAmount) <= balance && "border-green-500 focus:ring-green-500",
                customSolAmount && (parseFloat(customSolAmount) <= 0 || parseFloat(customSolAmount) > balance) && "border-red-500 focus:ring-red-500"
              )}
              max={balance}
              step="0.1"
              aria-label="Custom SOL amount to spend"
              aria-describedby="custom-amount-help"
              aria-invalid={customSolAmount ? (parseFloat(customSolAmount) <= 0 || parseFloat(customSolAmount) > balance) : false}
            />
            <div id="custom-amount-help" className={cn(
              "text-xs mt-1 transition-colors",
              customSolAmount && parseFloat(customSolAmount) > 0 && parseFloat(customSolAmount) <= balance && "text-green-600",
              customSolAmount && (parseFloat(customSolAmount) <= 0 || parseFloat(customSolAmount) > balance) && "text-red-600",
              !customSolAmount && "text-muted-foreground"
            )}>
              {customSolAmount && parseFloat(customSolAmount) > balance
                ? `Insufficient balance. Maximum: ${balance.toFixed(2)} SOL`
                : customSolAmount && parseFloat(customSolAmount) <= 0
                ? "Amount must be greater than 0"
                : customSolAmount && parseFloat(customSolAmount) > 0
                ? `Valid amount: ${parseFloat(customSolAmount).toFixed(2)} SOL`
                : `Enter amount (Max: ${balance.toFixed(2)} SOL)`
              }
            </div>
          </div>
        )}
      </div>

      <Separator className="my-6" />

      {/* Token calculation */}
      <div className="space-y-3">
        <Label htmlFor="token-amount" className="text-sm font-bold">
          You'll receive {tokenSymbol ? `(${tokenSymbol})` : '(tokens)'}
        </Label>
        <Input
          id="token-amount"
          type="text"
          value={
            selectedSolAmount && solPrice && currentPrice
              ? formatTokenQuantity((selectedSolAmount * solPrice) / currentPrice)
              : customSolAmount && solPrice && currentPrice
                ? formatTokenQuantity((Number.parseFloat(customSolAmount) * solPrice) / currentPrice)
                : ""
          }
          readOnly
          className="font-mono bg-muted"
          aria-label={`Tokens you will receive: ${
            selectedSolAmount && solPrice && currentPrice
              ? ((selectedSolAmount * solPrice) / currentPrice).toFixed(0)
              : customSolAmount && solPrice && currentPrice
                ? ((Number.parseFloat(customSolAmount) * solPrice) / currentPrice).toFixed(0)
                : "0"
          } ${tokenSymbol || 'tokens'}`}
        />
      </div>

      <Separator className="my-6" />

      {/* Price info */}
      <div className="rounded-none bg-muted/50 p-4 space-y-3 border border-border" role="region" aria-label="Token pricing information">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Price</span>
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm" aria-label={`Current price: ${formatPriceUSD(currentPrice).replace('$', '')} dollars`}>
              {formatPriceUSD(currentPrice)}
            </span>
            {solPrice > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatSolEquivalent(currentPrice, solPrice)}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Market Cap</span>
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm" aria-label={`Market capitalization: ${marketCap ? formatNumber(marketCap) : 'Not available'}`}>
              {marketCap ? `$${formatNumber(marketCap)}` : 'N/A'}
            </span>
            {marketCap && solPrice > 0 && (
              <SolEquiv usd={marketCap} className="text-xs" />
            )}
          </div>
        </div>
      </div>

      <Button
        className="w-full btn-buy h-16 sm:h-14 text-xl sm:text-lg font-bold active:scale-[0.98] transition-transform"
        size="lg"
        onClick={onTrade}
        disabled={
          isTrading ||
          isRefreshing ||
          (!selectedSolAmount && !customSolAmount) ||
          !tokenSymbol
        }
        aria-label={
          isTrading ? 'Processing buy order' :
          !tokenSymbol ? 'Select a token to trade' :
          (!selectedSolAmount && !customSolAmount) ? 'Enter amount to buy' :
          `Buy ${tokenSymbol} for ${selectedSolAmount || customSolAmount} SOL`
        }
        aria-describedby="buy-button-help"
      >
        <TrendingUp className="mr-2 h-6 w-6 sm:h-5 sm:w-5" aria-hidden="true" />
        {isTrading ? 'Processing...' :
         !tokenSymbol ? 'Select a Token' :
         `Buy ${tokenSymbol}`}
      </Button>
      <div id="buy-button-help" className="sr-only">
        {(!selectedSolAmount && !customSolAmount)
          ? 'Select or enter an amount to enable buying'
          : `This will purchase ${tokenSymbol || 'tokens'} at the current market price`
        }
      </div>
    </div>
  )
}
