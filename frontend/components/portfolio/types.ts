import type { PortfolioPosition } from '@/lib/types/backend';

export type { PortfolioPosition } from '@/lib/types/backend';

export interface EnhancedPosition extends PortfolioPosition {
  tokenSymbol?: string;
  tokenName?: string;
  tokenImageUrl?: string;
}
