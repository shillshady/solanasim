/**
 * Token Card Component - Industrial brutalist layout
 *
 * Clean horizontal card matching TestNet design system:
 * - Token logo at left
 * - Symbol and name
 * - Large market cap display
 * - 24h change with color coding
 * - Volume and Market Cap row
 * - Industrial flat styling
 */

"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type { TokenRow } from "@/lib/types/token-radar"

interface TokenCardProps {
  data: TokenRow
  onToggleWatch?: (mint: string, isWatched: boolean) => Promise<void>
  className?: string
}

// --------- UTILITIES ---------
const fmtCurrency = (n?: number | null) =>
  n == null ? "—" : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${Math.round(n)}`;

const fmtPct = (n?: number | null, digits = 1) => (n == null ? "—" : `${n.toFixed(digits)}%`);

const timeAgo = (iso?: string | null) => {
  try {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return "—";
  }
};

const shorten = (addr?: string | null, s = 4, e = 4) => {
  if (!addr) return "—";
  return addr.length <= s + e ? addr : `${addr.slice(0, s)}…${addr.slice(-e)}`;
};

const stateColors = (state: TokenRow["state"]) => {
  switch (state) {
    case "bonded":
      return {
        ring: "#fcd34d",
        gradFrom: "#fde68a",
        gradTo: "#facc15",
      };
    case "graduating":
      return {
        ring: "#34d399",
        gradFrom: "#bbf7d0",
        gradTo: "#10b981",
      };
    default:
      return {
        ring: "#60a5fa",
        gradFrom: "#bfdbfe",
        gradTo: "#60a5fa",
      };
  }
};

const securityBadge = (freezeRevoked?: boolean | null, mintRenounced?: boolean | null) => {
  if (freezeRevoked && mintRenounced)
    return { label: "SAFE", cls: "bg-profit/10 text-profit border-profit" };
  if (freezeRevoked || mintRenounced)
    return { label: "WARN", cls: "bg-primary/10 text-primary border-primary" };
  return { label: "RISK", cls: "bg-loss/10 text-loss border-loss" };
};

export function TokenCard({ data, onToggleWatch, className }: TokenCardProps) {
  const img = data.imageUrl || data.logoURI || undefined;
  const priceChg = data.priceChange24h ?? null;
  const [imageError, setImageError] = useState(false);
  const security = securityBadge(data.freezeRevoked, data.mintRenounced);
  const age = timeAgo(data.firstSeenAt);

  const handleToggleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWatch) {
      onToggleWatch(data.mint, data.isWatched || false);
    }
  };

  return (
    <Link href={`/room/${data.mint}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={cn("w-full", className)}
      >
        {/* Horizontal Layout Token Card - Industrial Style */}
        <div className="relative overflow-hidden bg-card border border-border hover:border-border-hover transition-all duration-150 cursor-pointer">
          <div className="flex items-center gap-4 p-4">

            {/* LEFT: Token Logo */}
            <div className="relative shrink-0 w-20 h-20 overflow-hidden border border-border">
              {img && !imageError ? (
                <img
                  src={img}
                  alt={data.symbol}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full grid place-items-center bg-secondary text-foreground text-4xl font-bold">🪙</div>
              )}
            </div>

            {/* MIDDLE: Token Info */}
            <div className="flex-1 min-w-0">
              {/* Top Row: Symbol, Name, Age */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-mono font-bold text-[20px] text-foreground uppercase tracking-wider">
                  {data.symbol}
                </h3>
                <span className="text-[14px] text-muted-foreground truncate max-w-[150px]" title={data.name || undefined}>
                  {data.name}
                </span>
                <span className="text-[12px] text-muted-foreground ml-auto font-mono">
                  {age}
                </span>
              </div>

              {/* Description (if available, truncated) */}
              {data.description && (
                <div className="text-[11px] text-muted-foreground mb-1 truncate max-w-[300px]" title={data.description}>
                  {data.description}
                </div>
              )}

              {/* Middle Row: Stats and Badges */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Status Badge */}
                {data.status && (
                  <div className={cn(
                    "px-2 py-0.5 border text-[11px] font-mono font-bold uppercase",
                    data.status === 'LAUNCHING' && "bg-secondary text-foreground border-border",
                    data.status === 'ACTIVE' && "bg-profit/10 text-profit border-profit",
                    data.status === 'ABOUT_TO_BOND' && "bg-primary/10 text-primary border-primary",
                    data.status === 'BONDED' && "bg-primary/10 text-primary border-primary",
                    data.status === 'DEAD' && "bg-loss/10 text-loss border-loss"
                  )}>
                    {data.status === 'ABOUT_TO_BOND' ? '🔥 ABOUT TO BOND' : data.status}
                  </div>
                )}

                {/* Security Badge */}
                <div className={cn(
                  "px-2 py-0.5 border text-[11px] font-mono font-bold uppercase",
                  security.cls
                )}>
                  {security.label}
                </div>

                {/* Bonding Progress (if available) */}
                {data.bondingCurveProgress != null && (
                  <div className="flex items-center gap-1 text-[12px]">
                    <span className="text-muted-foreground">⚡</span>
                    <span className="font-mono font-bold text-foreground">
                      {data.bondingCurveProgress.toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Holder Count */}
                {data.holderCount != null && (
                  <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <span>👥</span>
                    <span className="font-mono font-bold">{data.holderCount}</span>
                  </div>
                )}

                {/* Transaction Count */}
                {data.txCount24h != null && (
                  <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <span>📝</span>
                    <span className="font-mono font-bold">{data.txCount24h}</span>
                  </div>
                )}
              </div>

              {/* SOL to Graduate Progress Bar - Only for ABOUT_TO_BOND */}
              {data.status === 'ABOUT_TO_BOND' && data.bondingCurveProgress != null && data.solToGraduate != null && (
                <div className="mt-2 relative">
                  <div className="bg-muted border border-border h-5 overflow-hidden relative">
                    <div
                      className="bg-primary h-full flex items-center justify-center transition-all duration-500 relative"
                      style={{ width: `${Math.min(data.bondingCurveProgress, 100)}%` }}
                    >
                      <span className="text-[10px] font-mono font-bold text-primary-foreground z-10 relative">
                        🎯 {data.solToGraduate.toFixed(1)} SOL to bond
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Row: Social Links & Creator */}
              <div className="flex items-center gap-3 mt-1">
                {/* Social Links */}
                {(data.twitter || data.telegram || data.website) && (
                  <div className="flex items-center gap-2.5">
                    {data.twitter && (
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <a
                            href={data.twitter.startsWith('http') ? data.twitter : `https://twitter.com/${data.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Image
                              src="/x-logo/logo.svg"
                              alt="X/Twitter"
                              width={20}
                              height={20}
                              className="inline-block"
                            />
                          </a>
                        </HoverCardTrigger>
                        <HoverCardContent
                          className="w-80 p-4 bg-card border border-border z-50"
                          side="top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-mono font-bold text-xl border border-border">
                                {data.symbol?.[0] || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono font-bold text-base truncate text-foreground">{data.name || data.symbol}</div>
                                <div className="text-sm text-muted-foreground truncate">@{data.twitter}</div>
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3 text-foreground">{data.description || 'No description available'}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground font-bold">
                              <span>Click to view on X →</span>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    {data.telegram && (
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <a
                            href={data.telegram.startsWith('http') ? data.telegram : `https://t.me/${data.telegram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Image
                              src="/icons/social/telegram-icon.svg"
                              alt="Telegram"
                              width={20}
                              height={20}
                              className="inline-block"
                            />
                          </a>
                        </HoverCardTrigger>
                        <HoverCardContent
                          className="w-80 p-4 bg-card border border-border z-50"
                          side="top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl border border-border">
                                ✈️
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono font-bold text-base truncate text-foreground">{data.name || data.symbol}</div>
                                <div className="text-sm text-muted-foreground truncate">{data.telegram}</div>
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3 text-foreground">{data.description || 'Join the Telegram community'}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground font-bold">
                              <span>Click to join Telegram →</span>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    {data.website && (
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <a
                            href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Image
                              src="/icons/social/globe-icon.svg"
                              alt="Website"
                              width={20}
                              height={20}
                              className="inline-block"
                            />
                          </a>
                        </HoverCardTrigger>
                        <HoverCardContent
                          className="w-80 p-4 bg-card border border-border z-50"
                          side="top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl border border-border">
                                🌐
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono font-bold text-base truncate text-foreground">{data.name || data.symbol}</div>
                                <div className="text-sm text-muted-foreground truncate break-all">{data.website}</div>
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3 text-foreground">{data.description || 'Visit official website'}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground font-bold">
                              <span>Click to visit website →</span>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </div>
                )}

                {/* Creator Wallet */}
                {data.creatorWallet && (
                  <div className="text-[10px] text-muted-foreground font-mono ml-auto" title={data.creatorWallet}>
                    👨‍💻 {shorten(data.creatorWallet, 3, 3)}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Price & Volume */}
            <div className="text-right shrink-0">
              {/* Market Cap */}
              <div className="mb-1">
                <div className="text-[11px] text-muted-foreground font-mono uppercase">MC</div>
                <div className="text-[18px] font-mono font-bold text-foreground">
                  {fmtCurrency(data.marketCapUsd)}
                </div>
              </div>

              {/* Volume - USD and SOL */}
              <div className="mb-2">
                <div className="text-[11px] text-muted-foreground font-mono uppercase">Vol 24h</div>
                <div className="text-[14px] font-mono font-bold text-foreground">
                  {fmtCurrency(data.volume24h)}
                </div>
                {data.volume24hSol != null && data.volume24hSol > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {data.volume24hSol.toFixed(2)} SOL
                  </div>
                )}
              </div>

              {/* 24h Change */}
              {priceChg != null && (
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 border",
                  priceChg >= 0 ? "bg-profit text-primary-foreground border-profit" : "bg-loss text-white border-loss"
                )}>
                  <span className="font-mono font-bold text-[13px]">
                    {priceChg >= 0 ? "+" : ""}{priceChg.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/**
 * Token Card Skeleton - Loading state
 */
export function TokenCardSkeleton() {
  return (
    <div className="w-full">
      <div className="overflow-hidden bg-card border border-border animate-pulse">
        <div className="flex items-center gap-4 p-4">
          {/* Logo skeleton */}
          <div className="w-20 h-20 bg-muted border border-border" />

          {/* Middle content skeleton */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 bg-muted w-20" />
              <div className="h-4 bg-muted opacity-60 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-12 bg-muted" />
              <div className="h-4 w-16 bg-muted opacity-60" />
            </div>
          </div>

          {/* Right content skeleton */}
          <div className="text-right shrink-0">
            <div className="h-4 bg-muted opacity-60 w-16 mb-1 ml-auto" />
            <div className="h-5 bg-muted w-20 mb-2 ml-auto" />
            <div className="h-7 w-16 bg-muted border border-border ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
