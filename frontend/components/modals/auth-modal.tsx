"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence, useMotionValue, type Variants } from "framer-motion"
import {
  Mail, Lock, User, Eye, EyeClosed, ArrowRight, ArrowLeft,
  TrendingUp, AlertCircle, CheckCircle, Wallet
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import { PasswordStrengthIndicator, validatePassword } from "@/components/auth/password-strength-indicator"
/* cn available from @/lib/utils if needed */

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-success'

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
}

/* ------------------------------------------------------------------ */
/*  Floating particles background                                      */
/* ------------------------------------------------------------------ */

function FloatingParticles() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: i % 2 === 0
              ? "rgba(45, 212, 191, 0.35)"
              : "rgba(168, 85, 247, 0.35)",
            left: `${15 + i * 22}%`,
            top: `${8 + i * 18}%`,
          }}
          animate={{
            x: [0, 80 + i * 20, 40, 0],
            y: [0, 40 + i * 15, 90, 0],
            opacity: [0, 0.8, 0.4, 0],
          }}
          transition={{
            duration: 7 + i * 2,
            repeat: Infinity,
            ease: "linear",
            delay: i * 1.5,
          }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated input wrapper                                             */
/* ------------------------------------------------------------------ */

function AnimatedInput({
  icon: Icon,
  focusedField,
  fieldName,
  onFocusChange,
  children,
}: {
  icon: React.ElementType
  focusedField: string | null
  fieldName: string
  onFocusChange: (field: string | null) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative group/input">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-teal-400 transition-colors duration-200 z-10 pointer-events-none" />
      <div
        onFocus={() => onFocusChange(fieldName)}
        onBlur={() => onFocusChange(null)}
      >
        {children}
      </div>
      {focusedField === fieldName && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-teal-500/30 pointer-events-none"
          layoutId="auth-focus-ring"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AuthView>("login")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const { login, signup } = useAuth()
  const [walletConnected, setWalletConnected] = useState<string | null>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const switchView = (view: AuthView) => {
    clearMessages()
    setCurrentView(view)
    setPassword("")
    setConfirmPassword("")
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  /* ---- Wallet handlers ---- */
  const handleWalletConnect = async (walletAddress: string) => {
    setWalletConnected(walletAddress)
    setSuccess(`Wallet connected: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`)
  }

  const handleWalletDisconnect = () => {
    setWalletConnected(null)
    setSuccess(null)
  }

  /* ---- Login ---- */
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    clearMessages()

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    try {
      await login(email, password)
      onOpenChange(false)
      setSuccess("Login successful! Welcome back.")
      e.currentTarget.reset()
    } catch (err) {
      const error = err as Error
      const errorMessage = error.message || "Login failed"

      if (errorMessage.includes("locked") || errorMessage.includes("too many")) {
        setError("Your account has been temporarily locked due to multiple failed login attempts. Please try again in 15 minutes or reset your password.")
      } else if (errorMessage.includes("credentials") || errorMessage.includes("password")) {
        setError("Invalid email or password. Please check your credentials and try again.")
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  /* ---- Register ---- */
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    clearMessages()

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const pw = formData.get("password") as string
    const cpw = formData.get("confirmPassword") as string
    const username = formData.get("username") as string

    if (!email || !pw || !username) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    if (pw !== cpw) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters long")
      setIsLoading(false)
      return
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(pw)) {
      setError("Password must be 8+ characters with uppercase, lowercase, number, and special character")
      setIsLoading(false)
      return
    }

    const passwordValidation = validatePassword(pw)
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0])
      setIsLoading(false)
      return
    }

    try {
      await signup(email, pw, username.trim())
      onOpenChange(false)
      setSuccess("Account created successfully! Please check your email to verify your account.")
      e.currentTarget.reset()
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      const error = err as Error
      setError(error.message || "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  /* ---- Forgot password ---- */
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    clearMessages()

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string

    if (!email) {
      setError("Please enter your email address")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      if (response.ok || data.success) {
        setSuccess("Password reset instructions have been sent to your email address")
        setCurrentView("reset-success")
      } else {
        setSuccess("If an account exists with this email, you will receive password reset instructions")
        setCurrentView("reset-success")
      }
    } catch {
      setSuccess("If an account exists with this email, you will receive password reset instructions")
      setCurrentView("reset-success")
    } finally {
      setIsLoading(false)
    }
  }

  /* ---- Shared input classes ---- */
  const inputClasses = "w-full h-11 pl-10 pr-4 bg-[var(--card)]/50 border border-[var(--border)] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/25 transition-all duration-200"
  const inputWithToggleClasses = "w-full h-11 pl-10 pr-11 bg-[var(--card)]/50 border border-[var(--border)] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/25 transition-all duration-200"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[92vw] max-w-[440px] mx-auto p-0 border-0 bg-transparent shadow-none overflow-visible"
      >
        {/* Accessible hidden title for screen readers */}
        <DialogTitle className="sr-only">
          {currentView === "login" && "Sign in to Solana Sim"}
          {currentView === "register" && "Create a Solana Sim account"}
          {currentView === "forgot-password" && "Reset your password"}
          {currentView === "reset-success" && "Check your email"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {currentView === "login" && "Enter your email and password to sign in."}
          {currentView === "register" && "Create a new account to start paper trading on Solana."}
          {currentView === "forgot-password" && "Enter your email to receive password reset instructions."}
          {currentView === "reset-success" && "Password reset instructions have been sent."}
        </DialogDescription>

        <motion.div
          onMouseMove={handleMouseMove}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="relative group">
            {/* Gradient border glow on hover */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-teal-500/20 via-purple-500/15 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <FloatingParticles />

            {/* Main card */}
            <div className="relative bg-[var(--background)] dark:bg-[var(--background)]/95 backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
              {/* Gradient top accent line */}
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
                {/* ============================================ */}
                {/*  Logo + Title                                */}
                {/* ============================================ */}
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
                      key={currentView}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        {currentView === "login" && "Welcome back"}
                        {currentView === "register" && "Create account"}
                        {currentView === "forgot-password" && "Reset password"}
                        {currentView === "reset-success" && "Check your email"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {currentView === "login" && "Sign in to your Solana Sim account"}
                        {currentView === "register" && "Start your paper trading journey on Solana"}
                        {currentView === "forgot-password" && "We'll send you a link to reset your password"}
                        {currentView === "reset-success" && "Password reset instructions have been sent"}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                {/* ============================================ */}
                {/*  Error / Success messages                    */}
                {/* ============================================ */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <span className="text-red-400 font-medium leading-snug">{String(error)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-emerald-400 font-medium leading-snug">{success}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ============================================ */}
                {/*  FORGOT PASSWORD VIEW                       */}
                {/* ============================================ */}
                <AnimatePresence mode="wait">
                  {currentView === "forgot-password" && (
                    <motion.form
                      key="forgot"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-4"
                      onSubmit={handleForgotPassword}
                    >
                      <motion.div variants={itemVariants}>
                        <button
                          type="button"
                          onClick={() => switchView("login")}
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to sign in
                        </button>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-foreground mb-1.5">
                          Email address
                        </label>
                        <AnimatedInput
                          icon={Mail}
                          focusedField={focusedField}
                          fieldName="reset-email"
                          onFocusChange={setFocusedField}
                        >
                          <Input
                            id="reset-email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClasses}
                            required
                            disabled={isLoading}
                          />
                        </AnimatedInput>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <motion.button
                          type="submit"
                          disabled={isLoading}
                          className="relative w-full h-11 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-medium rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                          whileHover={isLoading ? {} : { scale: 1.01 }}
                          whileTap={isLoading ? {} : { scale: 0.99 }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? "Sending..." : "Send Reset Link"}
                            {!isLoading && (
                              <motion.span
                                animate={{ x: [0, 3, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ArrowRight className="w-4 h-4" />
                              </motion.span>
                            )}
                          </span>
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-teal-500 to-purple-500"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        </motion.button>
                      </motion.div>
                    </motion.form>
                  )}

                  {/* ============================================ */}
                  {/*  RESET SUCCESS VIEW                         */}
                  {/* ============================================ */}
                  {currentView === "reset-success" && (
                    <motion.div
                      key="reset-success"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6 text-center py-4"
                    >
                      <motion.div variants={itemVariants} className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <CheckCircle className="w-8 h-8 text-emerald-400" />
                        </div>
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
                        <p className="text-sm text-muted-foreground">
                          We've sent password reset instructions to your email address.
                        </p>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <motion.button
                          type="button"
                          onClick={() => switchView("login")}
                          className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--muted)] hover:bg-[var(--muted)]/80 border border-[var(--border)] rounded-xl text-sm text-foreground font-medium transition-all duration-200"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Sign In
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* ============================================ */}
                  {/*  LOGIN VIEW                                  */}
                  {/* ============================================ */}
                  {currentView === "login" && (
                    <motion.form
                      key="login"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-4"
                      onSubmit={handleLogin}
                    >
                      {/* Email */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1.5">
                          Email
                        </label>
                        <AnimatedInput
                          icon={Mail}
                          focusedField={focusedField}
                          fieldName="login-email"
                          onFocusChange={setFocusedField}
                        >
                          <Input
                            id="login-email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClasses}
                            required
                            disabled={isLoading}
                          />
                        </AnimatedInput>
                      </motion.div>

                      {/* Password */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-1.5">
                          Password
                        </label>
                        <div className="relative group/input">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-teal-400 transition-colors duration-200 z-10 pointer-events-none" />
                          <div
                            onFocus={() => setFocusedField("login-password")}
                            onBlur={() => setFocusedField(null)}
                          >
                            <Input
                              id="login-password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className={inputWithToggleClasses}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                            tabIndex={-1}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={showPassword ? "visible" : "hidden"}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.12 }}
                              >
                                {showPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </motion.div>
                            </AnimatePresence>
                          </button>
                          {focusedField === "login-password" && (
                            <motion.div
                              className="absolute inset-0 rounded-xl border border-teal-500/30 pointer-events-none"
                              layoutId="auth-focus-ring"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                        </div>
                      </motion.div>

                      {/* Forgot password */}
                      <motion.div variants={itemVariants} className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => switchView("forgot-password")}
                          className="text-sm text-teal-500 hover:text-teal-400 transition-colors font-medium"
                          disabled={isLoading}
                        >
                          Forgot password?
                        </button>
                      </motion.div>

                      {/* Submit */}
                      <motion.div variants={itemVariants}>
                        <motion.button
                          type="submit"
                          disabled={isLoading}
                          className="relative w-full h-11 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-medium rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                          whileHover={isLoading ? {} : { scale: 1.01 }}
                          whileTap={isLoading ? {} : { scale: 0.99 }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? "Signing in..." : "Sign in"}
                            {!isLoading && (
                              <motion.span
                                animate={{ x: [0, 3, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ArrowRight className="w-4 h-4" />
                              </motion.span>
                            )}
                          </span>
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-teal-500 to-purple-500"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        </motion.button>
                      </motion.div>

                      {/* Divider */}
                      <motion.div variants={itemVariants} className="relative flex items-center gap-3 py-1">
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--border)]" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--border)]" />
                      </motion.div>

                      {/* Toggle to register */}
                      <motion.p
                        variants={itemVariants}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => switchView("register")}
                          className="text-teal-500 hover:text-teal-400 font-medium transition-colors"
                        >
                          Sign up
                        </button>
                      </motion.p>
                    </motion.form>
                  )}

                  {/* ============================================ */}
                  {/*  REGISTER VIEW                               */}
                  {/* ============================================ */}
                  {currentView === "register" && (
                    <motion.form
                      key="register"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-3.5"
                      onSubmit={handleRegister}
                    >
                      {/* Username */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="register-username" className="block text-sm font-medium text-foreground mb-1.5">
                          Username
                        </label>
                        <AnimatedInput
                          icon={User}
                          focusedField={focusedField}
                          fieldName="register-username"
                          onFocusChange={setFocusedField}
                        >
                          <Input
                            id="register-username"
                            name="username"
                            type="text"
                            placeholder="trader123"
                            className={inputClasses}
                            required
                            minLength={3}
                            maxLength={20}
                            disabled={isLoading}
                          />
                        </AnimatedInput>
                      </motion.div>

                      {/* Email */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="register-email" className="block text-sm font-medium text-foreground mb-1.5">
                          Email
                        </label>
                        <AnimatedInput
                          icon={Mail}
                          focusedField={focusedField}
                          fieldName="register-email"
                          onFocusChange={setFocusedField}
                        >
                          <Input
                            id="register-email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClasses}
                            required
                            disabled={isLoading}
                          />
                        </AnimatedInput>
                      </motion.div>

                      {/* Password */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="register-password" className="block text-sm font-medium text-foreground mb-1.5">
                          Password
                        </label>
                        <div className="relative group/input">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-teal-400 transition-colors duration-200 z-10 pointer-events-none" />
                          <div
                            onFocus={() => setFocusedField("register-password")}
                            onBlur={() => setFocusedField(null)}
                          >
                            <Input
                              id="register-password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className={inputWithToggleClasses}
                              required
                              minLength={8}
                              disabled={isLoading}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                            tabIndex={-1}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={showPassword ? "v" : "h"}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.12 }}
                              >
                                {showPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </motion.div>
                            </AnimatePresence>
                          </button>
                          {focusedField === "register-password" && (
                            <motion.div
                              className="absolute inset-0 rounded-xl border border-teal-500/30 pointer-events-none"
                              layoutId="auth-focus-ring"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                        </div>
                      </motion.div>

                      {/* Confirm Password */}
                      <motion.div variants={itemVariants}>
                        <label htmlFor="register-confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                          Confirm Password
                        </label>
                        <div className="relative group/input">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-teal-400 transition-colors duration-200 z-10 pointer-events-none" />
                          <div
                            onFocus={() => setFocusedField("register-confirm")}
                            onBlur={() => setFocusedField(null)}
                          >
                            <Input
                              id="register-confirm-password"
                              name="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className={inputWithToggleClasses}
                              required
                              disabled={isLoading}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                            tabIndex={-1}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={showConfirmPassword ? "v2" : "h2"}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.12 }}
                              >
                                {showConfirmPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </motion.div>
                            </AnimatePresence>
                          </button>
                          {focusedField === "register-confirm" && (
                            <motion.div
                              className="absolute inset-0 rounded-xl border border-teal-500/30 pointer-events-none"
                              layoutId="auth-focus-ring"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                        </div>
                      </motion.div>

                      {/* Password strength */}
                      <AnimatePresence>
                        {password && (
                          <motion.div
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="rounded-xl bg-[var(--muted)]/50 border border-[var(--border)] p-3"
                          >
                            <PasswordStrengthIndicator password={password} confirmPassword={confirmPassword} />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Wallet Connection */}
                      <motion.div variants={itemVariants}>
                        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">Wallet Connection</span>
                            <span className="text-xs text-muted-foreground">(Optional)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Connect your Solana wallet to unlock premium features and higher starting balance.
                          </p>
                          <WalletConnectButton
                            onWalletConnected={handleWalletConnect}
                            onWalletDisconnected={handleWalletDisconnect}
                            size="sm"
                            variant="outline"
                            className="w-full"
                          />
                          <AnimatePresence>
                            {walletConnected && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                  <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Wallet connected - Enhanced tier benefits!
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>

                      {/* Submit */}
                      <motion.div variants={itemVariants}>
                        <motion.button
                          type="submit"
                          disabled={isLoading}
                          className="relative w-full h-11 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-medium rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                          whileHover={isLoading ? {} : { scale: 1.01 }}
                          whileTap={isLoading ? {} : { scale: 0.99 }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? "Creating account..." : "Create Account"}
                            {!isLoading && (
                              <motion.span
                                animate={{ x: [0, 3, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ArrowRight className="w-4 h-4" />
                              </motion.span>
                            )}
                          </span>
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-teal-500 to-purple-500"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        </motion.button>
                      </motion.div>

                      <motion.p variants={itemVariants} className="text-xs text-center text-muted-foreground px-2">
                        By registering, you agree to our Terms of Service and Privacy Policy
                      </motion.p>

                      {/* Divider */}
                      <motion.div variants={itemVariants} className="relative flex items-center gap-3 py-1">
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--border)]" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--border)]" />
                      </motion.div>

                      {/* Toggle to login */}
                      <motion.p
                        variants={itemVariants}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => switchView("login")}
                          className="text-teal-500 hover:text-teal-400 font-medium transition-colors"
                        >
                          Sign in
                        </button>
                      </motion.p>
                    </motion.form>
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
