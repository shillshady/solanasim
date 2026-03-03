/**
 * Token Radar Filter Presets
 *
 * Default filter configurations for each token category (New, Graduating, Bonded)
 * These provide sensible starting points for users based on the token lifecycle stage.
 */

import type { AdvancedFilters } from './types/token-radar';

/**
 * Default filters for New Pairs (LAUNCHING status)
 * Focus on recent tokens with basic security requirements
 */
export const NEW_PAIRS_DEFAULTS: Partial<AdvancedFilters> = {
  // Audit filters
  minAge: 0,
  maxAge: 60, // Last hour
  dexPaid: false, // Allow unpaid initially for new tokens
  maxTop10Holders: 50, // Allow higher concentration for new tokens

  // $ Metrics filters
  minLiquidityUsd: 1000,
  maxLiquidityUsd: 100000, // Cap at $100k for new tokens
  minMarketCap: 5000,
  maxMarketCap: 500000, // Cap at $500k for new tokens

  // Social filters - not required for new tokens
  requireTwitter: false,
  requireTelegram: false,
  requireWebsite: false,

  // Bonding curve - not applicable for new tokens
  minBondingProgress: 0,
  maxBondingProgress: 0,
};

/**
 * Default filters for About to Graduate tokens (ABOUT_TO_BOND status)
 * Focus on tokens close to graduation with strong security
 */
export const GRADUATING_DEFAULTS: Partial<AdvancedFilters> = {
  // Audit filters
  minAge: 30, // At least 30 minutes old
  maxAge: 1440, // Within 24 hours
  dexPaid: true, // Must be paid for graduation
  maxTop10Holders: 30, // Lower concentration for graduating tokens

  // $ Metrics filters
  minLiquidityUsd: 5000,
  minVolume24h: 2000,
  minMarketCap: 10000,

  // Social filters - prefer tokens with social presence
  requireTwitter: false, // Optional but preferred
  requireTelegram: false,
  requireWebsite: false,

  // Bonding curve filters - key for graduating tokens
  minBondingProgress: 80,
  maxBondingProgress: 99,
  minSolToGraduate: 0.1, // At least 0.1 SOL needed
  maxSolToGraduate: 10, // Cap at 10 SOL needed
};

/**
 * Default filters for Bonded tokens (BONDED status)
 * Focus on established tokens with strong metrics and social presence
 */
export const BONDED_DEFAULTS: Partial<AdvancedFilters> = {
  // Audit filters
  minAge: 60, // At least 1 hour old
  dexPaid: true, // Must be paid for bonded tokens
  maxTop10Holders: 25, // Lower concentration for bonded tokens

  // $ Metrics filters
  minLiquidityUsd: 10000,
  minVolume24h: 5000,
  minMarketCap: 20000,

  // Social filters - prefer established tokens with social presence
  requireTwitter: true, // Strong preference for social presence
  requireTelegram: false, // Optional
  requireWebsite: false, // Optional

  // Bonding curve filters - must be fully graduated
  minBondingProgress: 100,
  maxBondingProgress: 100,
};

/**
 * Preset configurations for different trading strategies
 */
export const TRADING_PRESETS = {
  /**
   * Conservative filters - focus on established, secure tokens
   */
  CONSERVATIVE: {
    dexPaid: true,
    maxTop10Holders: 20,
    minLiquidityUsd: 25000,
    minVolume24h: 10000,
    requireTwitter: true,
    requireWebsite: true,
  } as Partial<AdvancedFilters>,

  /**
   * Aggressive filters - focus on high-potential early tokens
   */
  AGGRESSIVE: {
    maxAge: 120, // Within 2 hours
    maxTop10Holders: 40,
    minLiquidityUsd: 2000,
    minVolume24h: 1000,
    minBondingProgress: 0,
    maxBondingProgress: 50,
  } as Partial<AdvancedFilters>,

  /**
   * Social tokens - focus on tokens with strong community presence
   */
  SOCIAL: {
    requireTwitter: true,
    requireTelegram: true,
    requireWebsite: true,
    minVolume24h: 5000,
  } as Partial<AdvancedFilters>,

  /**
   * High volume - focus on actively traded tokens
   */
  HIGH_VOLUME: {
    minVolume24h: 50000,
    minLiquidityUsd: 100000,
    minMarketCap: 100000,
  } as Partial<AdvancedFilters>,
} as const;

/**
 * Get default filters for a specific category
 * Returns empty filters initially - user configures their own preferences
 */
export function getDefaultFilters(category: 'new' | 'graduating' | 'bonded'): AdvancedFilters {
  // Return empty filters by default - user configures their own
  return {};
}

/**
 * Get trading preset filters
 */
export function getTradingPreset(preset: keyof typeof TRADING_PRESETS): Partial<AdvancedFilters> {
  return TRADING_PRESETS[preset];
}

/**
 * Merge multiple filter configurations
 */
export function mergeFilters(...filters: Partial<AdvancedFilters>[]): Partial<AdvancedFilters> {
  return filters.reduce((acc, filter) => ({ ...acc, ...filter }), {});
}
