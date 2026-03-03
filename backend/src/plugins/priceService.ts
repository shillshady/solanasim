// Price service - re-exports the optimized implementation
// The actual implementation is in priceService/ directory

import optimizedPriceService from "./priceService/index.js";

// Re-export the singleton instance
export default optimizedPriceService;

// Re-export types for consumers that need them
export type { PriceTick, NegativeCacheEntry } from "./priceService/index.js";
