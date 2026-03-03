"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, TrendingUp, Wallet, Trophy, Moon, Sun, Gift, Eye, Zap } from "lucide-react"
import { Twitter as XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { Button } from "@/components/ui/button"

// Percentage formatting now inline

interface MarketPrice {
  symbol: string
  price: number
  change24h: number
}

export function BottomNavBar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { prices, subscribe, unsubscribe } = usePriceStreamContext()
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([
    { symbol: "SOL", price: 250, change24h: 0 }, // Default to reasonable price instead of 0
  ])

  // Prevent hydration mismatch by only rendering theme toggle after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to SOL price updates
  useEffect(() => {
    const solMint = "So11111111111111111111111111111111111111112"
    subscribe(solMint)
    
    return () => {
      unsubscribe(solMint)
    }
  }, [subscribe, unsubscribe])

  // Use SOL price from price stream if available
  useEffect(() => {
    const solMint = "So11111111111111111111111111111111111111112" // SOL mint address
    const solPrice = prices.get(solMint)

    if (solPrice && solPrice.price > 0) {
      setMarketPrices([
        { symbol: "SOL", price: solPrice.price, change24h: solPrice.change24h || 0 }
      ])
    }
  }, [prices])

  // Fetch SOL price on mount as a fallback
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true')
        const data = await response.json()

        if (data.solana?.usd) {
          setMarketPrices(prev => {
            // Only update if we still have the default price
            if (prev[0]?.price === 250 || prev[0]?.price === 0) {
              return [{
                symbol: "SOL",
                price: data.solana.usd,
                change24h: data.solana.usd_24h_change || 0
              }]
            }
            return prev
          })
        }
      } catch (error) {
        console.warn('Failed to fetch SOL price:', error)
      }
    }

    fetchSolPrice()
  }, [])

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/trade", icon: TrendingUp, label: "Trade" },
    { href: "/portfolio", icon: Wallet, label: "Portfolio" },
    { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { href: "/rewards", icon: Gift, label: "Rewards" },
  ]

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-none md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="relative"
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all duration-300 relative z-10",
                    isActive ? "text-brand" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative"
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-300",
                      isActive && "glow-primary icon-morph"
                    )} />
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="bottomNavIndicator"
                          className="absolute -inset-2 rounded-full bg-brand-muted border border-brand/20"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <span className={cn(
                    "text-xs font-medium transition-all duration-300",
                    isActive && "font-semibold"
                  )}>
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </nav>

      {/* Floating Wallet Tracker Button (Mobile) */}
      <motion.div
        className="fixed bottom-20 right-4 z-50 md:hidden"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
      >
        <Link href="/wallet-tracker">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 bg-brand text-brand-foreground"
          >
            <Eye className="h-6 w-6" />
          </Button>
        </Link>
      </motion.div>

      {/* Desktop/Tablet Bottom Info Bar */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 border-t-2 border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-none">
        <div className="mx-auto flex h-12 items-center justify-between px-4 max-w-content">
          {/* Left: Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://x.com/SolanaSimx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-brand transition-colors"
            >
              <XIcon className="h-4 w-4 hover:glow-primary" />
            </a>
            <span className="text-xs text-muted-foreground">© 2025 Solana Sim</span>
          </div>

          {/* Center: Market Prices */}
          <div className="flex items-center gap-4">
            {marketPrices.map((market) => (
              <div key={market.symbol} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-semibold text-foreground">{market.symbol}</span>
                </div>
                <span className="text-xs font-bold text-foreground">
                  ${market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    market.change24h > 0 
                      ? "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400" 
                      : market.change24h < 0 
                      ? "text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-400" 
                      : "text-gray-500 bg-gray-100 dark:bg-gray-800",
                  )}
                >
                  {market.change24h > 0 ? "+" : ""}
                  {market.change24h.toFixed(2)}%
                </span>
              </div>
            ))}
            
            {/* Solana Sim Logo */}
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted">
              <div className="flex items-center gap-1.5">
                <div className="relative h-6 w-6">
                  <Image
                    src="/solana-sim-logo.png"
                    alt="Solana Sim"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-xs font-semibold text-brand">SIM</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Coming Soon
              </span>
            </div>
          </div>

          {/* Right: Wallet Tracker, Leaderboard, Theme Toggle & Quick Trade */}
          <div className="flex items-center gap-4">
            {/* Wallet Tracker Button */}
            <Link href="/wallet-tracker">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium hover:text-brand transition-colors flex items-center gap-1.5 h-8"
              >
                <Eye className="h-4 w-4" />
                Wallet Tracker
              </Button>
            </Link>
            {/* Leaderboard Button */}
            <Link href="/leaderboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium hover:text-brand transition-colors flex items-center gap-1.5 h-8"
              >
                <Trophy className="h-4 w-4" />
                Leaderboard
              </Button>
            </Link>
            {/* Theme Toggle Button - Skeleton prevents layout shift */}
            {mounted ? (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-muted-foreground hover:text-brand transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-4 h-4 bg-muted-foreground/20 rounded animate-pulse" />
            )}
            <Link
              href="/trade"
              className="text-xs font-medium text-brand hover:text-brand/80 transition-colors flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Quick Trade
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
