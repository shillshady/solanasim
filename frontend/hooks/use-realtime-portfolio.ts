/**
 * Real-time Portfolio Hook
 *
 * Combines portfolio positions with live WebSocket price updates
 * to provide real-time P&L calculations without waiting for API polls.
 *
 * Usage:
 *   const { portfolio, liveP&L } = useRealtimePortfolio()
 */

import { useMemo, useEffect } from 'react'
import { usePortfolio } from './use-portfolio'
import { usePriceStreamContext } from '@/lib/price-stream-provider'

export function useRealtimePortfolio() {
  const { data: portfolio, ...rest } = usePortfolio()
  const { prices: livePrices, subscribe, unsubscribe, connected } = usePriceStreamContext()

  // Subscribe to all token prices in the portfolio
  useEffect(() => {
    if (!portfolio?.positions) return

    const mints = portfolio.positions
      .filter(p => parseFloat(p.qty) > 0)
      .map(p => p.mint)

    if (mints.length === 0) return

    // Subscribe to live prices for all positions
    mints.forEach(mint => subscribe(mint))

    // Cleanup: unsubscribe when component unmounts or positions change
    return () => {
      mints.forEach(mint => unsubscribe(mint))
    }
  }, [portfolio?.positions, subscribe, unsubscribe])

  // Calculate real-time P&L using live WebSocket prices
  const livePortfolio = useMemo(() => {
    if (!portfolio) return null

    // If no live prices available, return original portfolio
    if (livePrices.size === 0) {
      return portfolio
    }

    // Update positions with live prices
    const updatedPositions = portfolio.positions.map(position => {
      const qty = parseFloat(position.qty)
      if (qty === 0) return position

      // Get live price from WebSocket
      const livePrice = livePrices.get(position.mint)

      // If no live price, use the API price
      const currentPrice = livePrice?.price ?? parseFloat(position.currentPrice)

      // Recalculate value and P&L with live price
      const avgCostUsd = parseFloat(position.avgCostUsd)
      const valueUsd = qty * currentPrice
      const costBasis = parseFloat(position.costBasisRaw || '0') || (qty * avgCostUsd)
      const unrealizedUsd = valueUsd - costBasis
      const unrealizedPercent = costBasis > 0 ? (unrealizedUsd / costBasis) * 100 : 0

      return {
        ...position,
        currentPrice: currentPrice.toString(),
        valueUsd: valueUsd.toFixed(2),
        valueSol: (valueUsd / 100).toFixed(4), // Assuming SOL price ~$100
        unrealizedUsd: unrealizedUsd.toFixed(2),
        unrealizedPercent: unrealizedPercent.toFixed(2),
        priceChange24h: livePrice?.change24h?.toString() ?? position.priceChange24h,
      }
    })

    // Recalculate totals
    const totalValueUsd = updatedPositions
      .reduce((sum, p) => sum + parseFloat(p.valueUsd), 0)

    const totalUnrealizedUsd = updatedPositions
      .reduce((sum, p) => sum + parseFloat(p.unrealizedUsd), 0)

    const totalRealizedUsd = parseFloat(portfolio.totals.totalRealizedUsd)
    const totalPnlUsd = totalUnrealizedUsd + totalRealizedUsd

    return {
      ...portfolio,
      positions: updatedPositions,
      totals: {
        ...portfolio.totals,
        totalValueUsd: totalValueUsd.toFixed(2),
        totalUnrealizedUsd: totalUnrealizedUsd.toFixed(2),
        totalPnlUsd: totalPnlUsd.toFixed(2),
      }
    }
  }, [portfolio, livePrices])

  return {
    ...rest,
    data: livePortfolio,
    portfolio: livePortfolio,
    isLiveUpdating: connected && livePrices.size > 0,
  }
}

/**
 * Real-time Portfolio Metrics
 *
 * Similar to usePortfolioMetrics but with live WebSocket prices
 */
export function useRealtimePortfolioMetrics() {
  const { portfolio, isLiveUpdating } = useRealtimePortfolio()

  if (!portfolio) {
    return {
      totalValue: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      totalRealized: 0,
      totalUnrealized: 0,
      positionCount: 0,
      isEmpty: true,
      isLiveUpdating: false,
    }
  }

  const totalValue = parseFloat(portfolio.totals.totalValueUsd)
  const totalPnL = parseFloat(portfolio.totals.totalPnlUsd)
  const totalRealized = parseFloat(portfolio.totals.totalRealizedUsd)
  const totalUnrealized = parseFloat(portfolio.totals.totalUnrealizedUsd)
  const positionCount = portfolio.positions?.filter(p => parseFloat(p.qty) > 0).length || 0

  // Calculate PnL percentage
  const costBasis = totalValue - totalPnL
  const totalPnLPercent = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0

  return {
    totalValue,
    totalPnL,
    totalPnLPercent,
    totalRealized,
    totalUnrealized,
    positionCount,
    isEmpty: positionCount === 0,
    isLiveUpdating,
  }
}
