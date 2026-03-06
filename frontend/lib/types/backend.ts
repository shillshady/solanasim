// Backend Types - Matching Prisma Schema and API Responses
// This file contains TypeScript types that match the backend database schema and API responses

// ================================
// Database Model Types (matching Prisma schema)
// ================================

export type UserTier = 'EMAIL_USER' | 'WALLET_USER' | 'VSOL_HOLDER' | 'ADMINISTRATOR';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  
  // Profile information
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  
  // Social media links
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  website: string | null;
  
  // Trading preferences
  virtualSolBalance: string; // Decimal as string
  isProfilePublic: boolean;
  
  // Creator rewards
  solanaWallet: string | null;
  
  // Tier system and wallet verification
  userTier: UserTier;
  walletAddress: string | null;
  walletVerified: boolean;
  vsolTokenBalance: string | null; // Decimal as string
  vsolBalanceUpdated: string | null; // DateTime as ISO string
  monthlyConversions: string; // Decimal as string
  conversionResetAt: string | null; // DateTime as ISO string
  premiumFeatures: string | null; // JSON array as string
  
  // Timestamps
  createdAt: string; // DateTime as ISO string
  updatedAt: string; // DateTime as ISO string
}

export interface Trade {
  id: string;
  userId: string;
  username?: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  action: string; // 'BUY' or 'SELL'
  quantity: string; // Decimal as string
  price: string; // Decimal as string - Price per token in USD
  totalCost: string; // Decimal as string - Total cost in SOL
  realizedPnL: string | null; // Decimal as string - For sell trades only
  marketCapUsd: string | null; // Decimal as string
  timestamp: string; // DateTime as ISO string
}

export interface Holding {
  id: string;
  userId: string;
  username?: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenImageUrl: string | null;
  entryPrice: string; // Decimal as string - Entry price in USD per token
  quantity: string; // Decimal as string
  avgBuyMarketCap: string | null; // Decimal as string
  updatedAt: string; // DateTime as ISO string
}

export interface TransactionHistory {
  id: string;
  userId: string;
  username?: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  
  // Transaction details
  action: string; // 'BUY', 'SELL', 'MIGRATED'
  quantity: string; // Decimal as string
  pricePerTokenSol: string; // Decimal as string
  totalCostSol: string; // Decimal as string
  feesSol: string; // Decimal as string
  
  // FIFO tracking
  remainingQuantity: string; // Decimal as string
  costBasisSol: string; // Decimal as string
  realizedPnLSol: string | null; // Decimal as string
  
  // Reference to original trade
  tradeId: string | null;
  
  // Timestamps
  executedAt: string; // DateTime as ISO string
  createdAt: string; // DateTime as ISO string
}

export interface Token {
  address: string;
  mint?: string;  // Some APIs return 'mint' instead of 'address'
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  logoURI?: string | null; // From backend API (Helius format)
  lastPrice: string | null; // Decimal as string
  lastTs: string | null; // DateTime as ISO string

  // Short-term metrics
  volume5m: string | null; // Decimal as string
  volume1h: string | null; // Decimal as string
  volume24h: string | null; // Decimal as string
  priceChange5m: string | null; // Decimal as string
  priceChange1h: string | null; // Decimal as string
  priceChange24h: string | null; // Decimal as string
  liquidityUsd: string | null; // Decimal as string
  marketCapUsd: string | null; // Decimal as string
  holderCount: string | null; // BigInt as string

  // Discovery and trending flags
  isNew?: boolean;   // Default false if not provided
  isTrending?: boolean;   // Default false if not provided
  momentumScore: string | null; // Decimal as string

  // Social and metadata
  websites: string | null; // JSON array as string
  socials: string | null; // JSON array as string
  website?: string | null;  // Direct website field from backend
  twitter?: string | null;  // Direct twitter field from backend
  telegram?: string | null; // Direct telegram field from backend

  // Additional properties used in components
  price: number | null;

