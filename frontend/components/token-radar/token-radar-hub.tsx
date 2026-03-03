/**
 * Token Radar Hub - Main client component
 *
 * Full-width 3-column layout for token discovery (New Pairs | About to Graduate | Bonded)
 * Mobile: Tab-based layout
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TokenColumn } from "./token-column"
import { useTokenRadarFeed, useAddTokenWatch, useRemoveTokenWatch } from "@/hooks/use-token-radar"
import { useAuth } from "@/hooks/use-auth"
import type { AdvancedFilters, TokenRow } from "@/lib/types/token-radar"
import { getDefaultFilters } from "@/lib/token-radar-filter-presets"

const STORAGE_KEYS = {
  NEW: 'token-radar-new-filters',
  GRADUATING: 'token-radar-graduating-filters',
  BONDED: 'token-radar-bonded-filters',
}

// Load filters from localStorage with fallback to defaults
function loadFilters(key: string, category: 'new' | 'graduating' | 'bonded'): AdvancedFilters {
  if (typeof window === 'undefined') return getDefaultFilters(category)

  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that parsed data is a valid AdvancedFilters object
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    }
  } catch (error) {
    console.warn(`Failed to load filters from ${key}:`, error)
    // Clear corrupted data
    try {
      localStorage.removeItem(key)
    } catch (clearError) {
      console.warn(`Failed to clear corrupted filters from ${key}:`, clearError)
    }
  }

  return getDefaultFilters(category)
}

// Save filters to localStorage
function saveFilters(key: string, filters: AdvancedFilters) {
  if (typeof window === 'undefined') return

  try {
    // Only save if filters have actual values (not just empty object)
    if (filters && Object.keys(filters).length > 0) {
      localStorage.setItem(key, JSON.stringify(filters))
    } else {
      // Remove empty filters from storage
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn(`Failed to save filters to ${key}:`, error)
  }
}

export function TokenRadarHub() {
  const { isAuthenticated } = useAuth()

  // Per-column filter state - start with defaults, load from localStorage in useEffect
  const [newFilters, setNewFilters] = useState<AdvancedFilters>(getDefaultFilters('new'))
  const [graduatingFilters, setGraduatingFilters] = useState<AdvancedFilters>(getDefaultFilters('graduating'))
  const [bondedFilters, setBondedFilters] = useState<AdvancedFilters>(getDefaultFilters('bonded'))
  const [isFiltersLoaded, setIsFiltersLoaded] = useState(false)

  // Load filters from localStorage on mount (client-side only)
  useEffect(() => {
    setNewFilters(loadFilters(STORAGE_KEYS.NEW, 'new'))
    setGraduatingFilters(loadFilters(STORAGE_KEYS.GRADUATING, 'graduating'))
    setBondedFilters(loadFilters(STORAGE_KEYS.BONDED, 'bonded'))
    setIsFiltersLoaded(true)
  }, [])

  // Save filters to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (isFiltersLoaded) {
      saveFilters(STORAGE_KEYS.NEW, newFilters)
    }
  }, [newFilters, isFiltersLoaded])

  useEffect(() => {
    if (isFiltersLoaded) {
      saveFilters(STORAGE_KEYS.GRADUATING, graduatingFilters)
    }
  }, [graduatingFilters, isFiltersLoaded])

  useEffect(() => {
    if (isFiltersLoaded) {
      saveFilters(STORAGE_KEYS.BONDED, bondedFilters)
    }
  }, [bondedFilters, isFiltersLoaded])

  // Fetch feed data - filters are applied per-column on the client side
  const { data, isLoading, error, refetch } = useTokenRadarFeed({
    searchQuery: "",
    sortBy: "volume",
    // Don't apply filters here - they're applied per-column in client-side filtering
  })

  // Watch mutations
  const addWatch = useAddTokenWatch()
  const removeWatch = useRemoveTokenWatch()

  // Handle watch toggle
  const handleToggleWatch = async (mint: string, isCurrentlyWatched: boolean) => {
    if (!isAuthenticated) {
      alert("Please sign in to watch tokens")
      return
    }

    try {
      if (isCurrentlyWatched) {
        await removeWatch.mutateAsync(mint)
      } else {
        await addWatch.mutateAsync({ mint })
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error)
      alert("Failed to update watchlist. Please try again.")
    }
  }

  // Helper function to apply filters to tokens
  const applyFilters = (tokens: TokenRow[], filters: AdvancedFilters) => {
    if (!filters || Object.keys(filters).length === 0) return tokens

    return tokens.filter((token) => {
      // Audit filters - map to actual TokenRow properties
      // Note: Some filters may not have direct property mappings in TokenRow
      if (filters.minAge !== undefined && token.firstSeenAt) {
        const ageMinutes = (Date.now() - new Date(token.firstSeenAt).getTime()) / 60000
        if (ageMinutes < filters.minAge) return false
      }
      if (filters.maxAge !== undefined && token.firstSeenAt) {
        const ageMinutes = (Date.now() - new Date(token.firstSeenAt).getTime()) / 60000
        if (ageMinutes > filters.maxAge) return false
      }

      // Metric filters - use TokenRow property names
      if (filters.minLiquidityUsd !== undefined && token.liqUsd && token.liqUsd < filters.minLiquidityUsd) return false
      if (filters.maxLiquidityUsd !== undefined && token.liqUsd && token.liqUsd > filters.maxLiquidityUsd) return false
      if (filters.minMarketCap !== undefined && token.marketCapUsd && token.marketCapUsd < filters.minMarketCap) return false
      if (filters.maxMarketCap !== undefined && token.marketCapUsd && token.marketCapUsd > filters.maxMarketCap) return false
      if (filters.minVolume24h !== undefined && token.volume24h && token.volume24h < filters.minVolume24h) return false
      if (filters.maxVolume24h !== undefined && token.volume24h && token.volume24h > filters.maxVolume24h) return false

      // Social filters - check for presence of social links
      if (filters.requireTwitter && !token.twitter) return false
      if (filters.requireTelegram && !token.telegram) return false
      if (filters.requireWebsite && !token.website) return false

      // Bonding curve filters - use bondingCurveProgress (0-100)
      if (filters.minBondingProgress !== undefined && token.bondingCurveProgress != null && token.bondingCurveProgress < filters.minBondingProgress) return false
      if (filters.maxBondingProgress !== undefined && token.bondingCurveProgress != null && token.bondingCurveProgress > filters.maxBondingProgress) return false
      if (filters.minSolToGraduate !== undefined && token.solToGraduate != null && token.solToGraduate < filters.minSolToGraduate) return false
      if (filters.maxSolToGraduate !== undefined && token.solToGraduate != null && token.solToGraduate > filters.maxSolToGraduate) return false

      return true
    })
  }

  // Filter and sort tokens per-column
  const { bonded, graduating, newTokens } = useMemo(() => {
    if (!data) {
      return { bonded: [], graduating: [], newTokens: [] }
    }

    return {
      bonded: applyFilters(data.bonded || [], bondedFilters),
      graduating: applyFilters(data.graduating || [], graduatingFilters),
      newTokens: applyFilters(data.new || [], newFilters),
    }
  }, [data, bondedFilters, graduatingFilters, newFilters])

  return (
    <div className="w-full flex flex-col bg-background" style={{
      height: 'calc(100dvh - var(--navbar-height, 56px) - var(--trending-ticker-height, 60px) - var(--bottom-nav-height, 64px))',
      maxHeight: 'calc(100dvh - var(--navbar-height, 56px) - var(--trending-ticker-height, 60px) - var(--bottom-nav-height, 64px))',
      overflow: 'hidden'
    }}>
      {/* Error State */}
      {error && (
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <Alert variant="destructive" className="border border-destructive bg-card">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-foreground font-mono text-sm">Failed to load tokens. Please try again.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="ml-4 border border-border bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs uppercase"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Desktop: 3-Column Layout - Reordered: New Pairs | About to Graduate | Bonded */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6 px-6 py-6 flex-1 min-h-0">
        <TokenColumn
          title="NEW PAIRS"
          tokens={newTokens}
          isLoading={isLoading}
          onToggleWatch={handleToggleWatch}
          filters={newFilters}
          onFiltersChange={setNewFilters}
          headerColor="new"
        />
        <TokenColumn
          title="ABOUT TO GRADUATE"
          tokens={graduating}
          isLoading={isLoading}
          onToggleWatch={handleToggleWatch}
          filters={graduatingFilters}
          onFiltersChange={setGraduatingFilters}
          headerColor="graduating"
        />
        <TokenColumn
          title="BONDED"
          tokens={bonded}
          isLoading={isLoading}
          onToggleWatch={handleToggleWatch}
          filters={bondedFilters}
          onFiltersChange={setBondedFilters}
          headerColor="bonded"
        />
      </div>

      {/* Mobile: Tabs Layout */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 px-4 py-6">
        <Tabs defaultValue="new" className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4 border border-border bg-card p-1">
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs uppercase tracking-wider transition-all"
            >
              New ({newTokens.length})
            </TabsTrigger>
            <TabsTrigger
              value="graduating"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs uppercase tracking-wider transition-all"
            >
              Graduate ({graduating.length})
            </TabsTrigger>
            <TabsTrigger
              value="bonded"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs uppercase tracking-wider transition-all"
            >
              Bonded ({bonded.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 min-h-0 mt-0">
            <TokenColumn
              title="NEW PAIRS"
              tokens={newTokens}
              isLoading={isLoading}
              onToggleWatch={handleToggleWatch}
              filters={newFilters}
              onFiltersChange={setNewFilters}
              headerColor="new"
            />
          </TabsContent>

          <TabsContent value="graduating" className="flex-1 min-h-0 mt-0">
            <TokenColumn
              title="ABOUT TO GRADUATE"
              tokens={graduating}
              isLoading={isLoading}
              onToggleWatch={handleToggleWatch}
              filters={graduatingFilters}
              onFiltersChange={setGraduatingFilters}
              headerColor="graduating"
            />
          </TabsContent>

          <TabsContent value="bonded" className="flex-1 min-h-0 mt-0">
            <TokenColumn
              title="BONDED"
              tokens={bonded}
              isLoading={isLoading}
              onToggleWatch={handleToggleWatch}
              filters={bondedFilters}
              onFiltersChange={setBondedFilters}
              headerColor="bonded"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-center font-mono text-sm font-bold text-foreground">Loading Token Radar...</p>
            <p className="text-center text-muted-foreground text-xs mt-2">Discovering tokens...</p>
          </div>
        </div>
      )}
    </div>
  )
}
