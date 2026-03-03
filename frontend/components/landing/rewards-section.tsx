"use client"

import { EnhancedCard } from "@/components/ui/enhanced-card-system"
import { Gift, Zap, Trophy, Coins, TrendingUp, Wallet } from "lucide-react"
import { motion } from "framer-motion"

const rewards = [
  {
    icon: TrendingUp,
    title: "Trading Volume Multiplier",
    description: "Earn $SIM tokens based on your trading activity. Higher volume = bigger multipliers and more rewards.",
  },
  {
    icon: Wallet,
    title: "Hold $SIM, Earn More",
    description: "Hold $SIM tokens to boost your reward multiplier. The more you hold, the more you earn from trading.",
  },
  {
    icon: Zap,
    title: "Daily Streak Bonuses",
    description: "Log in daily to maintain your streak and unlock exponentially higher $SIM rewards.",
  },
  {
    icon: Trophy,
    title: "Leaderboard Rewards",
    description: "Top traders earn exclusive $SIM airdrops and bonus multipliers based on rankings.",
  },
]

export function RewardsSection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Earn $SIM Tokens</span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-balance">
            Earn $SIM While You Trade
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Trade more, hold $SIM, and earn multiplied rewards. The ultimate trading-to-earn platform.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
          {rewards.map((reward, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <EnhancedCard className="p-6 bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 group h-full hover:shadow-lg hover:shadow-primary/10">
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <reward.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-heading text-xl font-bold">{reward.title}</h3>
                    <p className="text-base text-muted-foreground leading-relaxed">{reward.description}</p>
                  </div>
                </div>
              </EnhancedCard>
            </motion.div>
          ))}
        </div>

        {/* Simplified explanation box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <EnhancedCard className="max-w-4xl mx-auto p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/30">
            <div className="text-center space-y-4">
              <div className="inline-flex h-16 w-16 rounded-full bg-primary/20 items-center justify-center mb-2">
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-heading text-2xl md:text-3xl font-bold">
                How $SIM Rewards Work
              </h3>
              <div className="space-y-3 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                <p>
                  <span className="font-semibold text-foreground">Trade to earn $SIM.</span> Every trade you make earns you $SIM tokens. Higher trading volume = higher rewards.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Hold $SIM to boost earnings.</span> Holding $SIM tokens increases your reward multiplier, earning you even more $SIM from your trades.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Climb the leaderboard.</span> Top traders receive exclusive $SIM airdrops and premium multipliers.
                </p>
                <p className="pt-2 border-t border-primary/20">
                  <span className="font-semibold text-primary text-lg">The more you trade and hold, the more $SIM you claim!</span>
                </p>
              </div>
            </div>
          </EnhancedCard>
        </motion.div>
      </div>
    </section>
  )
}
