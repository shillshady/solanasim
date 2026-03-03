"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWallet } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Gift, Coins, TrendingUp, Calendar, Clock, AlertCircle,
  Wallet, CheckCircle, Info, Zap, Trophy, Target
} from "lucide-react"
import * as api from "@/lib/api"
import * as Backend from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { usePortfolio } from "@/hooks/use-portfolio"
import { formatNumber, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner"
import { AuthCTA } from "@/components/auth/auth-cta"

export function RewardsOverview() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuth()
  const { connected, publicKey } = useWallet()
  const [isClaimingAll, setIsClaimingAll] = useState(false)
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState("")

  // Get user's reward claims
  const { data: rewardClaims, isLoading: claimsLoading } = useQuery({
    queryKey: ['reward-claims', user?.id],
    queryFn: () => user ? api.getUserRewardClaims(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
    refetchInterval: 30000,
  })

  // Get reward statistics
  const { data: rewardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['reward-stats'],
    queryFn: () => api.getRewardStats(),
    refetchInterval: 60000,
  })

  // Get user's portfolio for tier calculation using centralized hook
  const { data: portfolio } = usePortfolio()

  // Claim rewards mutation
  const claimMutation = useMutation({
    mutationFn: (request: Backend.RewardsClaimRequest) => api.claimRewards(request),
    onSuccess: (data) => {
      toast({
        title: "Rewards Claimed!",
        description: `Successfully claimed ${formatNumber(parseFloat(data.amount))} $SIM tokens`,
      })
      queryClient.invalidateQueries({ queryKey: ['reward-claims', user?.id] })
    },
    onError: (error: any) => {
      // Check if error is related to email verification
      const isEmailVerificationError = error.message?.includes("verification") ||
                                        error.message?.includes("verify your email")

      toast({
        title: isEmailVerificationError ? "Email Verification Required" : "Claim Failed",
        description: isEmailVerificationError
          ? "Please verify your email address before claiming rewards. Check your inbox for the verification link."
          : error.message || "Failed to claim rewards",
        variant: "destructive",
      })
    },
  })

  const handleClaimAll = async () => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      })
      return
    }

    const unclaimedRewards = rewardClaims?.filter(claim =>
      claim.status === 'PENDING' || !claim.claimedAt
    ) || []

    if (unclaimedRewards.length === 0) return

    if (!user || !publicKey) return;
    
    setIsClaimingAll(true)
    try {
      for (const claim of unclaimedRewards) {
        await claimMutation.mutateAsync({
          userId: user.id,
          epoch: claim.epoch,
          wallet: publicKey.toBase58(),
        })
      }
    } finally {
      setIsClaimingAll(false)
    }
  }

  const handleSingleClaim = (claim: Backend.RewardClaim) => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      })
      return
    }

    if (!user || !publicKey) return;

    claimMutation.mutate({
      userId: user.id,
      epoch: claim.epoch,
      wallet: publicKey.toBase58(),
    })
  }

  // Calculate current epoch (daily)
  const getCurrentEpoch = () => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const dayNumber = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
    return dayNumber
  }

  // Get current day for display
  const getCurrentDayDisplay = () => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const currentEpoch = getCurrentEpoch()
  const currentDayDisplay = getCurrentDayDisplay()

  // Countdown timer for next claim
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const diff = tomorrow.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeUntilNextClaim(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [])

  const unclaimedRewards = rewardClaims?.filter(claim => claim.status === 'PENDING' || !claim.claimedAt) || []
  const claimedRewards = rewardClaims?.filter(claim => claim.status === 'COMPLETED' && claim.claimedAt) || []
  const totalUnclaimed = unclaimedRewards.reduce((sum, claim) => sum + parseFloat(claim.amount), 0)
  const totalClaimed = claimedRewards.reduce((sum, claim) => sum + parseFloat(claim.amount), 0)

  // Calculate user tier based on trading volume (using placeholder for now)
  const getUserTier = () => {
    // TODO: Replace with actual trading volume from user stats
    const totalVolume = 0 // portfolio?.totals?.totalTrades * 1000 || 0 // Placeholder calculation
    if (totalVolume >= 1000000) return { name: "Diamond", color: "text-cyan-500", icon: "💎", multiplier: 2.0 }
    if (totalVolume >= 500000) return { name: "Platinum", color: "text-purple-500", icon: "🔮", multiplier: 1.75 }
    if (totalVolume >= 100000) return { name: "Gold", color: "text-yellow-500", icon: "🏆", multiplier: 1.5 }
    if (totalVolume >= 50000) return { name: "Silver", color: "text-gray-400", icon: "🥈", multiplier: 1.25 }
    if (totalVolume >= 10000) return { name: "Bronze", color: "text-amber-600", icon: "🥉", multiplier: 1.1 }
    return { name: "Novice", color: "text-gray-500", icon: "🌟", multiplier: 1.0 }
  }

  const userTier = getUserTier()
  const totalVolume = 0 // Placeholder - replace with actual volume
  const nextTierVolume = totalVolume < 10000 ? 10000 :
    totalVolume < 50000 ? 50000 :
    totalVolume < 100000 ? 100000 :
    totalVolume < 500000 ? 500000 :
    totalVolume < 1000000 ? 1000000 : 0

  const progressToNextTier = totalVolume && nextTierVolume > 0 ?
    (totalVolume / nextTierVolume) * 100 : 0

  if (!isAuthenticated || !user) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <Gift className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Sign In to View Rewards</h3>
              <p className="text-sm text-muted-foreground">Connect your account to start earning $SIM tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (claimsLoading || statsLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Email Verification Banner */}
      {user && !user.emailVerified && (
        <EmailVerificationBanner email={user.email} />
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Unclaimed Rewards */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Coins className="h-5 w-5 text-primary" />
              <Badge variant="secondary">Available</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-2">{formatNumber(totalUnclaimed)}</div>
            <p className="text-sm text-muted-foreground mb-4">$SIM to claim</p>
            {unclaimedRewards.length > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={handleClaimAll}
                disabled={isClaimingAll || claimMutation.isPending || !connected}
              >
                {isClaimingAll ? "Claiming..." : `Claim All (${unclaimedRewards.length})`}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Total Earned */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <Badge variant="outline">Lifetime</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-2">{formatNumber(totalClaimed + totalUnclaimed)}</div>
            <p className="text-sm text-muted-foreground">$SIM earned total</p>
          </CardContent>
        </Card>

        {/* Current Tier */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Target className="h-5 w-5" />
              <span className="text-2xl">{userTier.icon}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn("text-4xl font-bold mb-2", userTier.color)}>
              {userTier.name}
            </div>
            <p className="text-sm text-muted-foreground">
              {userTier.multiplier}x multiplier
            </p>
          </CardContent>
        </Card>

        {/* Current Epoch */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Calendar className="h-5 w-5" />
              <Badge>Today</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{currentDayDisplay}</div>
            <p className="text-sm text-muted-foreground mb-2">
              Day {currentEpoch} of the year
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Clock className="h-3 w-3" />
              <span>Next claim in: <span className="font-mono font-semibold text-foreground">{timeUntilNextClaim}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout for Additional Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Unclaimed Rewards List */}
        {unclaimedRewards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5" />
                Unclaimed Rewards
              </CardTitle>
              <CardDescription>
                Claim your rewards to receive $SIM tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {unclaimedRewards.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Coins className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-semibold text-lg">{formatNumber(parseFloat(claim.amount))} $SIM</div>
                        <div className="text-xs text-muted-foreground">
                          Day {claim.epoch}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSingleClaim(claim)}
                      disabled={claimMutation.isPending || !connected}
                    >
                      Claim
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Stats */}
        {rewardStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5" />
                Platform Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold mb-1">{formatNumber(rewardStats.totalAmount)}</div>
                  <p className="text-sm text-muted-foreground">$SIM Distributed</p>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">{rewardStats.totalClaims}</div>
                  <p className="text-sm text-muted-foreground">Total Claims</p>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">{rewardStats.pendingClaims}</div>
                  <p className="text-sm text-muted-foreground">Pending Claims</p>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">
                    {rewardStats.totalClaims > 0 ?
                      formatNumber(rewardStats.totalAmount / rewardStats.totalClaims) :
                      '0'
                    }
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Claim Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Wallet Connection Warning - Full Width */}
      {!connected && unclaimedRewards.length > 0 && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Connect your Solana wallet to claim your rewards</span>
            <Button size="sm" variant="outline">
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}