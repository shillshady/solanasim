"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Loader2, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "@/hooks/use-debounce"
import { useClickOutside } from "@/hooks/use-click-outside"
import * as api from "@/lib/api"
import * as Backend from "@/lib/types/backend"
// Percentage formatting now inline

// Use the backend type for consistency
type TokenSearchResult = Backend.TokenSearchResult

export function TokenSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TokenSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Search tokens based on query
  const searchTokens = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await api.searchTokens(searchQuery)
      setResults(searchResults)
      setShowResults(true)
    } catch (error) {
      import('@/lib/error-logger').then(({ errorLogger }) => {
        errorLogger.error('Token search failed', {
          error: error as Error,
          action: 'token_search_failed',
          metadata: { searchQuery }
        })
      })
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Search when debounced query changes
  useEffect(() => {
    searchTokens(debouncedQuery)
  }, [debouncedQuery, searchTokens])

  // Handle token selection
  const handleTokenSelect = useCallback((tokenAddress: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('token', tokenAddress)
    router.push(`/trade?${currentParams.toString()}`)
    setShowResults(false)
    setQuery("")
  }, [router, searchParams])

  // Hide results when clicking outside using custom hook
  useClickOutside(
    searchContainerRef,
    () => setShowResults(false),
    showResults
  )

  return (
    <div className="relative" ref={searchContainerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tokens..."
          className="pl-9 bg-card border-border focus:border-primary transition-colors"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowResults(true)
          }}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results */}
      {showResults && results.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-80 overflow-y-auto glass-overlay">
          <div className="p-2 space-y-1">
            {results.map((token) => (
              <Button
                key={token.address}
                variant="ghost"
                className="w-full justify-start h-auto p-3"
                onClick={() => token.address && handleTokenSelect(token.address)}
              >
                <div className="flex items-center gap-3 w-full">
                  {(token.imageUrl || token.logoURI) && (
                    <img 
                      src={token.imageUrl || token.logoURI || ''} 
                      alt={`${token.symbol || token.name || 'Token'} logo`}
                      className="w-8 h-8 rounded-full"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.symbol}</span>
                      {token.trending && (
                        <Badge variant="secondary" className="text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {token.name}
                    </div>
                    {token.address && (
                      <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
                        {token.address.slice(0, 4)}...{token.address.slice(-4)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      ${token.price ? (token.price / 1e9).toFixed(8) : 'N/A'}
                    </div>
                    {token.priceChange24h !== undefined && token.priceChange24h !== null && (
                      <div 
                        className={`text-xs ${
                          token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                        aria-label={`Price ${token.priceChange24h >= 0 ? 'increase' : 'decrease'} ${Math.abs(token.priceChange24h).toFixed(2)} percent in 24 hours`}
                      >
                        {token.priceChange24h >= 0 ? '▲' : '▼'} {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* No Results */}
      {showResults && query && !isSearching && results.length === 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 glass-overlay">
          <div className="p-4 text-center text-muted-foreground">
            No tokens found for "{query}"
          </div>
        </Card>
      )}
    </div>
  )
}
