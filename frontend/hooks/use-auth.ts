"use client"

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as api from '@/lib/api'
import { isTokenValid } from '@/lib/jwt-utils'
import { errorLogger } from '@/lib/error-logger'

interface AuthUser {
  id: string
  email: string
  handle?: string
  emailVerified?: boolean
  profileImage?: string
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<any>
  signup: (email: string, password: string, username?: string) => Promise<any>
  logout: () => void
  updateProfile: (updates: {
    handle?: string
    profileImage?: string
    bio?: string
    displayName?: string
    avatar?: string
    twitter?: string
    discord?: string
    telegram?: string
    website?: string
  }) => Promise<void>
  getUserId: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function clearAuthStorage() {
  localStorage.removeItem('userId')
  localStorage.removeItem('user')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })

  useEffect(() => {
    const savedUserId = localStorage.getItem('userId')
    const savedUser = localStorage.getItem('user')
    const accessToken = localStorage.getItem('accessToken')

    if (savedUserId && savedUser && accessToken) {
      try {
        if (!isTokenValid(accessToken)) {
          errorLogger.info('Token expired, clearing session', { component: 'useAuth' })
          clearAuthStorage()
          setAuthState({ user: null, isLoading: false, isAuthenticated: false })
          return
        }

        const user = JSON.parse(savedUser)
        setAuthState({
          user: { id: savedUserId, ...user },
          isLoading: false,
          isAuthenticated: true
        })
      } catch (error) {
        errorLogger.error('Error validating token', { error: error as Error, component: 'useAuth' })
        clearAuthStorage()
        setAuthState({ user: null, isLoading: false, isAuthenticated: false })
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const invalidateUserQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['notes'] })
  }, [queryClient])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.loginEmail({ email, password })
    const user: AuthUser = {
      id: response.userId,
      email,
      emailVerified: response.user.emailVerified
    }

    localStorage.setItem('userId', response.userId)
    localStorage.setItem('user', JSON.stringify(user))
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken)
    }

    flushSync(() => {
      setAuthState({ user, isLoading: false, isAuthenticated: true })
    })

    invalidateUserQueries()
    return response
  }, [invalidateUserQueries])

  const signup = useCallback(async (email: string, password: string, username?: string) => {
    const response = await api.signupEmail({ email, password, username })
    const user: AuthUser = {
      id: response.userId,
      email,
      handle: username,
      emailVerified: response.user.emailVerified
    }

    localStorage.setItem('userId', response.userId)
    localStorage.setItem('user', JSON.stringify(user))
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken)
    }

    flushSync(() => {
      setAuthState({ user, isLoading: false, isAuthenticated: true })
    })

    invalidateUserQueries()
    return response
  }, [invalidateUserQueries])

  const logout = useCallback(() => {
    clearAuthStorage()
    setAuthState({ user: null, isLoading: false, isAuthenticated: false })
  }, [])

  const updateProfile = useCallback(async (updates: {
    handle?: string
    profileImage?: string
    bio?: string
    displayName?: string
    avatar?: string
    twitter?: string
    discord?: string
    telegram?: string
    website?: string
  }) => {
    if (!authState.user) throw new Error('Not authenticated')

    await api.updateProfile({
      userId: authState.user.id,
      handle: updates.handle,
      profileImage: updates.profileImage,
      bio: updates.bio,
    })

    const updatedUser = { ...authState.user, ...updates }
    localStorage.setItem('user', JSON.stringify(updatedUser))

    setAuthState(prev => ({ ...prev, user: updatedUser }))
  }, [authState.user])

  const value: AuthContextValue = {
    ...authState,
    login,
    signup,
    logout,
    updateProfile,
    getUserId: () => authState.user?.id || null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
