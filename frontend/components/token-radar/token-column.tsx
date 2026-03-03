/**
 * Token Column Component - Container for token cards in each state
 *
 * Displays tokens in a vertical scrollable column with industrial header
 * Includes per-column filter panel functionality
 */

"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TokenCard, TokenCardSkeleton } from "./token-card"
import { FilterPanel } from "./filter-panel"
import type { TokenRow, AdvancedFilters } from "@/lib/types/token-radar"

interface TokenColumnProps {
  title: string
  tokens: TokenRow[]
  isLoading?: boolean
  onToggleWatch: (mint: string, isWatched: boolean) => Promise<void>
  filters: AdvancedFilters
  onFiltersChange: (filters: AdvancedFilters) => void
  className?: string
  headerColor?: "bonded" | "graduating" | "new"
}

export function TokenColumn({
  title,
  tokens,
  isLoading,
  onToggleWatch,
  filters,
  onFiltersChange,
  className,
  headerColor = "bonded",
}: TokenColumnProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleFiltersChange = (newFilters: AdvancedFilters) => {
    onFiltersChange(newFilters)
  }

  const handleApplyFilters = () => {
    setFiltersOpen(false)
  }

  // Header colors based on column type - Test Net industrial theme
  const headerColors = {
    bonded: "bg-primary text-primary-foreground",
    graduating: "bg-secondary text-secondary-foreground",
    new: "bg-muted text-foreground",
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Token Column */}
      <div className={cn("flex flex-col h-full min-h-0 border border-border bg-card overflow-hidden")}>
        {/* Column Header */}
        <div
          className={cn(
            "p-4 flex-shrink-0 text-center border-b border-border",
            "flex items-center justify-center",
            headerColors[headerColor]
          )}
        >
          <h2 className="font-mono text-lg uppercase tracking-wider font-bold">
            {title}
          </h2>
        </div>

        {/* Filter Panel - Modal Trigger */}
        <div className="px-3 pt-3 pb-3 flex-shrink-0 bg-card">
          <FilterPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            category={headerColor}
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen(!filtersOpen)}
            onApply={handleApplyFilters}
            headerColor={headerColor}
          />
        </div>

        {/* Column Body - Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-4 min-h-0 scrollbar-none bg-card">
        {/* Loading State */}
        {isLoading && (
          <>
            <TokenCardSkeleton />
            <TokenCardSkeleton />
            <TokenCardSkeleton />
          </>
        )}

        {/* Empty State */}
        {!isLoading && tokens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-card border border-border">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-foreground font-mono text-sm uppercase">No tokens in this column</p>
            <p className="text-sm text-muted-foreground mt-2">Check back soon for new discoveries</p>
          </div>
        )}

        {/* Token Cards - Vertical Stack */}
        {!isLoading && tokens.map((token) => (
          <TokenCard
            key={token.mint}
            data={token}
            onToggleWatch={onToggleWatch}
          />
        ))}
        </div>
      </div>
    </div>
  )
}
