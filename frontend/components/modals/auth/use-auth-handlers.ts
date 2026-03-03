import { useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { validatePassword } from "@/components/auth/password-strength-indicator"
import type { AuthView } from "./shared"

interface AuthHandlers {
  isLoading: boolean
  error: string | null
  success: string | null
  currentView: AuthView
  password: string
  confirmPassword: string
  focusedField: string | null
  walletConnected: string | null
  setPassword: (v: string) => void
  setConfirmPassword: (v: string) => void
  setFocusedField: (v: string | null) => void
  switchView: (view: AuthView) => void
  handleLogin: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleRegister: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleForgotPassword: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleWalletConnect: (address: string) => void
  handleWalletDisconnect: () => void
}

export function useAuthHandlers(onClose: () => void): AuthHandlers {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AuthView>("login")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState<string | null>(null)

  const { login, signup } = useAuth()

  const clearMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const switchView = useCallback((view: AuthView) => {
    clearMessages()
    setCurrentView(view)
    setPassword("")
    setConfirmPassword("")
  }, [clearMessages])

  const handleWalletConnect = useCallback((walletAddress: string) => {
    setWalletConnected(walletAddress)
    setSuccess(`Wallet connected: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`)
  }, [])

  const handleWalletDisconnect = useCallback(() => {
    setWalletConnected(null)
    setSuccess(null)
  }, [])

  const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    clearMessages()

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const pw = formData.get("password") as string

    if (!email || !pw) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    try {
      await login(email, pw)
      onClose()
      setSuccess("Login successful! Welcome back.")
      e.currentTarget.reset()
    } catch (err) {
      const caughtError = err as Error
      const msg = caughtError.message || "Login failed"

      if (msg.includes("locked") || msg.includes("too many")) {
        setError("Your account has been temporarily locked due to multiple failed login attempts. Please try again in 15 minutes or reset your password.")
      } else if (msg.includes("credentials") || msg.includes("password")) {
        setError("Invalid email or password. Please check your credentials and try again.")
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [login, onClose, clearMessages])

  const handleRegister = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
      onClose()
      setSuccess("Account created successfully! Please check your email to verify your account.")
      e.currentTarget.reset()
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      const caughtError = err as Error
      setError(caughtError.message || "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }, [signup, onClose, clearMessages])

  const handleForgotPassword = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
  }, [clearMessages])

  return {
    isLoading,
    error,
    success,
    currentView,
    password,
    confirmPassword,
    focusedField,
    walletConnected,
    setPassword,
    setConfirmPassword,
    setFocusedField,
    switchView,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleWalletConnect,
    handleWalletDisconnect,
  }
}
