/**
 * Token Radar API Client
 *
 * Client-side functions for interacting with the Token Radar API
 */

import type {
  TokenRow,
  TokenRadarFeedResponse,
  AddWatchRequest,
  UpdateWatchRequest,
  FeedFilters,
} from "@/lib/types/token-radar"
import { API as API_BASE_URL, getAuthHeaders } from './client'

/**
 * Get token discovery feed (bonded, graduating, new)
 */
export async function getTokenRadarFeed(
  filters?: FeedFilters & Record<string, any>
): Promise<TokenRadarFeedResponse> {
  const params = new URLSearchParams()

  // Basic filters
  if (filters?.searchQuery) params.append("searchQuery", filters.searchQuery)
  if (filters?.sortBy) params.append("sortBy", filters.sortBy)
  if (filters?.minLiquidity) params.append("minLiquidity", filters.minLiquidity.toString())
  if (filters?.onlyWatched) params.append("onlyWatched", "true")

  // Advanced Audit Filters
  if (filters?.dexPaid !== undefined) params.append("dexPaid", filters.dexPaid.toString())
  if (filters?.minAge !== undefined) params.append("minAge", filters.minAge.toString())
  if (filters?.maxAge !== undefined) params.append("maxAge", filters.maxAge.toString())
  if (filters?.maxTop10Holders !== undefined) params.append("maxTop10Holders", filters.maxTop10Holders.toString())
  if (filters?.maxDevHolding !== undefined) params.append("maxDevHolding", filters.maxDevHolding.toString())
  if (filters?.maxSnipers !== undefined) params.append("maxSnipers", filters.maxSnipers.toString())

  // Advanced Metric Filters
  if (filters?.minLiquidityUsd !== undefined) params.append("minLiquidityUsd", filters.minLiquidityUsd.toString())
  if (filters?.maxLiquidityUsd !== undefined) params.append("maxLiquidityUsd", filters.maxLiquidityUsd.toString())
  if (filters?.minVolume24h !== undefined) params.append("minVolume24h", filters.minVolume24h.toString())
  if (filters?.maxVolume24h !== undefined) params.append("maxVolume24h", filters.maxVolume24h.toString())
  if (filters?.minMarketCap !== undefined) params.append("minMarketCap", filters.minMarketCap.toString())
  if (filters?.maxMarketCap !== undefined) params.append("maxMarketCap", filters.maxMarketCap.toString())

  // Advanced Social Filters
  if (filters?.requireTwitter !== undefined) params.append("requireTwitter", filters.requireTwitter.toString())
  if (filters?.requireTelegram !== undefined) params.append("requireTelegram", filters.requireTelegram.toString())
  if (filters?.requireWebsite !== undefined) params.append("requireWebsite", filters.requireWebsite.toString())

  // Advanced Bonding Filters
  if (filters?.minBondingProgress !== undefined) params.append("minBondingProgress", filters.minBondingProgress.toString())
  if (filters?.maxBondingProgress !== undefined) params.append("maxBondingProgress", filters.maxBondingProgress.toString())
  if (filters?.minSolToGraduate !== undefined) params.append("minSolToGraduate", filters.minSolToGraduate.toString())
  if (filters?.maxSolToGraduate !== undefined) params.append("maxSolToGraduate", filters.maxSolToGraduate.toString())

  const url = `${API_BASE_URL}/api/warp-pipes/feed${params.toString() ? `?${params}` : ""}`

  const response = await fetch(url, { headers: getAuthHeaders() })

  if (!response.ok) {
    throw new Error("Failed to fetch token radar feed")
  }

  return response.json()
}

/**
 * Add a token to watchlist
 */
export async function addTokenWatch(
  request: AddWatchRequest
): Promise<{ success: boolean; watch: any }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/watch`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to add token watch")
  }

  return response.json()
}

/**
 * Remove a token from watchlist
 */
export async function removeTokenWatch(mint: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/watch/${mint}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to remove token watch")
  }

  return response.json()
}

/**
 * Update watch preferences
 */
export async function updateWatchPreferences(
  mint: string,
  request: UpdateWatchRequest
): Promise<{ success: boolean; watch: any }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/watch/${mint}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update watch preferences")
  }

  return response.json()
}

/**
 * Get user's watched tokens
 */
export async function getUserWatches(): Promise<{ watches: any[] }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/watches`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error("Failed to fetch user watches")
  }

  return response.json()
}

/**
 * Get health data for a specific token
 */
export async function getTokenHealth(mint: string): Promise<{ mint: string; health: any }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/health/${mint}`)

  if (!response.ok) {
    throw new Error("Failed to fetch token health")
  }

  return response.json()
}

/**
 * Get detailed token information
 */
export async function getTokenDetails(
  mint: string
): Promise<{ token: TokenRow }> {
  const response = await fetch(`${API_BASE_URL}/api/warp-pipes/token/${mint}`, {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    throw new Error("Failed to fetch token details")
  }

  return response.json()
}
