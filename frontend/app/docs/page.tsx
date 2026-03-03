"use client"

import { motion } from "framer-motion"
import { ArrowLeft, BookOpen, TrendingUp, Wallet, BarChart3, Trophy, Shield, Zap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EnhancedCard } from "@/components/ui/enhanced-card-system"

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mb-12"
        >
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-10 w-10 text-primary" />
              <h1 className="font-heading text-4xl md:text-5xl font-bold">Documentation</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about using Solana Sim
            </p>
          </div>
        </motion.div>

        {/* Getting Started */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Getting Started</h2>

          <EnhancedCard className="p-6 border-2">
            <div className="space-y-4">
              <h3 className="font-semibold text-xl">Quick Start Guide</h3>
              <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
                <li className="leading-relaxed">
                  <span className="font-medium text-foreground">Sign Up:</span> Create your account with email or connect your Solana wallet
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-foreground">Get Virtual Balance:</span> Receive virtual balance instantly to start trading (10 SOL for standard users, 100 SOL for SIM holders)
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-foreground">Explore Tokens:</span> Browse trending tokens from Birdeye and Pump.fun on the Trending page
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-foreground">Place Trades:</span> Buy and sell tokens with real-time market data using your virtual balance
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-foreground">Track Performance:</span> Monitor your portfolio, P&L, and compete on the leaderboard
                </li>
              </ol>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Platform Features</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <EnhancedCard className="p-6 border-2">
              <div className="flex items-start gap-4">
                <TrendingUp className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Hybrid Trending System</h3>
                  <p className="text-muted-foreground text-sm">
                    Real-time trending tokens from Birdeye and Pump.fun. Stay ahead of the market with live data and discover new opportunities.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="flex items-start gap-4">
                <Wallet className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Virtual Balance</h3>
                  <p className="text-muted-foreground text-sm">
                    Start with virtual balance (10 SOL for standard users, 100 SOL for SIM holders). Trade without losing real money while you learn. Top up anytime to continue trading.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="flex items-start gap-4">
                <BarChart3 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Real Market Data</h3>
                  <p className="text-muted-foreground text-sm">
                    Practice with live prices and charts. Experience real market conditions without the risk. All data is sourced from live Solana DEXes.
                  </p>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="flex items-start gap-4">
                <Trophy className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Performance Analytics</h3>
                  <p className="text-muted-foreground text-sm">
                    Track your P&L, analyze your trades, and compete on the leaderboard. View detailed trade history and portfolio metrics.
                  </p>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </motion.section>

        {/* Trading Guide */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Trading Guide</h2>

          <EnhancedCard className="p-6 border-2">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  How to Execute a Trade
                </h3>
                <div className="space-y-2 text-muted-foreground pl-7">
                  <p>1. Navigate to the Trade page or search for a token using the search bar</p>
                  <p>2. Select a token from trending lists or search results</p>
                  <p>3. Choose BUY or SELL and enter the amount in SOL or tokens</p>
                  <p>4. Review the trade details including price and estimated total</p>
                  <p>5. Confirm the trade and watch your portfolio update in real-time</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Understanding P&L
                </h3>
                <p className="text-muted-foreground pl-7">
                  Your Profit & Loss is calculated using FIFO (First-In-First-Out) accounting. This means when you sell tokens,
                  the platform uses the oldest purchase price to calculate your realized gains or losses. Your portfolio shows
                  both unrealized P&L (current positions) and realized P&L (completed trades).
                </p>
              </div>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* Safety & Risk */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Safety & Disclaimer</h2>

          <EnhancedCard className="p-6 border-2 border-primary/50">
            <div className="flex items-start gap-4">
              <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Important Information</h3>
                <div className="space-y-2 text-muted-foreground text-sm">
                  <p>
                    <strong className="text-foreground">No Real Money:</strong> Solana Sim is a paper trading simulator.
                    All trades use virtual SOL and no real cryptocurrency is involved.
                  </p>
                  <p>
                    <strong className="text-foreground">Educational Purpose:</strong> This platform is designed for learning
                    and practicing trading strategies without financial risk.
                  </p>
                  <p>
                    <strong className="text-foreground">Real Market Data:</strong> While we use real-time market data,
                    actual trading results may differ due to slippage, fees, and other market conditions.
                  </p>
                  <p>
                    <strong className="text-foreground">Not Financial Advice:</strong> Solana Sim does not provide investment
                    advice. Always do your own research before trading real cryptocurrency.
                  </p>
                </div>
              </div>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center space-y-4 py-8"
        >
          <h2 className="font-heading text-2xl font-bold">Ready to Start Trading?</h2>
          <p className="text-muted-foreground">Get virtual balance (10 SOL for standard users, 100 SOL for SIM holders) and start practicing today.</p>
          <Link href="/trade">
            <Button size="lg" className="gap-2">
              <TrendingUp className="h-5 w-5" />
              Start Trading Now
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
