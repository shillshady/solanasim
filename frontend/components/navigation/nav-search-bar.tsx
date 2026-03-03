"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { useDebounce } from "@/hooks/use-debounce"
import * as api from "@/lib/api"
import type { TokenSearchResult } from "@/lib/types/backend"
import { formatSolEquivalent } from "@/lib/sol-equivalent-utils"

interface NavSearchBarProps {
  solPrice: number
  onTokenSelect?: () => void
}

export function NavSearchBar({ solPrice, onTokenSelect }: NavSearchBarProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [mounted, setMounted] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setIsSearching(true)

    try {
      const results = await api.searchTokens(query.trim(), 8)

      if (!abortControllerRef.current.signal.aborted) {
        setSearchResults(results)
        setShowResults(true)
      }
    } catch {
      if (!abortControllerRef.current.signal.aborted) {
        setSearchResults([])
        setShowResults(false)
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsSearching(false)
      }
    }
  }, [])

  useEffect(() => {
    performSearch(debouncedQuery)
  }, [debouncedQuery, performSearch])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isInsideSearchInput = searchRef.current?.contains(target)
      const isInsideSearchResults = searchResultsRef.current?.contains(target)

      if (!isInsideSearchInput && !isInsideSearchResults) {
        setShowResults(false)
      }
    }

    if (showResults) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showResults])

  const handleTokenSelect = useCallback((token: TokenSearchResult) => {
    router.push(`/trade?token=${token.mint}&symbol=${token.symbol}&name=${encodeURIComponent(token.name)}`)
    setSearchQuery('')
    setShowResults(false)
    onTokenSelect?.()
  }, [router, onTokenSelect])

  return (
    <div className="hidden md:flex flex-1 max-w-sm mx-4 relative" ref={searchRef}>
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 w-full border border-border hover:border-brand/40 focus:border-brand transition-colors"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results Portal */}
      {mounted && showResults && searchResults.length > 0 && searchRef.current && createPortal(
        <motion.div
          ref={searchResultsRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            position: 'fixed',
            top: searchRef.current.getBoundingClientRect().bottom + 8,
            left: searchRef.current.getBoundingClientRect().left,
            width: searchRef.current.getBoundingClientRect().width,
          }}
          className="bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/90 text-foreground border rounded-[0.25rem] shadow-md z-[100] max-h-80 overflow-y-auto"
        >
          <div className="p-2">
            <div className="text-xs text-muted-foreground px-2 py-2 font-semibold border-b border-border mb-1 uppercase tracking-wide">
              Search Results
            </div>
            {searchResults.map((token) => (
              <button
                key={token.mint}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleTokenSelect(token)
                }}
                className="w-full text-left px-3 py-2.5 rounded-sm hover:bg-muted transition-colors duration-150 focus:bg-muted focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-7 h-7 rounded-sm flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {token.name}
                      </div>
                    </div>
                  </div>
                  {token.price && (
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-sm font-medium text-foreground tabular-nums">
                        ${parseFloat(token.price.toString()).toFixed(6)}
                      </div>
                      {solPrice > 0 && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatSolEquivalent(parseFloat(token.price.toString()), solPrice)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  )
}
