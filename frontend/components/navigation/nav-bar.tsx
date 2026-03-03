"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Settings, LogOut,
  TrendingUp, Wallet,
  ChevronDown, Gift, Home
} from "lucide-react"
import { useState, useCallback } from "react"
import { AuthModal } from "@/components/modals/auth-modal"
import { PurchaseModal } from "@/components/modals/purchase-modal"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { NavSearchBar } from "@/components/navigation/nav-search-bar"
import { MobileNavMenu } from "@/components/navigation/mobile-nav-menu"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/use-auth"
import { useQuery } from "@tanstack/react-query"
import * as api from "@/lib/api"
import { formatUSD } from "@/lib/format"
import { usePriceStreamContext } from "@/lib/price-stream-provider"
import { useNotifications } from "@/hooks/use-notifications"

const navigationItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Trade", href: "/trade", icon: TrendingUp },
  { name: "Portfolio", href: "/portfolio", icon: Wallet },
  { name: "Trending", href: "/trending", icon: TrendingUp },
  { name: "Rewards", href: "/rewards", icon: Gift },
]

export function NavBar() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const { user, isAuthenticated, logout } = useAuth()
  const { prices: livePrices } = usePriceStreamContext()
  const solPrice = livePrices.get('So11111111111111111111111111111111111111112')?.price || 0

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications()

  const { data: balanceData } = useQuery({
    queryKey: ['user-balance', user?.id],
    queryFn: () => api.getWalletBalance(user!.id),
    enabled: !!user,
    staleTime: 30000,
  })

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => user?.id ? api.getUserProfile(user.id) : null,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000
  })

  const profile = userProfile as any
  const displayName = profile?.displayName || profile?.username || user?.email?.split('@')[0] || 'User'
  const avatarUrl = profile?.avatarUrl || profile?.profileImage || profile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=4f46e5`

  const handleLogout = useCallback(() => {
    logout()
    setMobileMenuOpen(false)
  }, [logout])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
    >
      <div className="w-full px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center">
              <Image
                src="/solana-sim-banner-v2.png"
                alt="Solana Sim"
                width={150}
                height={50}
                priority
                className="h-9 w-auto brightness-0 dark:brightness-100"
              />
            </Link>

            <nav className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 transition-all duration-200",
                        isActive && "bg-brand-muted text-brand font-semibold"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline">{item.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Search Bar */}
          <NavSearchBar solPrice={solPrice} />

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Balance Display */}
                <button
                  onClick={() => setPurchaseModalOpen(true)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer group"
                  aria-label="Purchase simulated SOL"
                >
                  <Wallet className="h-4 w-4 text-brand group-hover:scale-110 transition-transform" />
                  <div className="text-sm">
                    <div className="font-semibold text-foreground">
                      {balanceData ? `${parseFloat(balanceData.balance).toFixed(2)} SOL` : 'Loading...'}
                    </div>
                    {solPrice > 0 && balanceData && (
                      <div className="hidden sm:block text-xs text-foreground/60">
                        {formatUSD(parseFloat(balanceData.balance) * solPrice)}
                      </div>
                    )}
                  </div>
                </button>

                {/* Notifications */}
                <div className="hidden md:block">
                  <NotificationDropdown />
                </div>

                {/* User Menu */}
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2 px-3">
                        <Avatar className="h-6 w-6 rounded-md border border-border">
                          <AvatarImage src={avatarUrl} alt={displayName} className="rounded-md" />
                          <AvatarFallback className="bg-primary/10 text-xs rounded-md">
                            {displayName?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:inline font-medium">
                          {displayName}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/profile/settings" className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              <Button
                onClick={() => setAuthModalOpen(true)}
                className="font-semibold bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Sign In
              </Button>
            )}

            {/* Mobile Menu */}
            <MobileNavMenu
              open={mobileMenuOpen}
              onOpenChange={setMobileMenuOpen}
              isAuthenticated={isAuthenticated}
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markAsRead}
              markAllAsRead={markAllAsRead}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      {isAuthenticated && user && (
        <PurchaseModal
          open={purchaseModalOpen}
          onOpenChange={setPurchaseModalOpen}
          userId={user.id}
        />
      )}
    </motion.header>
  )
}