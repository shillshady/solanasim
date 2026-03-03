"use client"

import type React from "react"
import { motion, AnimatePresence, useMotionValue } from "framer-motion"
import { TrendingUp, AlertCircle, CheckCircle } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  type AuthView,
  FloatingParticles,
  INPUT_CLASSES,
  INPUT_WITH_TOGGLE_CLASSES,
} from "./auth/shared"
import { useAuthHandlers } from "./auth/use-auth-handlers"
import { SignInForm } from "./auth/sign-in-form"
import { SignUpForm } from "./auth/sign-up-form"
import { ForgotPasswordForm, ResetSuccessView } from "./auth/forgot-password-form"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ---- View copy maps ---- */
const VIEW_TITLES: Record<AuthView, string> = {
  login: "Sign in to Solana Sim",
  register: "Create a Solana Sim account",
  "forgot-password": "Reset your password",
  "reset-success": "Check your email",
}

const VIEW_DESCRIPTIONS: Record<AuthView, string> = {
  login: "Enter your email and password to sign in.",
  register: "Create a new account to start paper trading on Solana.",
  "forgot-password": "Enter your email to receive password reset instructions.",
  "reset-success": "Password reset instructions have been sent.",
}

const VIEW_HEADINGS: Record<AuthView, string> = {
  login: "Welcome back",
  register: "Create account",
  "forgot-password": "Reset password",
  "reset-success": "Check your email",
}

const VIEW_SUBHEADINGS: Record<AuthView, string> = {
  login: "Sign in to your Solana Sim account",
  register: "Start your paper trading journey on Solana",
  "forgot-password": "We'll send you a link to reset your password",
  "reset-success": "Password reset instructions have been sent",
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const auth = useAuthHandlers(() => onOpenChange(false))
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const formProps = {
    isLoading: auth.isLoading,
    focusedField: auth.focusedField,
    onFocusChange: auth.setFocusedField,
    error: auth.error,
    inputClasses: INPUT_CLASSES,
    inputWithToggleClasses: INPUT_WITH_TOGGLE_CLASSES,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[92vw] max-w-[440px] mx-auto p-0 border-0 bg-transparent shadow-none overflow-visible"
      >
        <DialogTitle className="sr-only">{VIEW_TITLES[auth.currentView]}</DialogTitle>
        <DialogDescription className="sr-only">{VIEW_DESCRIPTIONS[auth.currentView]}</DialogDescription>

        <motion.div
          onMouseMove={handleMouseMove}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="relative group">
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-teal-500/20 via-purple-500/15 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <FloatingParticles />

            <div className="relative bg-[var(--background)] dark:bg-[var(--background)]/95 backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

              {/* Close button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>

              <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto scrollbar-none">
                {/* Logo + Title */}
                <motion.div
                  className="text-center mb-6"
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 }}
                >
                  <motion.div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-purple-500/15 border border-teal-500/20 mb-4"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <TrendingUp className="w-6 h-6 text-teal-400" />
                  </motion.div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={auth.currentView}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        {VIEW_HEADINGS[auth.currentView]}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {VIEW_SUBHEADINGS[auth.currentView]}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                {/* Error / Success messages */}
                <AnimatePresence>
                  {auth.error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <span className="text-red-400 font-medium leading-snug">{String(auth.error)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {auth.success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-emerald-400 font-medium leading-snug">{auth.success}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* View forms */}
                <AnimatePresence mode="wait">
                  {auth.currentView === "forgot-password" && (
                    <ForgotPasswordForm
                      {...formProps}
                      onSubmit={auth.handleForgotPassword}
                      onSwitchToLogin={() => auth.switchView("login")}
                    />
                  )}

                  {auth.currentView === "reset-success" && (
                    <ResetSuccessView onSwitchToLogin={() => auth.switchView("login")} />
                  )}

                  {auth.currentView === "login" && (
                    <SignInForm
                      {...formProps}
                      onSubmit={auth.handleLogin}
                      onSwitchToRegister={() => auth.switchView("register")}
                      onSwitchToForgotPassword={() => auth.switchView("forgot-password")}
                    />
                  )}

                  {auth.currentView === "register" && (
                    <SignUpForm
                      {...formProps}
                      password={auth.password}
                      confirmPassword={auth.confirmPassword}
                      onPasswordChange={auth.setPassword}
                      onConfirmPasswordChange={auth.setConfirmPassword}
                      onSubmit={auth.handleRegister}
                      onSwitchToLogin={() => auth.switchView("login")}
                      onWalletConnect={auth.handleWalletConnect}
                      onWalletDisconnect={auth.handleWalletDisconnect}
                      walletConnected={auth.walletConnected}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