  // Timestamps
  firstSeenAt: string | null; // DateTime as ISO string
  lastUpdatedAt: string | null; // DateTime as ISO string
  lastUpdated?: string | null; // Alternative timestamp format
}

export interface ConversionHistory {
  id: string;
  userId: string;
  username?: string;
  virtualSolAmount: string; // Decimal as string
  vsolTokensReceived: string; // Decimal as string
  conversionRate: string; // Decimal as string
  transactionHash: string | null;
  status: string; // 'PENDING', 'COMPLETED', 'FAILED', 'ESCROWED'
  createdAt: string; // DateTime as ISO string
  updatedAt: string; // DateTime as ISO string
}

// ================================
// API Response Types (enriched with metadata)
// ================================

export interface EnrichedTrade extends Trade {
  // Enriched fields from tokenService
  symbol?: string | null;
  name?: string | null;
  logoURI?: string | null;
  side: 'BUY' | 'SELL';
  qty: string;
  priceUsd: string;
  costUsd: string;
  createdAt: string;
  user?: {
    id: string;
    handle: string | null;
    profileImage: string | null;
  };
}

export interface PortfolioPosition {
  mint: string;
  qty: string;
  avgCostUsd: string;
  costBasisRaw: string; // Full-precision total cost basis
  valueUsd: string;
  unrealizedUsd: string;
  unrealizedPercent: string;
  // Memecoin-friendly pricing data
  currentPrice: string; // Current token price (high precision for micro-cap tokens)
  valueSol?: string; // Position value in SOL terms
  marketCapUsd?: string; // Token market cap
  priceChange24h?: string; // 24h price change %
  // Enhanced metadata
  tokenSymbol?: string;
  tokenName?: string;
  tokenImage?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
}

export interface PortfolioTotals {
  totalValueUsd: string;
  totalUnrealizedUsd: string;
  totalRealizedUsd: string;
  totalPnlUsd: string;
  // Enhanced stats
  winRate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface PortfolioResponse {
  positions: PortfolioPosition[];
  totals: PortfolioTotals;
}

// Trading statistics interface
export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
}

// Portfolio performance data point
export interface PerformanceDataPoint {
  date: string;
  value: number;
}

export interface PortfolioPerformanceResponse {
  performance: PerformanceDataPoint[];
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  handle: string | null;
  displayName: string | null;
  profileImage: string | null;
  avatarUrl: string | null;
  avatar: string | null;
  totalPnlUsd: string;
  totalTrades: number;
  winRate: number;
  totalVolumeUsd: string;
  rank: number;
}

// Import the base TrendingToken from backend service
export interface TrendingToken {
  mint: string;
  symbol: string | null;
  name: string | null;
  logoURI: string | null;
  priceUsd: number;
  priceChange24h: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  volume24h: number;
  marketCapUsd: number | null;
  tradeCount: number;
  uniqueTraders: number;
}

// Extended type for frontend display with additional optional fields
export interface TrendingTokenResponse extends TrendingToken {
  imageUrl?: string | null; // Alternative image field for compatibility
  
  // Additional fields for trending display formatting
  priceChangeFormatted?: string;
  volumeFormatted?: string;
  marketCapFormatted?: string;
}

// ================================
// API Request/Response Types
// ================================

export interface TradeRequest {
  userId: string;
  username?: string;
  mint: string;
  side: 'BUY' | 'SELL';
  qty: string;
}

export interface TradeResponse {
  success: boolean;
  trade: {
    id: string;
    userId: string;
  username?: string;
    tokenAddress: string;
    side: 'BUY' | 'SELL';
    quantity: string;
    price: string;
    totalCost: string;
    costUsd?: string;
    timestamp: string;
    marketCapUsd?: string;
  };
  position: {
    mint: string;
    quantity: string;
    costBasis: string;
    currentPrice: string;
    unrealizedPnL: string;
  };
  portfolioTotals: {
    totalValueUsd: string;
    totalCostBasis: string;
    unrealizedPnL: string;
    realizedPnL: string;
    solBalance: string;
  };
  rewardPointsEarned: string;
  currentPrice: number;
}

