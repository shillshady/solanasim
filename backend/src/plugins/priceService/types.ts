export interface PriceTick {
  mint: string;
  priceUsd: number;
  priceSol?: number;
  solUsd?: number;
  marketCapUsd?: number;
  timestamp: number;
  source: string;
  volume?: number;
  change24h?: number;
}

export interface NegativeCacheEntry {
  timestamp: number;
  reason: string;
}

export interface SwapSignal {
  isSwap: boolean;
  dex: string | null;
  involvedTokens: string[];
}
