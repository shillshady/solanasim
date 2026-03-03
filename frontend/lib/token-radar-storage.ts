/**
 * Token Radar Filter Storage
 *
 * localStorage helpers for persisting filter preferences across page reloads
 * Includes backward compatibility for migrating old warp-pipes keys
 */

import type { AdvancedFilters } from './types/token-radar';
import { errorLogger } from './error-logger';

const STORAGE_KEYS = {
  NEW_FILTERS: 'token-radar-new-filters',
  GRADUATING_FILTERS: 'token-radar-graduating-filters',
  BONDED_FILTERS: 'token-radar-bonded-filters',
} as const;

// Old keys for migration
const OLD_STORAGE_KEYS = {
  NEW_FILTERS: 'warp-pipes-new-filters',
  GRADUATING_FILTERS: 'warp-pipes-graduating-filters',
  BONDED_FILTERS: 'warp-pipes-bonded-filters',
} as const;

/**
 * Migrate old warp-pipes keys to token-radar keys
 */
function migrateOldKeys(): void {
  if (typeof window === 'undefined') return;

  try {
    // Check if migration already done
    const migrationKey = 'token-radar-migrated';
    if (localStorage.getItem(migrationKey)) return;

    // Migrate each key
    Object.entries(OLD_STORAGE_KEYS).forEach(([key, oldKey]) => {
      const newKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
      const oldValue = localStorage.getItem(oldKey);

      if (oldValue && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, oldValue);
        localStorage.removeItem(oldKey);
      }
    });

    // Mark migration as done
    localStorage.setItem(migrationKey, 'true');
  } catch (error) {
    errorLogger.warn('Failed to migrate old filter keys', { error: error as Error, component: 'token-radar-storage' });
  }
}

// Run migration on module load
if (typeof window !== 'undefined') {
  migrateOldKeys();
}

/**
 * Save filter preferences for a specific category
 */
export function saveFilters(category: 'new' | 'graduating' | 'bonded', filters: AdvancedFilters): void {
  try {
    const key = getStorageKey(category);
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    errorLogger.warn('Failed to save filters to localStorage', { error: error as Error, component: 'token-radar-storage' });
  }
}

/**
 * Load filter preferences for a specific category
 */
export function loadFilters(category: 'new' | 'graduating' | 'bonded'): AdvancedFilters | null {
  try {
    const key = getStorageKey(category);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    errorLogger.warn('Failed to load filters from localStorage', { error: error as Error, component: 'token-radar-storage' });
    return null;
  }
}

/**
 * Clear filter preferences for a specific category
 */
export function clearFilters(category: 'new' | 'graduating' | 'bonded'): void {
  try {
    const key = getStorageKey(category);
    localStorage.removeItem(key);
  } catch (error) {
    errorLogger.warn('Failed to clear filters from localStorage', { error: error as Error, component: 'token-radar-storage' });
  }
}

/**
 * Clear all filter preferences
 */
export function clearAllFilters(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    errorLogger.warn('Failed to clear all filters from localStorage', { error: error as Error, component: 'token-radar-storage' });
  }
}

/**
 * Export filter preferences as JSON string
 */
export function exportFilters(category: 'new' | 'graduating' | 'bonded'): string | null {
  try {
    const filters = loadFilters(category);
    if (!filters) return null;

    return JSON.stringify({
      category,
      filters,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }, null, 2);
  } catch (error) {
    errorLogger.warn('Failed to export filters', { error: error as Error, component: 'token-radar-storage' });
    return null;
  }
}

/**
 * Import filter preferences from JSON string
 */
export function importFilters(jsonString: string): { category: string; filters: AdvancedFilters } | null {
  try {
    const data = JSON.parse(jsonString);

    // Validate the imported data structure
    if (!data.category || !data.filters) {
      throw new Error('Invalid filter data structure');
    }

    // Validate category
    if (!['new', 'graduating', 'bonded'].includes(data.category)) {
      throw new Error('Invalid category');
    }

    return {
      category: data.category,
      filters: data.filters as AdvancedFilters,
    };
  } catch (error) {
    errorLogger.warn('Failed to import filters', { error: error as Error, component: 'token-radar-storage' });
    return null;
  }
}

/**
 * Get the localStorage key for a category
 */
function getStorageKey(category: 'new' | 'graduating' | 'bonded'): string {
  switch (category) {
    case 'new':
      return STORAGE_KEYS.NEW_FILTERS;
    case 'graduating':
      return STORAGE_KEYS.GRADUATING_FILTERS;
    case 'bonded':
      return STORAGE_KEYS.BONDED_FILTERS;
    default:
      throw new Error(`Invalid category: ${category}`);
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { used: number; available: boolean } {
  const available = isStorageAvailable();
  let used = 0;

  if (available) {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      });
    } catch (error) {
      errorLogger.warn('Failed to calculate storage usage', { error: error as Error, component: 'token-radar-storage' });
    }
  }

  return { used, available };
}