export interface TradesResponse {
  trades: EnrichedTrade[];
}

export interface TradeStats {
  totalTrades: number;
  totalVolumeUsd: string;
  uniqueTraders: number;
}

export interface RewardsClaimRequest {
  userId: string;
  username?: string;
  epoch: number;
  wallet: string;
}

export interface RewardsClaimResponse {
  sig: string;
  amount: string;
}

export interface AuthSignupRequest {
  email: string;
  password: string;
  username?: string;
  handle?: string;
  profileImage?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  username?: string;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    userTier: UserTier;
    virtualSolBalance: string;
    emailVerified: boolean;
    walletAddress?: string; // Optional - only for wallet verification
  };
}

export interface WalletNonceRequest {
  walletAddress: string;
}

export interface WalletNonceResponse {
  nonce: string;
}

export interface WalletVerifyRequest {
  walletAddress: string;
  signature: string;
}

export interface ProfileUpdateRequest {
  userId: string;
  username?: string;
  handle?: string;
  profileImage?: string;
  bio?: string;
  displayName?: string;
}

// ================================
// Utility Types
// ================================

export type ApiError = {
  message: string;
  code?: string;
  details?: any;
};

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

export type TimeframeFilter = '5m' | '1h' | '24h' | '7d' | '30d' | '90d';

export type SortOrder = 'asc' | 'desc';

export type TradeAction = 'BUY' | 'SELL';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'ESCROWED';

// ================================
// WebSocket Types
// ================================

export interface PriceUpdate {
  mint: string;
  price: number;
  timestamp: number;
  source: string;
  volume?: number;
  marketCapUsd?: number | null;
  priceSol?: number;
  solUsd?: number;
  change24h?: number;
}

export interface WebSocketMessage {
  type: 'price_update' | 'subscribe_token' | 'unsubscribe_token' | 'subscribe_all';
  data?: PriceUpdate;
  mint?: string;
}

// ================================
// Search and Filter Types
// ================================

export interface TokenSearchResult {
  // Backend fields (from API response)
  mint: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  priceUsd: number;
  marketCapUsd: number | null;
  liquidity: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  source: string;
  
  // Computed/convenience fields for UI (added by frontend)
  address: string;  // Same as mint, used by frontend components
  imageUrl?: string | null; // Same as logoURI, used by frontend components
  price?: number;    // Same as priceUsd, used by frontend components
  lastPrice?: string | null; // String version of priceUsd
  trending?: boolean; // UI-only field
}

export interface SearchResponse {
  query: string;
  results: TokenSearchResult[];
}

// ================================
// Wallet and Balance Types
// ================================

export interface WalletBalance {
  userId: string;
  username?: string;
  balance: string;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  currency: string;
  description: string;
  mint?: string;
  timestamp: string;
}

export interface WalletStats {
  userId: string;
  username?: string;
  balance: string;
  totalTradeVolume: string;
  totalTrades: number;
  activePositions: number;
  accountAge: number;
}

// ================================
// Reward System Types
// ================================

export interface RewardClaim {
  id: string;
  userId: string;
  username?: string;
  epoch: number;
  wallet: string;
  amount: string; // Decimal as string from backend
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  claimedAt?: string; // DateTime as ISO string
  txSig?: string;
  createdAt: string; // DateTime as ISO string
}

export interface RewardSnapshot {
  id: string;
  epoch: number;
  totalPoints: string;
  poolAmount: string;
  createdAt: string;
}

export interface RewardStats {
  totalClaims: number;
  totalAmount: number; // Aggregated amount from all claims
  pendingClaims: number;
}

// ================================
// Wallet Tracking Types
// ================================

