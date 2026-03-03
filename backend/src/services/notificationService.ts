/**
 * Notification Service
 *
 * Creates fun, engaging notifications for users based on their trading activity,
 * achievements, and platform interactions.
 */

import prisma from '../plugins/prisma.js';
import { NotificationType, NotificationCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { loggers } from "../utils/logger.js";

const logger = loggers.notification;

interface NotificationMetadata {
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  amount?: number | string;
  price?: number | string;
  pnl?: number | string;
  pnlPercent?: number | string;
  rank?: number;
  rankChange?: number;
  walletAddress?: string;
  walletName?: string;
  tradeCount?: number;
  multiplier?: number;
  achievementType?: string;
  [key: string]: any;
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  actionUrl?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, category, title, message, metadata, actionUrl } = params;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        category,
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        actionUrl,
        read: false,
      },
    });

    return notification;
  } catch (error) {
    logger.error({ userId, type, category, err: error }, "Failed to create notification");
    return null;
  }
}

/**
 * Create a trade execution notification
 */
export async function notifyTradeExecuted(
  userId: string,
  side: 'BUY' | 'SELL',
  tokenSymbol: string,
  tokenName: string,
  tokenAddress: string,
  quantity: Decimal,
  priceUsd: Decimal,
  totalCostUsd: Decimal
) {
  const isBuy = side === 'BUY';
  const emoji = isBuy ? '🟢' : '🔴';

  const title = isBuy
    ? `${emoji} Bought ${tokenSymbol}!`
    : `${emoji} Sold ${tokenSymbol}!`;

  const message = isBuy
    ? `Successfully purchased ${quantity.toFixed(4)} ${tokenSymbol} for ${totalCostUsd.toFixed(2)} USD`
    : `Successfully sold ${quantity.toFixed(4)} ${tokenSymbol} for ${totalCostUsd.toFixed(2)} USD`;

  return createNotification({
    userId,
    type: NotificationType.TRADE_EXECUTED,
    category: NotificationCategory.TRADE,
    title,
    message,
    metadata: {
      tokenSymbol,
      tokenName,
      tokenAddress,
      amount: quantity.toFixed(6),
      price: priceUsd.toFixed(6),
      side,
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create trade milestone notification (10th, 50th, 100th trade, etc.)
 */
export async function notifyTradeMilestone(userId: string, tradeCount: number) {
  const milestones: { [key: number]: string } = {
    1: 'first',
    10: '10th',
    25: '25th',
    50: '50th',
    100: '100th',
    250: '250th',
    500: '500th',
    1000: '1000th',
  };

  const milestone = milestones[tradeCount];
  if (!milestone) return null;

  const funMessages: { [key: string]: string } = {
    first: "Your trading journey begins! 🚀",
    '10th': "You're getting the hang of it! 📈",
    '25th': "Trading machine activated! ⚡",
    '50th': "Halfway to legendary status! 🌟",
    '100th': "Triple digits, baby! 💯",
    '250th': "You're a trading veteran now! 🎖️",
    '500th': "Unstoppable trading force! 🔥",
    '1000th': "One thousand trades! You're a LEGEND! 👑",
  };

  return createNotification({
    userId,
    type: NotificationType.TRADE_MILESTONE,
    category: NotificationCategory.ACHIEVEMENT,
    title: `🎉 ${milestone.charAt(0).toUpperCase() + milestone.slice(1)} Trade!`,
    message: funMessages[milestone],
    metadata: { tradeCount },
    actionUrl: '/trade',
  });
}

/**
 * Create position gain notification (10%, 25%, 50%, 100%)
 */
export async function notifyPositionGain(
  userId: string,
  tokenSymbol: string,
  tokenAddress: string,
  gainPercent: number,
  currentValue: Decimal,
  costBasis: Decimal
) {
  const milestone = Math.floor(gainPercent / 10) * 10;

  const emojis: { [key: number]: string } = {
    10: '📈',
    20: '🚀',
    30: '💫',
    40: '✨',
    50: '🔥',
    60: '💎',
    70: '🌟',
    80: '⭐',
    90: '🎯',
    100: '💯',
  };

  const messages: { [key: number]: string } = {
    10: "Looking good!",
    20: "Starting to moon!",
    30: "Keep it going!",
    40: "You picked a winner!",
    50: "Halfway to the moon!",
    60: "Diamond hands paying off!",
    70: "This is the way!",
    80: "Almost doubled!",
    90: "So close to 2x!",
    100: "You doubled your money!",
  };

  const emoji = emojis[milestone] || '📈';
  const message = messages[milestone] || "Your position is up!";

  const pnl = currentValue.minus(costBasis);

  return createNotification({
    userId,
    type: NotificationType.POSITION_GAIN,
    category: NotificationCategory.PORTFOLIO,
    title: `${emoji} ${tokenSymbol} is up ${gainPercent.toFixed(1)}%!`,
    message,
    metadata: {
      tokenSymbol,
      tokenAddress,
      pnlPercent: gainPercent.toFixed(2),
      pnl: pnl.toFixed(2),
      currentValue: currentValue.toFixed(2),
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create position moon notification (2x, 5x, 10x)
 */
export async function notifyPositionMoon(
  userId: string,
  tokenSymbol: string,
  tokenAddress: string,
  multiplier: number,
  currentValue: Decimal,
  costBasis: Decimal
) {
  const moonEmojis: { [key: number]: string } = {
    2: '🌕',
    3: '🚀🌕',
    4: '🚀🚀🌕',
    5: '💎🚀🌕',
    10: '👑💎🚀🌕',
    20: '🦄💎🚀🌕',
  };

  const moonMessages: { [key: number]: string } = {
    2: "TO THE MOON! 🌕",
    3: "MARS LANDING! 🔴",
    4: "JUPITER BOUND! 🪐",
    5: "INTERSTELLAR! ⭐",
    10: "LEGEND STATUS UNLOCKED! 👑",
    20: "UNICORN LEVEL GAINS! 🦄",
  };

  const emoji = moonEmojis[multiplier] || '🌕';
  const message = moonMessages[multiplier] || `${multiplier}x gains!`;

  const pnl = currentValue.minus(costBasis);
  const gainPercent = pnl.div(costBasis).mul(100);

  return createNotification({
    userId,
    type: NotificationType.POSITION_MOON,
    category: NotificationCategory.PORTFOLIO,
    title: `${emoji} ${tokenSymbol} just hit ${multiplier}x!`,
    message,
    metadata: {
      tokenSymbol,
      tokenAddress,
      multiplier,
      pnlPercent: gainPercent.toFixed(2),
      pnl: pnl.toFixed(2),
      currentValue: currentValue.toFixed(2),
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create position loss alert
 */
export async function notifyPositionLoss(
  userId: string,
  tokenSymbol: string,
  tokenAddress: string,
  lossPercent: number,
  currentValue: Decimal,
  costBasis: Decimal
) {
  if (lossPercent < 30) return null; // Only notify on significant losses

  const messages: { [key: string]: string } = {
    30: "Still time to recover! 💪",
    50: "Diamond hands time? 💎",
    70: "HODL strong! 🤝",
  };

  const milestone = Math.floor(lossPercent / 10) * 10;
  const message = messages[milestone] || "Consider your strategy! 🤔";

  return createNotification({
    userId,
    type: NotificationType.POSITION_LOSS,
    category: NotificationCategory.PORTFOLIO,
    title: `⚠️ ${tokenSymbol} is down ${lossPercent.toFixed(1)}%`,
    message,
    metadata: {
      tokenSymbol,
      tokenAddress,
      pnlPercent: (-lossPercent).toFixed(2),
      currentValue: currentValue.toFixed(2),
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create daily PnL milestone notification
 */
export async function notifyDailyPnL(
  userId: string,
  dailyPnl: Decimal,
  milestone: number
) {
  if (dailyPnl.lt(milestone)) return null;

  const emojis: { [key: number]: string } = {
    100: '💵',
    500: '💰',
    1000: '🤑',
    5000: '💎',
    10000: '👑',
  };

  const messages: { [key: number]: string } = {
    100: "First hundred! Nice work! 💪",
    500: "Half a grand today! 🔥",
    1000: "One thousand in a day! 🚀",
    5000: "Five grand! You're crushing it! 💎",
    10000: "TEN THOUSAND! ABSOLUTE LEGEND! 👑",
  };

  const emoji = emojis[milestone] || '💵';
  const message = messages[milestone] || `$${milestone} profit today!`;

  return createNotification({
    userId,
    type: NotificationType.DAILY_PNL,
    category: NotificationCategory.PORTFOLIO,
    title: `${emoji} +$${dailyPnl.toFixed(2)} Today!`,
    message,
    metadata: {
      dailyPnl: dailyPnl.toFixed(2),
      milestone,
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create portfolio all-time high notification
 */
export async function notifyPortfolioATH(
  userId: string,
  portfolioValue: Decimal,
  previousATH: Decimal
) {
  return createNotification({
    userId,
    type: NotificationType.PORTFOLIO_ATH,
    category: NotificationCategory.PORTFOLIO,
    title: '🎉 New All-Time High!',
    message: `Your portfolio just hit a new record: $${portfolioValue.toFixed(2)}!`,
    metadata: {
      portfolioValue: portfolioValue.toFixed(2),
      previousATH: previousATH.toFixed(2),
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create leaderboard rank notification
 */
export async function notifyLeaderboardRank(
  userId: string,
  rank: number,
  previousRank?: number
) {
  const rankMessages: { [key: number]: string } = {
    1: "🥇 YOU'RE #1! CHAMPION!",
    2: "🥈 Silver medal! So close!",
    3: "🥉 Bronze! Nice work!",
    10: "💎 Top 10! Diamond tier!",
    100: "⭐ Top 100! You're elite!",
  };

  let title = '';
  let message = '';

  if (rank === 1) {
    title = '👑 You\'re #1!';
    message = rankMessages[1];
  } else if (rank === 2) {
    title = '🥈 Rank #2!';
    message = rankMessages[2];
  } else if (rank === 3) {
    title = '🥉 Rank #3!';
    message = rankMessages[3];
  } else if (rank <= 10) {
    title = '💎 Top 10!';
    message = `You're ranked #${rank}! ${rankMessages[10]}`;
  } else if (rank <= 100) {
    title = '⭐ Top 100!';
    message = `You're ranked #${rank}! ${rankMessages[100]}`;
  }

  if (!title) return null;

  return createNotification({
    userId,
    type: NotificationType.LEADERBOARD_RANK,
    category: NotificationCategory.LEADERBOARD,
    title,
    message,
    metadata: {
      rank,
      previousRank,
    },
    actionUrl: '/leaderboard',
  });
}

/**
 * Create leaderboard movement notification
 */
export async function notifyLeaderboardMove(
  userId: string,
  currentRank: number,
  previousRank: number,
  rankChange: number
) {
  if (Math.abs(rankChange) < 10) return null; // Only notify on significant moves

  const isUp = rankChange > 0;
  const emoji = isUp ? '📈' : '📉';

  const title = isUp
    ? `${emoji} Climbed ${rankChange} ranks!`
    : `${emoji} Dropped ${Math.abs(rankChange)} ranks`;

  const message = isUp
    ? `You're now ranked #${currentRank}! Keep climbing! 🚀`
    : `Now ranked #${currentRank}. Time to bounce back! 💪`;

  return createNotification({
    userId,
    type: NotificationType.LEADERBOARD_MOVE,
    category: NotificationCategory.LEADERBOARD,
    title,
    message,
    metadata: {
      rank: currentRank,
      previousRank,
      rankChange,
    },
    actionUrl: '/leaderboard',
  });
}

/**
 * Create reward available notification
 */
export async function notifyRewardAvailable(
  userId: string,
  epoch: number,
  amount: Decimal
) {
  return createNotification({
    userId,
    type: NotificationType.REWARD_AVAILABLE,
    category: NotificationCategory.REWARDS,
    title: '🎁 Rewards Available!',
    message: `You earned ${amount.toFixed(2)} VSOL tokens in epoch ${epoch}. Claim now!`,
    metadata: {
      epoch,
      amount: amount.toFixed(2),
    },
    actionUrl: '/rewards',
  });
}

/**
 * Create reward claimed notification
 */
export async function notifyRewardClaimed(
  userId: string,
  epoch: number,
  amount: Decimal,
  txSig?: string
) {
  return createNotification({
    userId,
    type: NotificationType.REWARD_CLAIMED,
    category: NotificationCategory.REWARDS,
    title: '✅ Rewards Claimed!',
    message: `Successfully claimed ${amount.toFixed(2)} VSOL tokens from epoch ${epoch}!`,
    metadata: {
      epoch,
      amount: amount.toFixed(2),
      txSig,
    },
    actionUrl: txSig ? `https://solscan.io/tx/${txSig}` : '/rewards',
  });
}

/**
 * Create wallet tracker trade notification
 */
export async function notifyWalletTrackerTrade(
  userId: string,
  walletAddress: string,
  walletName: string,
  side: 'BUY' | 'SELL',
  tokenSymbol: string,
  tokenAddress: string,
  amount: Decimal,
  priceUsd: Decimal
) {
  const emoji = side === 'BUY' ? '🟢' : '🔴';
  const action = side === 'BUY' ? 'bought' : 'sold';

  return createNotification({
    userId,
    type: NotificationType.WALLET_TRACKER_TRADE,
    category: NotificationCategory.WALLET_TRACKER,
    title: `${emoji} ${walletName || 'Tracked wallet'} ${action} ${tokenSymbol}`,
    message: `${action} ${amount.toFixed(4)} ${tokenSymbol} at $${priceUsd.toFixed(6)}`,
    metadata: {
      walletAddress,
      walletName,
      tokenSymbol,
      tokenAddress,
      side,
      amount: amount.toFixed(6),
      price: priceUsd.toFixed(6),
    },
    actionUrl: `/wallet-tracker?address=${walletAddress}`,
  });
}

/**
 * Create trending token notification
 */
export async function notifyTrendingToken(
  userId: string,
  tokenSymbol: string,
  tokenAddress: string,
  volumeChange24h: number
) {
  return createNotification({
    userId,
    type: NotificationType.TRENDING_TOKEN,
    category: NotificationCategory.PORTFOLIO,
    title: `🔥 ${tokenSymbol} is trending!`,
    message: `${tokenSymbol} volume is up ${volumeChange24h.toFixed(1)}% in 24h! You're holding it! 💎`,
    metadata: {
      tokenSymbol,
      tokenAddress,
      volumeChange24h: volumeChange24h.toFixed(2),
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create achievement notification
 */
export async function notifyAchievement(
  userId: string,
  achievementType: string,
  title: string,
  message: string,
  metadata?: NotificationMetadata
) {
  return createNotification({
    userId,
    type: NotificationType.ACHIEVEMENT,
    category: NotificationCategory.ACHIEVEMENT,
    title: `🏆 ${title}`,
    message,
    metadata: {
      achievementType,
      ...metadata,
    },
    actionUrl: '/portfolio',
  });
}

/**
 * Create welcome notification for new users
 */
export async function notifyWelcome(userId: string, username: string) {
  return createNotification({
    userId,
    type: NotificationType.WELCOME,
    category: NotificationCategory.SYSTEM,
    title: '👋 Welcome to Solana Sim!',
    message: `Hey ${username}! Ready to master Solana trading? Start with virtual balance (10 SOL for standard users, 100 SOL for SIM holders) and trade with zero risk! 🚀`,
    metadata: {
      username,
    },
    actionUrl: '/trade',
  });
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  unreadOnly = false
) {
  const where: any = { userId };
  if (unreadOnly) {
    where.read = false;
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      read: true,
    },
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  });
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });
}

/**
 * Delete old read notifications (older than 30 days)
 */
export async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.notification.deleteMany({
    where: {
      read: true,
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  });
}
