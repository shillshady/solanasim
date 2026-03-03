"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, User, Eye, EyeClosed, Wallet, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator"
import {
  type AuthFormProps,
  containerVariants,
  itemVariants,
  AnimatedInput,
  GradientSubmitButton,
  OrDivider,
} from "./shared"

interface SignUpFormProps extends AuthFormProps {
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onSwitchToLogin: () => void
  onWalletConnect: (address: string) => void
  onWalletDisconnect: () => void
  walletConnected: string | null
}

export function SignUpForm({
  isLoading,
  focusedField,
  onFocusChange,
  inputClasses,
  inputWithToggleClasses,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchToLogin,
  onWalletConnect,
  onWalletDisconnect,
  walletConnected,
}: SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <motion.form
      key="register"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-3.5"
      onSubmit={onSubmit}
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
          onFocusChange={onFocusChange}
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
          onFocusChange={onFocusChange}
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
            onFocus={() => onFocusChange("register-password")}
            onBlur={() => onFocusChange(null)}
          >
            <Input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="--------"
              className={inputWithToggleClasses}
              required
              minLength={8}
              disabled={isLoading}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
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
            onFocus={() => onFocusChange("register-confirm")}
            onBlur={() => onFocusChange(null)}
          >
            <Input
              id="register-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="--------"
              className={inputWithToggleClasses}
              required
              disabled={isLoading}
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
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
            onWalletConnected={onWalletConnect}
            onWalletDisconnected={onWalletDisconnect}
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
        <GradientSubmitButton
          isLoading={isLoading}
          loadingText="Creating account..."
          text="Create Account"
        />
      </motion.div>

      <motion.p variants={itemVariants} className="text-xs text-center text-muted-foreground px-2">
        By registering, you agree to our Terms of Service and Privacy Policy
      </motion.p>

      {/* Divider */}
      <OrDivider />

      {/* Toggle to login */}
      <motion.p
        variants={itemVariants}
        className="text-center text-sm text-muted-foreground"
      >
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-teal-500 hover:text-teal-400 font-medium transition-colors"
        >
          Sign in
        </button>
      </motion.p>
    </motion.form>
  )
}
