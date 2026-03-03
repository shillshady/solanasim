"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/modals/auth-modal"
import { cn } from "@/lib/utils"

interface AuthCTAProps {
  message: string
  description?: string
  variant: "inline" | "banner" | "card"
  icon?: React.ReactNode
  buttonLabel?: string
  className?: string
}

export function AuthCTA({
  message,
  description,
  variant,
  icon,
  buttonLabel = "Sign In",
  className,
}: AuthCTAProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)

  const defaultIcon = icon ?? <LogIn className="h-5 w-5" />

  if (variant === "inline") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={className}
        >
          <Button
            className="w-full h-16 sm:h-14 text-lg sm:text-base font-bold gap-2"
            size="lg"
            onClick={() => setShowAuthModal(true)}
          >
            {defaultIcon}
            {message}
          </Button>
        </motion.div>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </>
    )
  }

  if (variant === "banner") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex items-center gap-4 p-4 rounded-lg border border-primary/20 bg-primary/5",
            className,
          )}
        >
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10 text-primary">
            {defaultIcon}
          </div>
          <p className="flex-1 text-sm font-medium">{message}</p>
          <Button size="sm" onClick={() => setShowAuthModal(true)}>
            {buttonLabel}
          </Button>
        </motion.div>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </>
    )
  }

  // card variant
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-6 text-center rounded-lg border border-border bg-card",
          className,
        )}
      >
        <div className="p-3 rounded-full bg-primary/10 text-primary mb-4">
          {defaultIcon}
        </div>
        <h3 className="text-lg font-semibold mb-1">{message}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {description}
          </p>
        )}
        {!description && <div className="mb-6" />}
        <Button onClick={() => setShowAuthModal(true)} className="gap-2">
          <LogIn className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </motion.div>
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  )
}
