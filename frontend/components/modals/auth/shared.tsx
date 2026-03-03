"use client"

import type React from "react"
import { motion, type Variants } from "framer-motion"
import { ArrowRight } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-success'

export interface AuthFormProps {
  isLoading: boolean
  focusedField: string | null
  onFocusChange: (field: string | null) => void
  error: string | null
  inputClasses: string
  inputWithToggleClasses: string
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

export const containerVariants: Variants = {
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

export const itemVariants: Variants = {
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
/*  Shared input classes                                               */
/* ------------------------------------------------------------------ */

export const INPUT_CLASSES = "w-full h-11 pl-10 pr-4 bg-[var(--card)]/50 border border-[var(--border)] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/25 transition-all duration-200"

export const INPUT_WITH_TOGGLE_CLASSES = "w-full h-11 pl-10 pr-11 bg-[var(--card)]/50 border border-[var(--border)] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/25 transition-all duration-200"

/* ------------------------------------------------------------------ */
/*  Floating particles background                                      */
/* ------------------------------------------------------------------ */

export function FloatingParticles() {
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

export function AnimatedInput({
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
/*  Gradient submit button                                             */
/* ------------------------------------------------------------------ */

export function GradientSubmitButton({
  isLoading,
  loadingText,
  text,
}: {
  isLoading: boolean
  loadingText: string
  text: string
}) {
  return (
    <motion.button
      type="submit"
      disabled={isLoading}
      className="relative w-full h-11 bg-gradient-to-r from-teal-600 to-purple-600 text-white font-medium rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
      whileHover={isLoading ? {} : { scale: 1.01 }}
      whileTap={isLoading ? {} : { scale: 0.99 }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? loadingText : text}
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
  )
}

/* ------------------------------------------------------------------ */
/*  Divider with "or"                                                  */
/* ------------------------------------------------------------------ */

export function OrDivider() {
  return (
    <motion.div variants={itemVariants} className="relative flex items-center gap-3 py-1">
      <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--border)]" />
      <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
      <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--border)]" />
    </motion.div>
  )
}

