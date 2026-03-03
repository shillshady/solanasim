"use client"

import { Suspense } from "react"

import { RewardsOverview } from "@/components/rewards/rewards-overview"
import { RewardsExplainer } from "@/components/rewards/rewards-explainer"
import { RewardsHistory } from "@/components/rewards/rewards-history"
import { RewardsLeaderboard } from "@/components/rewards/rewards-leaderboard"
import { SimplePageHeader } from "@/components/shared/simple-page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gift, Trophy, History, Info } from "lucide-react"
import { motion } from "framer-motion"

function RewardsPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <main className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-page-xl mx-auto">
        {/* Enhanced Header */}
        <SimplePageHeader
          title="SIM Token Rewards"
          subtitle="Earn rewards for your trading activity"
          icon={<Gift className="h-6 w-6 text-primary" />}
        />

        {/* Main Overview - Top Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <RewardsOverview />
        </motion.div>

        {/* Enhanced Tabbed Content - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs defaultValue="how-it-works" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/50 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="how-it-works" className="gap-2 data-[state=active]:bg-primary/20">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">How It Works</span>
                <span className="sm:hidden">Info</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary/20">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
                <span className="sm:hidden">History</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-2 data-[state=active]:bg-primary/20">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Top Earners</span>
                <span className="sm:hidden">Top</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="how-it-works" className="mt-0">
              <RewardsExplainer />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <RewardsHistory />
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-0">
              <RewardsLeaderboard />
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Decorative Elements */}
        <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden">
          <div className="absolute top-1/3 left-1/5 w-96 h-96 bg-primary/3 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-1/5 w-96 h-96 bg-purple-500/3 rounded-full blur-3xl"></div>
          <div className="absolute top-2/3 left-2/3 w-64 h-64 bg-blue-500/3 rounded-full blur-2xl"></div>
        </div>
      </main>
    </div>
  )
}

export default function RewardsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 h-16 w-16 border-2 border-purple-500/20 border-b-purple-500 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Loading Rewards</h3>
              <p className="text-sm text-muted-foreground">Calculating your earnings...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <RewardsPageContent />
    </Suspense>
  )
}