export interface TrackedWallet {
  id: string;
  userId: string;
  username?: string;
  walletAddress: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WalletActivity {
  signature: string;
  type: string;
  tokenIn: string | null;
  tokenOut: string | null;
  amountIn: string;
  amountOut: string;
  timestamp: string;
  program: string;
  fee: string;
}

export interface CopyTrade {
  id: string;
  userId: string;
  username?: string;
  originalWallet: string;
  originalSignature: string;
  copyTradeId: string;
  percentage: number;
  originalAmount: string;
  copiedAmount: string;
  createdAt: string;
}

// ================================
// Purchase Types
// ================================

export interface PurchaseTier {
  realSol: number;
  simulatedSol: number;
  label: string;
  bonus: number; // Percentage bonus
  popular?: boolean;
}

export interface PurchaseRequest {
  userId: string;
  username?: string;
  amount: number;
  walletAddress: string;
}

export interface PurchaseInitiateResponse {
  purchaseId: string;
  recipientWallet: string;
  amount: number;
  simulatedSol: number;
  tierLabel: string;
}

export interface PurchaseVerifyRequest {
  userId: string;
  username?: string;
  transactionSignature: string;
  walletAddress: string;
}

export interface PurchaseVerifyResponse {
  success: boolean;
  purchaseId: string;
  simulatedSolAdded: string;
  newBalance: string;
  transactionSignature: string;
  explorerUrl: string;
}

export interface PurchaseHistory {
  id: string;
  realSolAmount: string;
  simulatedSolAmount: string;
  transactionSignature: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  tierLabel: string | null;
  createdAt: string;
  completedAt: string | null;
  explorerUrl: string | null;
}

export interface PurchaseTiersResponse {
  tiers: PurchaseTier[];
}

// ================================
// Notification Types
// ================================

export type NotificationType =
  | 'TRADE_EXECUTED'        // Trade completed
  | 'TRADE_MILESTONE'       // 10th, 50th, 100th trade
  | 'POSITION_GAIN'         // Position up 10%, 25%, 50%, 100%
  | 'POSITION_MOON'         // 2x, 5x, 10x gains
  | 'POSITION_LOSS'         // Position down significantly
  | 'DAILY_PNL'             // Daily profit milestone
  | 'PORTFOLIO_ATH'         // Portfolio all-time high
  | 'PORTFOLIO_RECOVERY'    // Recovered from loss
  | 'LEADERBOARD_RANK'      // Entered top 100, top 10
  | 'LEADERBOARD_MOVE'      // Moved up ranks
  | 'REWARD_AVAILABLE'      // Rewards to claim
  | 'REWARD_CLAIMED'        // Reward claimed
  | 'WALLET_TRACKER_TRADE'  // KOL made a trade
  | 'WALLET_TRACKER_GAIN'   // KOL position mooning
  | 'ACHIEVEMENT'           // Fun achievements
  | 'PRICE_ALERT'           // Price target hit
  | 'TRENDING_TOKEN'        // Token you hold is trending
  | 'SYSTEM'                // System announcements
  | 'WELCOME';              // Welcome message

export type NotificationCategory =
  | 'TRADE'
  | 'PORTFOLIO'
  | 'LEADERBOARD'
  | 'REWARDS'
  | 'WALLET_TRACKER'
  | 'ACHIEVEMENT'
  | 'SYSTEM'
  | 'GENERAL';

export interface NotificationMetadata {
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  amount?: string;
  price?: string;
  pnl?: string;
  pnlPercent?: string;
  rank?: number;
  rankChange?: number;
  walletAddress?: string;
  walletName?: string;
  tradeCount?: number;
  multiplier?: number;
  achievementType?: string;
  epoch?: number;
  txSig?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string;
  username?: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  metadata: string; // JSON string
  actionUrl: string | null;
  createdAt: string; // DateTime as ISO string
}

export interface NotificationResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  success: boolean;
  count: number;
}


