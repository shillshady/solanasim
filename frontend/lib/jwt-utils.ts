// JWT utility functions for token validation
import { jwtDecode } from 'jwt-decode'
import { errorLogger } from './error-logger'

interface JWTPayload {
  userId: string
  userTier: string
  sessionId: string
  type: 'access' | 'refresh'
  iat: number
  exp: number
}

/**
 * Decode a JWT token and extract payload
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwtDecode<JWTPayload>(token)
  } catch (error) {
    errorLogger.error('Failed to decode token', { error: error as Error, component: 'jwt-utils' })
    return null
  }
}

/**
 * Check if a JWT token is expired
 * @param token - JWT token string
 * @returns true if expired, false if valid
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload || !payload.exp) {
    return true // Treat invalid tokens as expired
  }

  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Date.now() / 1000
  const bufferTime = 60 // 60 second buffer before actual expiry

  return payload.exp < (currentTime + bufferTime)
}

/**
 * Get remaining time until token expiry in seconds
 * @param token - JWT token string
 * @returns Seconds until expiry, or 0 if expired/invalid
 */
export function getTokenExpiryTime(token: string): number {
  const payload = decodeToken(token)
  if (!payload || !payload.exp) {
    return 0
  }

  const currentTime = Date.now() / 1000
  const remaining = payload.exp - currentTime

  return Math.max(0, Math.floor(remaining))
}

/**
 * Validate token structure and expiry
 * @param token - JWT token string
 * @returns true if valid and not expired
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false

  const payload = decodeToken(token)
  if (!payload) return false

  return !isTokenExpired(token)
}
