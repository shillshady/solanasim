// Barrel file — re-exports all API modules for backward compatibility
// All existing `import * as api from "@/lib/api"` continue to work unchanged

// Re-export types for convenience
export type {
  TradeRequest,
  TradeResponse,
  LeaderboardEntry,
  TrendingToken,
  TrendingTokenResponse,
  EnrichedTrade as TradeHistoryItem,
  TradesResponse,
  TradeStats,
  RewardsClaimRequest,
  RewardsClaimResponse,
  AuthSignupRequest,
  AuthLoginRequest,
  AuthResponse,
  WalletNonceRequest,
  WalletNonceResponse,
  WalletVerifyRequest,
  ProfileUpdateRequest,
  TokenSearchResult,
  SearchResponse,
  WalletBalance,
  WalletTransaction,
  WalletStats,
  TrackedWallet,
  WalletActivity,
  RewardClaim,
  RewardStats,
  PriceUpdate,
  WebSocketMessage,
  ApiError,
  User,
  PortfolioPosition,
  PortfolioResponse,
  Token
} from '../types/backend';

// Client infrastructure
export { apiCall, api } from './client';
export type { ApiResponse } from './client';

// Domain modules
export { trade } from './trade';
export { getPortfolio, getPortfolioRealtime, getPortfolioStats, getPortfolioPerformance } from './portfolio';
export { getTokenDetails, searchTokens, getTokenMetadata } from './search';
export { getTrendingTokens, getTrending, getStocks } from './trending';
export { getLeaderboard } from './leaderboard';
export { getTrades, getUserTrades, getTokenTrades, getTradeStats } from './trades';
export {
  signupEmail, loginEmail, getWalletNonce, verifyWallet,
  updateProfile, getUserProfile, changePassword, updateAvatar, removeAvatar
} from './auth';
export { claimRewards, getUserRewardClaims, getRewardStats } from './rewards';
export { getWalletBalance, getWalletTransactions, getWalletStats } from './wallet';
export { getPurchaseTiers, initiatePurchase, verifyPurchase, getPurchaseHistory } from './purchase';
export { openPerpPosition, closePerpPosition, getPerpPositions, getPerpTradeHistory, getPerpWhitelist } from './perps';

// Default export for `import apiClient from './api'` compatibility
import { trade } from './trade';
import { getPortfolio, getPortfolioRealtime, getPortfolioStats, getPortfolioPerformance } from './portfolio';
import { getTokenDetails, searchTokens, getTokenMetadata } from './search';
import { getTrendingTokens, getTrending, getStocks } from './trending';
import { getLeaderboard } from './leaderboard';
import { getTrades, getUserTrades, getTokenTrades, getTradeStats } from './trades';
import {
  signupEmail, loginEmail, getWalletNonce, verifyWallet,
  updateProfile, getUserProfile, changePassword, updateAvatar, removeAvatar
} from './auth';
import { claimRewards, getUserRewardClaims, getRewardStats } from './rewards';
import { getWalletBalance, getWalletTransactions, getWalletStats } from './wallet';
import { getPurchaseTiers, initiatePurchase, verifyPurchase, getPurchaseHistory } from './purchase';
import { openPerpPosition, closePerpPosition, getPerpPositions, getPerpTradeHistory, getPerpWhitelist } from './perps';
import { apiCall } from './client';

export default {
  trade,
  getPortfolio,
  getPortfolioRealtime,
  getPortfolioStats,
  getPortfolioPerformance,
  getLeaderboard,
  getTrendingTokens,
  getTrending,
  getStocks,
  getTokenDetails,
  getTokenMetadata,
  searchTokens,
  claimRewards,
  getUserRewardClaims,
  getRewardStats,
  signupEmail,
  loginEmail,
  getWalletNonce,
  verifyWallet,
  updateProfile,
  getUserProfile,
  changePassword,
  updateAvatar,
  removeAvatar,
  getWalletBalance,
  getWalletTransactions,
  getWalletStats,
  getTrades,
  getUserTrades,
  getTokenTrades,
  getTradeStats,
  getPurchaseTiers,
  initiatePurchase,
  verifyPurchase,
  getPurchaseHistory,
  openPerpPosition,
  closePerpPosition,
  getPerpPositions,
  getPerpTradeHistory,
  getPerpWhitelist,
  apiCall,
};
