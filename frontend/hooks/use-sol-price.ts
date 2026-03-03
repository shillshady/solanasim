/**
 * useSolPrice Hook
 *
 * Optimized hook that only re-renders when SOL price changes,
 * preventing cascading re-renders from the full price stream.
 *
 * Use this in components that only need SOL price (like NavBar, headers)
 * instead of subscribing to the entire price stream.
 */

import { useMemo, useRef, useEffect, useState } from 'react'
import { usePriceStreamContext } from '@/lib/price-stream-provider'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

interface SolPriceData {
  price: number
  change24h: number
  timestamp: number
}

/**
 * Hook that only triggers re-renders when SOL price changes
 * Prevents unnecessary re-renders from other token price updates
 */
export function useSolPrice(): SolPriceData {
  const { prices } = usePriceStreamContext()
  const [solPrice, setSolPrice] = useState<SolPriceData>({
    price: 0,
    change24h: 0,
    timestamp: 0
  })

  const lastPriceRef = useRef<number>(0)

  useEffect(() => {
    const newSolData = prices.get(SOL_MINT)
    if (newSolData && newSolData.price !== lastPriceRef.current) {
      lastPriceRef.current = newSolData.price
      setSolPrice({
        price: newSolData.price,
        change24h: newSolData.change24h || 0,
        timestamp: newSolData.timestamp || Date.now()
      })
    }
  }, [prices])

  return solPrice
}

/**
 * Hook to get a specific token price without re-rendering on other price changes
 */
export function useTokenPrice(mint: string | undefined): SolPriceData | null {
  const { prices } = usePriceStreamContext()
  const [tokenPrice, setTokenPrice] = useState<SolPriceData | null>(null)
  const lastPriceRef = useRef<number>(0)

  useEffect(() => {
    if (!mint) {
      setTokenPrice(null)
      return
    }

    const newData = prices.get(mint)
    if (newData && newData.price !== lastPriceRef.current) {
      lastPriceRef.current = newData.price
      setTokenPrice({
        price: newData.price,
        change24h: newData.change24h || 0,
        timestamp: newData.timestamp || Date.now()
      })
    }
  }, [prices, mint])

  return tokenPrice
}
