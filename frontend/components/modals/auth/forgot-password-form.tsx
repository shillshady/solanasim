"use client"

import type React from "react"
import { motion } from "framer-motion"
import { Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  type AuthFormProps,
  containerVariants,
  itemVariants,
  AnimatedInput,
  GradientSubmitButton,
} from "./shared"

interface ForgotPasswordFormProps extends AuthFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onSwitchToLogin: () => void
}

export function ForgotPasswordForm({
  isLoading,
  focusedField,
  onFocusChange,
  inputClasses,
  onSubmit,
  onSwitchToLogin,
}: ForgotPasswordFormProps) {
  return (
    <motion.form
      key="forgot"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-4"
      onSubmit={onSubmit}
    >
      <motion.div variants={itemVariants}>
        <button
          type="button"
          onClick={onSwitchToLogin}
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
          onFocusChange={onFocusChange}
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
        <GradientSubmitButton
          isLoading={isLoading}
          loadingText="Sending..."
          text="Send Reset Link"
        />
      </motion.div>
    </motion.form>
  )
}

/* ------------------------------------------------------------------ */
/*  Reset success view                                                 */
/* ------------------------------------------------------------------ */

interface ResetSuccessViewProps {
  onSwitchToLogin: () => void
}

export function ResetSuccessView({ onSwitchToLogin }: ResetSuccessViewProps) {
  return (
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
          We&apos;ve sent password reset instructions to your email address.
        </p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <motion.button
          type="button"
          onClick={onSwitchToLogin}
          className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--muted)] hover:bg-[var(--muted)]/80 border border-[var(--border)] rounded-xl text-sm text-foreground font-medium transition-all duration-200"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
