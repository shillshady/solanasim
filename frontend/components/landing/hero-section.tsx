"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32 bg-foreground text-background">
      {/* Uses theme foreground (black in light, white in dark) */}

      <div className="container relative mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Headline + CTA */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/10 border border-background/20"
              >
                <Sparkles className="h-4 w-4 text-background" />
                <span className="text-sm font-medium text-background">Practice Trading Platform</span>
              </motion.div>

              <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-balance">
                Trade Solana Without Risk
              </h1>
              <p className="text-xl text-background/70 max-w-xl leading-relaxed">
                Practice trading real Solana tokens with live market data. Track wallets, earn rewards, compete on leaderboards - all risk-free.
              </p>
            </div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Link href="/trade">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-background text-foreground hover:bg-background/90 group"
                >
                  Start Trading
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-background text-background hover:bg-background hover:text-foreground"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                Learn More ↓
              </Button>
            </motion.div>

            <motion.div
              className="grid grid-cols-3 gap-3 sm:gap-6 pt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#00ff85]">100 SOL</div>
                <p className="text-xs sm:text-sm text-background/60">Virtual starting balance for all users</p>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold">Rewards</div>
                <p className="text-xs sm:text-sm text-background/60">Earn while learning</p>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold">Zero Risk</div>
                <p className="text-xs sm:text-sm text-background/60">Practice safely</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Demo video */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="relative rounded-2xl overflow-hidden border border-background/20 shadow-lg bg-background/5">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto object-contain"
              >
                <source src="/final comp_1.mp4" type="video/mp4" />
                <span className="sr-only">Demo video of the Solana Sim trading platform</span>
              </video>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
