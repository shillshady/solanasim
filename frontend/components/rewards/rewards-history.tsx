"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  History, CheckCircle, Clock, XCircle, ExternalLink,
  Search, Filter, Download, TrendingUp, Calendar
} from "lucide-react"
import * as api from "@/lib/api"
import * as Backend from "@/lib/types/backend"
import { useAuth } from "@/hooks/use-auth"
import { formatNumber, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

type FilterStatus = "all" | "pending" | "completed" | "failed"

export function RewardsHistory() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")

  // Get user's reward claims
  const { data: rewardClaims, isLoading } = useQuery({
    queryKey: ['reward-claims', user?.id],
    queryFn: () => user ? api.getUserRewardClaims(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  })

  // Filter and sort claims
  const filteredClaims = rewardClaims?.filter(claim => {
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "pending" && claim.status !== "PENDING") return false
      if (statusFilter === "completed" && claim.status !== "COMPLETED") return false
      if (statusFilter === "failed" && claim.status !== "FAILED") return false
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      if (!claim.epoch.toString().includes(search) &&
          !claim.amount.toString().includes(search) &&
          (!claim.txSig || !claim.txSig.toLowerCase().includes(search))) {
        return false
      }
    }

    return true
  }).sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    }
    return parseFloat(b.amount) - parseFloat(a.amount)
  }) || []

  // Calculate statistics
  const stats = {
    totalClaimed: rewardClaims?.filter(c => c.status === "COMPLETED")
      .reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
    totalPending: rewardClaims?.filter(c => c.status === "PENDING")
      .reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
    totalClaims: rewardClaims?.filter(c => c.status === "COMPLETED").length || 0,
    avgClaimSize: 0
  }
  if (stats.totalClaims > 0) {
    stats.avgClaimSize = stats.totalClaimed / stats.totalClaims
  }

  const getStatusBadge = (claim: Backend.RewardClaim) => {
    if (claim.status === "COMPLETED") {
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Claimed
        </Badge>
      )
    }
    if (claim.status === "PENDING") {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    )
  }

  const exportToCSV = () => {
    if (!filteredClaims || filteredClaims.length === 0) return

    const headers = ["Epoch", "Amount", "Status", "Date", "Transaction"]
    const rows = filteredClaims.map(claim => [
      claim.epoch,
      claim.amount,
      claim.status,
      claim.claimedAt ? new Date(claim.claimedAt).toISOString() : "",
      claim.txSig || ""
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rewards-history-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <History className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Sign In Required</h3>
              <p className="text-sm text-muted-foreground">Connect your account to view reward history</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Claimed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalClaimed)}</div>
            <p className="text-xs text-muted-foreground">$SIM tokens</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {formatNumber(stats.totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">$SIM tokens</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClaims}</div>
            <p className="text-xs text-muted-foreground">successful</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Claim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.avgClaimSize)}</div>
            <p className="text-xs text-muted-foreground">$SIM per claim</p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Reward History
              </CardTitle>
              <CardDescription>
                Your complete reward claim history
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!filteredClaims || filteredClaims.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by epoch, amount, or transaction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "amount")}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <TrendingUp className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No rewards found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Start trading to earn rewards"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Epoch</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Week {claim.epoch}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">
                          {formatNumber(parseFloat(claim.amount))} $SIM
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(claim)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {claim.claimedAt ? (
                            <>
                              <div>{new Date(claim.claimedAt).toLocaleDateString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(claim.claimedAt).toLocaleTimeString()}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not claimed</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {claim.txSig && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://solscan.io/tx/${claim.txSig}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}