"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeClosed } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  type AuthFormProps,
  containerVariants,
  itemVariants,
  AnimatedInput,
  GradientSubmitButton,
  OrDivider,
} from "./shared"

interface SignInFormProps extends AuthFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onSwitchToRegister: () => void
  onSwitchToForgotPassword: () => void
}

export function SignInForm({
  isLoading,
  focusedField,
  onFocusChange,
  inputClasses,
  inputWithToggleClasses,
  onSubmit,
  onSwitchToRegister,
  onSwitchToForgotPassword,
}: SignInFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <motion.form
      key="login"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-4"
      onSubmit={onSubmit}
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
          onFocusChange={onFocusChange}
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
            onFocus={() => onFocusChange("login-password")}
            onBlur={() => onFocusChange(null)}
          >
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="--------"
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
          onClick={onSwitchToForgotPassword}
          className="text-sm text-teal-500 hover:text-teal-400 transition-colors font-medium"
          disabled={isLoading}
        >
          Forgot password?
        </button>
      </motion.div>

      {/* Submit */}
      <motion.div variants={itemVariants}>
        <GradientSubmitButton
          isLoading={isLoading}
          loadingText="Signing in..."
          text="Sign in"
        />
      </motion.div>

      {/* Divider */}
      <OrDivider />

      {/* Toggle to register */}
      <motion.p
        variants={itemVariants}
        className="text-center text-sm text-muted-foreground"
      >
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-teal-500 hover:text-teal-400 font-medium transition-colors"
        >
          Sign up
        </button>
      </motion.p>
    </motion.form>
  )
}
