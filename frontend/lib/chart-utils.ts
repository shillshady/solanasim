/**
 * Utility to fix timezone issues with TradingView and other chart components
 * Addresses the "unsupported timezone" warnings
 */
import { errorLogger } from './error-logger'

/**
 * Maps unsupported timezone strings to supported ones
 */
const TIMEZONE_MAP: Record<string, string> = {
  'America/Denver': 'America/Chicago', // Mountain Time -> Central Time
  'America/Phoenix': 'America/Los_Angeles', // Arizona -> Pacific Time
  'US/Mountain': 'America/Chicago',
  'US/Central': 'America/Chicago',
  'US/Eastern': 'America/New_York',
  'US/Pacific': 'America/Los_Angeles',
  'UTC': 'Etc/UTC',
  'GMT': 'Etc/GMT',
}

/**
 * Gets a supported timezone for TradingView/financial charts
 * Falls back to UTC if the timezone is not supported
 */
export function getSupportedTimezone(timezone?: string): string {
  if (!timezone) {
    return 'Etc/UTC'
  }

  // Check if the timezone is directly supported
  try {
    const supported = Intl.supportedValuesOf('timeZone')
    if (supported.includes(timezone)) {
      return timezone
    }
  } catch (err) {
    errorLogger.warn('Intl.supportedValuesOf not available, using fallback', { component: 'chart-utils' })
  }

  // Use mapping for known unsupported timezones
  if (TIMEZONE_MAP[timezone]) {
    return TIMEZONE_MAP[timezone]
  }

  // Default fallback
  errorLogger.warn(`Unsupported timezone "${timezone}", falling back to UTC`, { component: 'chart-utils' })
  return 'Etc/UTC'
}

/**
 * Gets the user's current timezone in a format supported by financial charts
 */
export function getUserTimezone(): string {
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return getSupportedTimezone(userTimezone)
  } catch (err) {
    errorLogger.warn('Failed to get user timezone, falling back to UTC', { component: 'chart-utils' })
    return 'Etc/UTC'
  }
}

/**
 * Fixes symbolInfo objects for TradingView compatibility
 * Call this before passing symbolInfo to TradingView components
 */
export function fixSymbolInfoTimezone(symbolInfo: any): any {
  if (symbolInfo && symbolInfo.timezone) {
    symbolInfo.timezone = getSupportedTimezone(symbolInfo.timezone)
  }
  return symbolInfo
}

/**
 * Utility to add passive event listeners (fixes touch warnings)
 */
export function addPassiveEventListener(
  element: Element | Window | Document,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): void {
  const passiveOptions = typeof options === 'object' 
    ? { ...options, passive: true }
    : { passive: true }
  
  element.addEventListener(event, handler, passiveOptions)
}

/**
 * Safe way to remove event listeners
 */
export function removeEventListener(
  element: Element | Window | Document,
  event: string,
  handler: EventListener,
  options?: boolean | EventListenerOptions
): void {
  element.removeEventListener(event, handler, options)
}