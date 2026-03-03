'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Mail, Coins, Star, TrendingUp, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatUSD } from "@/lib/format"

interface TierBenefit {
  name: string;
  description: string;
  available: boolean;
}

interface TierStatusProps {
  userTier: 'EMAIL_USER' | 'WALLET_USER' | 'VSOL_HOLDER' | 'ADMINISTRATOR';
  benefits?: TierBenefit[];
  virtualSolBalance?: number;
  vsolTokenBalance?: number;
  className?: string;
}

const TIER_CONFIG = {
  EMAIL_USER: {
    label: 'Email User',
    icon: Mail,
    color: 'bg-gray-500',
    textColor: 'text-gray-700 dark:text-gray-300',
    description: 'Basic access with email registration',
    defaultBenefits: [
      { name: '10 SOL Starting Balance', description: 'Practice trading with 10 virtual SOL', available: true },
      { name: 'Basic Features', description: 'Core trading simulation features', available: true },
      { name: 'Standard Support', description: 'Community support access', available: true },
    ]
  },
  WALLET_USER: {
    label: 'Wallet User',
    icon: Shield,
    color: 'bg-blue-500',
    textColor: 'text-blue-700 dark:text-blue-300',
    description: 'Enhanced access with wallet verification',
    defaultBenefits: [
      { name: '50 SOL Starting Balance', description: 'More capital for trading practice', available: true },
      { name: 'Wallet Integration', description: 'Connected wallet features', available: true },
      { name: 'Priority Support', description: 'Faster response times', available: true },
    ]
  },
  VSOL_HOLDER: {
    label: '$SIM Holder',
    icon: Crown,
    color: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    description: 'Premium access for $SIM token holders',
    defaultBenefits: [
      { name: '100 SOL Starting Balance', description: 'Maximum starting capital', available: true },
      { name: 'Premium Features', description: 'Advanced analytics and tools', available: true },
      { name: 'VIP Support', description: 'Dedicated premium support', available: true },
      { name: 'Early Access', description: 'Beta features and updates', available: true },
    ]
  },
  ADMINISTRATOR: {
    label: 'Administrator',
    icon: Star,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    textColor: 'text-purple-700 dark:text-purple-300',
    description: 'Full administrative access',
    defaultBenefits: [
      { name: 'Unlimited Access', description: 'All platform features', available: true },
      { name: 'Admin Tools', description: 'Platform management capabilities', available: true },
      { name: 'Priority Support', description: 'Direct administrative support', available: true },
    ]
  }
} as const;

/**
 * Tier Status Display Component
 * Shows user's current tier, benefits, and balances
 */

export function TierStatus({
  userTier,
  benefits,
  virtualSolBalance,
  vsolTokenBalance,
  className
}: TierStatusProps) {
  const tierConfig = TIER_CONFIG[userTier];
  const displayBenefits = benefits || tierConfig.defaultBenefits;
  const TierIcon = tierConfig.icon;

  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            tierConfig.color
          )}>
            <TierIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {tierConfig.label}
              <Badge
                variant="secondary"
                className={cn('text-xs font-medium', tierConfig.textColor)}
              >
                Active
              </Badge>
            </CardTitle>
            <CardDescription className="text-sm">
              {tierConfig.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {virtualSolBalance !== undefined && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Virtual SOL</span>
              </div>
              <p className="text-lg font-semibold text-primary">
                {virtualSolBalance.toFixed(2)} SOL
              </p>
            </div>
          )}

          {vsolTokenBalance !== undefined && vsolTokenBalance > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">$SIM Tokens</span>
              </div>
              <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                {vsolTokenBalance.toLocaleString()} $SIM
              </p>
            </div>
          )}
        </div>

        {/* Benefits List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground/80 mb-2">
            Tier Benefits
          </h4>
          <div className="space-y-2">
            {displayBenefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
              >
                <div className={cn(
                  'mt-0.5 h-2 w-2 rounded-full',
                  benefit.available ? 'bg-green-500' : 'bg-gray-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {benefit.name}
                  </p>
                  <p className="text-xs text-foreground/70">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}