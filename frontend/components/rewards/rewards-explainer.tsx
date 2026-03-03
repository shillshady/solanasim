"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Gift, TrendingUp, Trophy, Target, Zap, Calculator,
  DollarSign, Users, Calendar, CheckCircle, Info,
  Coins, ArrowRight, Star, Award
} from "lucide-react"
import { cn } from "@/lib/utils"

const tiers = [
  {
    name: "Novice",
    minVolume: 0,
    multiplier: 1.0,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: "🌟",
    benefits: ["Base rewards rate", "Access to all features"]
  },
  {
    name: "Bronze",
    minVolume: 10000,
    multiplier: 1.1,
    color: "text-amber-600",
    bgColor: "bg-amber-600/10",
    icon: "🥉",
    benefits: ["10% bonus rewards", "Priority support"]
  },
  {
    name: "Silver",
    minVolume: 50000,
    multiplier: 1.25,
    color: "text-gray-400",
    bgColor: "bg-gray-400/10",
    icon: "🥈",
    benefits: ["25% bonus rewards", "Early access features"]
  },
  {
    name: "Gold",
    minVolume: 100000,
    multiplier: 1.5,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    icon: "🏆",
    benefits: ["50% bonus rewards", "Exclusive insights"]
  },
  {
    name: "Platinum",
    minVolume: 500000,
    multiplier: 1.75,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: "🔮",
    benefits: ["75% bonus rewards", "VIP features"]
  },
  {
    name: "Diamond",
    minVolume: 1000000,
    multiplier: 2.0,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    icon: "💎",
    benefits: ["100% bonus rewards", "Maximum benefits", "Elite trader status"]
  }
]

const rewardActivities = [
  {
    activity: "Executing Trades",
    points: "1 point per $100 volume",
    icon: TrendingUp,
    description: "Earn points for every trade you execute, buy or sell"
  },
  {
    activity: "Profitable Trades",
    points: "Bonus 0.5x multiplier",
    icon: Trophy,
    description: "Get bonus points when your trades are profitable"
  },
  {
    activity: "Daily Trading",
    points: "10 bonus points",
    icon: Calendar,
    description: "Trade at least once per day to earn daily bonus"
  },
  {
    activity: "Portfolio Diversity",
    points: "Up to 50 bonus points",
    icon: Star,
    description: "Hold 5+ different tokens for diversity bonus"
  }
]

export function RewardsExplainer() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            How SIM Token Rewards Work
          </CardTitle>
          <CardDescription>
            Learn how to maximize your earnings on Solana Sim
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p>
              Solana Sim rewards active traders with $SIM tokens based on their trading activity and performance.
              The more you trade and the better you perform, the more rewards you earn. Rewards are calculated
              daily and distributed at the end of each epoch.
            </p>
          </div>

          <Alert className="border-primary/20 bg-primary/5 backdrop-blur-sm">
            <Gift className="h-4 w-4 text-primary" />
            <AlertDescription>
              <strong>Important:</strong> $SIM tokens are distributed on the Solana blockchain.
              You'll need a Solana wallet connected to claim your rewards. The rewards are sent
              directly to your wallet address once claimed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Earning Points */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            How to Earn Reward Points
          </CardTitle>
          <CardDescription>
            Multiple ways to accumulate points throughout each day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {rewardActivities.map((activity, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-full bg-primary/10 h-fit">
                  <activity.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{activity.activity}</h4>
                    <Badge variant="secondary" className="ml-2">{activity.points}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier System */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Tier System & Multipliers
          </CardTitle>
          <CardDescription>
            Higher trading volumes unlock better reward multipliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier, index) => (
              <div key={index} className={cn(
                "p-4 rounded-lg border border-border/50 transition-all",
                "hover:shadow-md hover:border-primary/20 hover:scale-105",
                tier.bgColor
              )}>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tier.icon}</span>
                      <div>
                        <h4 className={cn("font-semibold text-lg", tier.color)}>
                          {tier.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          ${tier.minVolume.toLocaleString()}+
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tier.benefits.map((benefit, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {tier.multiplier}x
                    </div>
                    <p className="text-xs text-muted-foreground">multiplier</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calculation Example */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Reward Calculation Example
          </CardTitle>
          <CardDescription>
            See how your rewards are calculated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-semibold">Example: Gold Tier Trader</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily Trading Volume:</span>
                  <span className="font-medium">$35,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Points (1 per $100):</span>
                  <span className="font-medium">350 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profitable Trades Bonus:</span>
                  <span className="font-medium">+175 points (50%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily Trading Bonus:</span>
                  <span className="font-medium">+10 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Portfolio Diversity Bonus:</span>
                  <span className="font-medium">+50 points</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">585 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gold Tier Multiplier:</span>
                  <span className="font-medium">×1.5</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Final Points:</span>
                  <span className="text-primary">878 points</span>
                </div>
              </div>
            </div>

            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                Points are converted to $SIM tokens based on the total reward pool for each epoch.
                Your share of the pool depends on your points relative to all other traders.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Distribution Schedule
          </CardTitle>
          <CardDescription>
            When and how rewards are distributed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div>
                  <p className="font-medium">Daily Epochs</p>
                  <p className="text-sm text-muted-foreground">
                    Each epoch runs from 00:00 UTC to 23:59 UTC each day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div>
                  <p className="font-medium">Calculation Period</p>
                  <p className="text-sm text-muted-foreground">
                    Rewards are calculated at midnight UTC after each day ends
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div>
                  <p className="font-medium">Claim Window</p>
                  <p className="text-sm text-muted-foreground">
                    Rewards can be claimed anytime after calculation (no expiry)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div>
                  <p className="font-medium">Distribution Method</p>
                  <p className="text-sm text-muted-foreground">
                    Direct transfer to your connected Solana wallet
                  </p>
                </div>
              </div>
            </div>

            <Alert className="border-green-500/20 bg-green-500/5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <strong>No Rush:</strong> Your rewards are safely stored and can be claimed at any time.
                There's no penalty for claiming late, and unclaimed rewards accumulate.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}