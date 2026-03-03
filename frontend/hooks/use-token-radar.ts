/**
 * React Query Hooks for Token Radar Hub
 *
 * Custom hooks for fetching and mutating Token Radar data
 */

"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import {
  getTokenRadarFeed,
  addTokenWatch,
  removeTokenWatch,
  updateWatchPreferences,
  getUserWatches,
  getTokenHealth,
  getTokenDetails,
} from "@/lib/api/token-radar"
import type { FeedFilters, AdvancedFilters, AddWatchRequest, UpdateWatchRequest } from "@/lib/types/token-radar"

/**
 * Hook to fetch Token Radar feed with advanced filtering
 */
export function useTokenRadarFeed(filters?: FeedFilters & AdvancedFilters) {
  return useQuery({
    queryKey: ["token-radar-feed", filters],
    queryFn: () => getTokenRadarFeed(filters),
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
    staleTime: 1000, // Consider data stale after 1 second
  })
}

/**
 * Hook to add a token to watchlist
 */
export function useAddTokenWatch() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  return useMutation({
    mutationFn: (request: AddWatchRequest) => {
      if (!isAuthenticated) throw new Error("Authentication required")
      return addTokenWatch(request)
    },
    onSuccess: () => {
      // Invalidate feed to update isWatched flags
      queryClient.invalidateQueries({ queryKey: ["token-radar-feed"] })
      queryClient.invalidateQueries({ queryKey: ["token-radar-watches"] })
    },
  })
}

/**
 * Hook to remove a token from watchlist
 */
export function useRemoveTokenWatch() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  return useMutation({
    mutationFn: (mint: string) => {
      if (!isAuthenticated) throw new Error("Authentication required")
      return removeTokenWatch(mint)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-radar-feed"] })
      queryClient.invalidateQueries({ queryKey: ["token-radar-watches"] })
    },
  })
}

/**
 * Hook to update watch preferences
 */
export function useUpdateWatchPreferences() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  return useMutation({
    mutationFn: ({ mint, preferences }: { mint: string; preferences: UpdateWatchRequest }) => {
      if (!isAuthenticated) throw new Error("Authentication required")
      return updateWatchPreferences(mint, preferences)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-radar-watches"] })
    },
  })
}

/**
 * Hook to fetch user's watched tokens
 */
export function useUserWatches() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ["token-radar-watches"],
    queryFn: () => getUserWatches(),
    enabled: isAuthenticated, // Only fetch if authenticated
  })
}

/**
 * Hook to fetch token health data
 */
export function useTokenHealth(mint: string) {
  return useQuery({
    queryKey: ["token-radar-health", mint],
    queryFn: () => getTokenHealth(mint),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch token details
 */
export function useTokenDetails(mint: string) {
  return useQuery({
    queryKey: ["token-radar-token", mint],
    queryFn: () => getTokenDetails(mint),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}
