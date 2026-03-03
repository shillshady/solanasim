"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Target, Shield, Users, Sparkles, TrendingUp, Zap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EnhancedCard } from "@/components/ui/enhanced-card-system"

export default function AboutPage() {
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
              <Sparkles className="h-10 w-10 text-primary" />
              <h1 className="font-heading text-4xl md:text-5xl font-bold">About Solana Sim</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              The premier Solana paper trading platform for learning and mastering cryptocurrency trading
            </p>
          </div>
        </motion.div>

        {/* Mission Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Our Mission</h2>

          <EnhancedCard className="p-8 border-2 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Target className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div className="space-y-3">
                  <p className="text-lg leading-relaxed">
                    Solana Sim exists to democratize cryptocurrency trading education by providing a risk-free environment
                    where anyone can learn and practice trading Solana tokens.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    We believe that the best way to learn trading is through hands-on practice with real market data,
                    but without the fear of losing real money. Our platform bridges the gap between theory and practice,
                    allowing traders of all skill levels to build confidence and develop strategies before risking their capital.
                  </p>
                </div>
              </div>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* What We Offer */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">What We Offer</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <EnhancedCard className="p-6 border-2">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Real-Time Market Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Access live price feeds, charts, and market data from Solana DEXes including Raydium and Pump.fun.
                  Experience real market conditions without the risk.
                </p>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Zero Financial Risk</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Practice with virtual balance (10 SOL for standard users, 100 SOL for SIM holders). No real money involved, no deposits required, and no risk of
                  losing your hard-earned capital while you learn.
                </p>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Competitive Leaderboard</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Compete with other traders on the global leaderboard. Track your performance, compare strategies,
                  and see how you rank against the community.
                </p>
              </div>
            </EnhancedCard>

            <EnhancedCard className="p-6 border-2">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Instant Execution</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Execute trades instantly with real-time price updates. Experience the speed and feel of live trading
                  with comprehensive P&L tracking and portfolio analytics.
                </p>
              </div>
            </EnhancedCard>
          </div>
        </motion.section>

        {/* Why Paper Trading */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Why Paper Trading Matters</h2>

          <EnhancedCard className="p-6 border-2">
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong className="text-foreground">Paper trading</strong> is a proven method for learning trading strategies
                without financial risk. It allows you to:
              </p>
              <ul className="space-y-2 list-disc list-inside pl-4">
                <li>Test and refine trading strategies in real market conditions</li>
                <li>Build confidence and emotional discipline before risking real capital</li>
                <li>Learn how to read charts, identify trends, and time entries/exits</li>
                <li>Understand the psychology of trading without the stress of real losses</li>
                <li>Experiment with different position sizes and risk management techniques</li>
                <li>Track your performance metrics and identify areas for improvement</li>
              </ul>
              <p className="leading-relaxed">
                Whether you're a complete beginner or an experienced trader looking to test new strategies,
                Solana Sim provides the perfect environment to practice and improve your skills.
              </p>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* The Team */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Built for Traders, By Traders</h2>

          <EnhancedCard className="p-6 border-2">
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                Solana Sim was created by traders who understand the challenges of learning to trade in the fast-paced
                cryptocurrency markets. We've experienced the ups and downs, the wins and losses, and we know firsthand
                how valuable practice and preparation can be.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our platform combines cutting-edge technology with user-friendly design to deliver a seamless trading
                experience. We're constantly improving and adding new features based on community feedback.
              </p>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* Disclaimer */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6 mb-12"
        >
          <h2 className="font-heading text-3xl font-bold">Important Disclaimer</h2>

          <EnhancedCard className="p-6 border-2 border-yellow-500/30 bg-yellow-500/5">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Solana Sim is a simulator for educational purposes only.</strong> All
                trading on this platform uses virtual currency and no real financial risk is involved. Past simulated
                performance is not indicative of future results in real trading.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Real cryptocurrency trading involves substantial risk of loss and may not be suitable for all investors.
                Before trading real cryptocurrency, you should carefully consider your financial situation, level of experience,
                and risk tolerance. The information provided on Solana Sim is not financial advice.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Always conduct your own research and consult with qualified financial advisors before making investment decisions.
              </p>
            </div>
          </EnhancedCard>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center space-y-4 py-8"
        >
          <h2 className="font-heading text-2xl font-bold">Ready to Start Your Trading Journey?</h2>
          <p className="text-muted-foreground">Join thousands of traders practicing on Solana Sim.</p>
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
