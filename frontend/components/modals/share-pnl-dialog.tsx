"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Share2, Download, Copy, Check, Loader2 } from "lucide-react"
import { toPng, toBlob } from "html-to-image"

interface SharePnLDialogProps {
  totalPnL: number
  totalPnLPercent: number
  currentValue: number
  initialBalance: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  userHandle?: string
  userAvatarUrl?: string
  userEmail?: string
  // Optional token-specific data
  tokenSymbol?: string
  tokenName?: string
  isTokenSpecific?: boolean
}

export function SharePnLDialog({ totalPnL, totalPnLPercent, currentValue, initialBalance, open: externalOpen, onOpenChange: externalOnOpenChange, userHandle, userAvatarUrl, userEmail, tokenSymbol, tokenName, isTokenSpecific }: SharePnLDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    if (!cardRef.current || isGenerating) return

    try {
      setIsGenerating(true)
      // Give more time for animations to settle
      await new Promise((resolve) => setTimeout(resolve, 300))

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      })

      const link = document.createElement("a")
      link.download = `solanasim-pnl-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to download PnL image:', error)
      import('@/lib/error-logger').then(({ errorLogger }) => {
        errorLogger.error('Failed to download PnL image', {
          error: error as Error,
          action: 'pnl_image_download_failed',
          metadata: { component: 'SharePnLDialog' }
        })
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!cardRef.current || isGenerating) return

    try {
      setIsGenerating(true)
      // Give more time for animations to settle
      await new Promise((resolve) => setTimeout(resolve, 300))

      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      })

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy PnL image:', error)
      import('@/lib/error-logger').then(({ errorLogger }) => {
        errorLogger.error('Failed to copy PnL image', {
          error: error as Error,
          action: 'pnl_image_copy_failed',
          metadata: { component: 'SharePnLDialog' }
        })
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          <Share2 className="h-4 w-4" />
          Share PnL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share Your Performance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shareable Card - Modern Redesign */}
          <div
            ref={cardRef}
            className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] p-5 border border-white/5"
          >
            {/* Enhanced Background Effects */}
            <div className="absolute inset-0">
              {/* Gradient orbs */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-gradient-to-tr from-blue-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

              {/* Grid pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
            </div>

            {/* Content Container */}
            <div className="relative z-10 h-full flex flex-col">
              {/* Header with Logo */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="white" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-base font-black text-white tracking-tight">VIRTUALSOL</span>
                    <div className="text-[9px] text-white/40 font-medium">Paper Trading Platform</div>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <span className="text-[9px] font-bold text-primary">LIVE</span>
                </div>
              </div>

              {/* Main Content - Two Column Layout */}
              <div className="flex-1 flex gap-3 mb-2">
                {/* Left: PnL Display */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`relative p-3 rounded-xl border-2 ${
                    totalPnL >= 0
                      ? "bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/30"
                      : "bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500/30"
                  } backdrop-blur-sm`}>
                    <div className="relative">
                      <div className="text-[10px] font-semibold text-white/60 mb-1 uppercase tracking-wider">
                        {isTokenSpecific && tokenSymbol ? `${tokenSymbol}` : 'PNL'}
                      </div>
                      <div className={`text-3xl font-black font-mono mb-1.5 ${
                        totalPnL >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {totalPnL >= 0 ? "+" : ""}${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          totalPnL >= 0
                            ? "bg-green-500/20 text-green-300"
                            : "bg-red-500/20 text-red-300"
                        }`}>
                          {totalPnL >= 0 ? "↗" : "↘"} {totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Stats */}
                <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                    <div className="text-[9px] text-white/50 mb-0.5 uppercase tracking-wide">Invested</div>
                    <div className="text-sm font-bold text-white font-mono">${initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                    <div className="text-[9px] text-white/50 mb-0.5 uppercase tracking-wide">Position</div>
                    <div className="text-sm font-bold text-white font-mono">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>

              {/* User Info Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={userHandle || 'User'}
                      className="w-7 h-7 rounded-full object-cover border border-white/20"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-black text-xs border border-white/20">
                      {(userHandle?.[0] || userEmail?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-white font-bold text-xs">@{userHandle || userEmail?.split('@')[0] || 'trader'}</div>
                    <div className="text-[9px] text-primary font-medium">solanasim.fun</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-white/40">Powered by</div>
                  <div className="text-[10px] font-bold text-primary">SIM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1 gap-2" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download
                </>
              )}
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex-1 gap-2 bg-transparent"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Image
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
