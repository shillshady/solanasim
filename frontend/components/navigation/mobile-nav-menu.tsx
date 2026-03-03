"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Menu, Settings, LogOut, Bell,
  TrendingUp, Wallet, Gift, Home
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Notification as AppNotification } from "@/hooks/use-notifications"

const navigationItems = [
  { name: "Dashboard", href: "/", icon: Home, description: "Overview of your trading activity" },
  { name: "Trade", href: "/trade", icon: TrendingUp, description: "Buy and sell tokens" },
  { name: "Portfolio", href: "/portfolio", icon: Wallet, description: "Track your positions and P&L" },
  { name: "Trending", href: "/trending", icon: TrendingUp, description: "Discover popular tokens" },
  { name: "Rewards", href: "/rewards", icon: Gift, description: "Earn points and claim rewards" },
]

interface MobileNavMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAuthenticated: boolean
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  onLogout: () => void
}

export function MobileNavMenu({
  open,
  onOpenChange,
  isAuthenticated,
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  onLogout,
}: MobileNavMenuProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="md:hidden border-2 border-border bg-background hover:bg-muted"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <div className="flex flex-col space-y-4 mt-4">
          {/* Notifications Section */}
          {isAuthenticated && (
            <div className="space-y-2 pb-4 border-b">
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge className="h-5 px-1.5 text-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="h-7 text-xs px-2"
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {notifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id)
                        }
                      }}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted",
                        !notification.read && "bg-primary/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-medium truncate",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation Items */}
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link key={item.href} href={item.href} onClick={() => onOpenChange(false)}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                    isActive ? "bg-brand-muted text-brand" : "hover:bg-muted"
                  )}>
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Profile Section */}
          {isAuthenticated && (
            <div className="space-y-2 pt-4 border-t">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                ACCOUNT
              </div>
              <Link href="/profile/settings" onClick={() => onOpenChange(false)}>
                <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors">
                  <Settings className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-muted-foreground">Manage your account</div>
                  </div>
                </div>
              </Link>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors text-red-600"
              >
                <LogOut className="h-5 w-5" />
                <div>
                  <div className="font-medium">Logout</div>
                  <div className="text-xs text-muted-foreground">Sign out of your account</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
