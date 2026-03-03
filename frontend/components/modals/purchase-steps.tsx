'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Wallet, AlertCircle, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';
import type { PurchaseTier } from '@/lib/types/backend';

interface ConfirmStepProps {
  selectedTier: PurchaseTier;
  error: string | null;
  onPurchase: () => void;
  onCancel: () => void;
}

export function ConfirmStep({ selectedTier, error, onPurchase, onCancel }: ConfirmStepProps) {
  return (
    <>
      <DialogHeader className="space-y-4 pb-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <CheckCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-3xl font-black text-white dark:text-white">
            Confirm Purchase
          </DialogTitle>
        </div>
        <DialogDescription className="text-base text-center text-gray-300 dark:text-gray-300">
          Review your purchase details before proceeding
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-2xl" />

          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 rounded-2xl p-8 space-y-6 border-2 border-border/50 backdrop-blur-sm">
            <div className="flex justify-center">
              <Badge className="text-base px-4 py-1.5 bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/30 text-primary font-bold">
                {selectedTier.label} TIER
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-xl bg-background/80 border border-border/50">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">You Pay</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-primary">{selectedTier.realSol}</span>
                  <span className="text-lg font-bold text-primary/70">SOL</span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/30">
                <span className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">You Receive</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-green-600 dark:text-green-400">{selectedTier.simulatedSol}</span>
                  <span className="text-lg font-bold text-green-600/70 dark:text-green-400/70">SIM SOL</span>
                </div>
              </div>
            </div>

            {selectedTier.bonus > 0 && (
              <div className="flex justify-center">
                <div className="px-6 py-3 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-base font-bold text-green-700 dark:text-green-400">
                      +{selectedTier.bonus}% BONUS INCLUDED
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border/50">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Network:</span>
                  <span className="text-foreground/80 font-semibold">Solana Mainnet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Recipient:</span>
                  <code className="text-foreground/80 bg-background/80 px-2 py-1 rounded font-mono text-xs">
                    8i6H...xf1iL
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="border-2 animate-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
          <Button variant="outline" onClick={onCancel} className="px-8">Back</Button>
          <Button
            onClick={onPurchase}
            className="min-w-[200px] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg font-bold"
            size="lg"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Complete Purchase
          </Button>
        </div>
      </div>
    </>
  );
}

interface ProcessingStepProps {
  isVerifying?: boolean;
}

export function ProcessingStep({ isVerifying = false }: ProcessingStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{isVerifying ? 'Verifying Transaction' : 'Processing Transaction'}</DialogTitle>
        <DialogDescription>
          {isVerifying
            ? 'Confirming your purchase on the blockchain'
            : 'Please approve the transaction in your wallet'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="text-center text-muted-foreground">
          {isVerifying ? 'Verifying on Solana blockchain...' : 'Waiting for wallet approval...'}
        </p>
        <p className="text-xs text-center text-muted-foreground max-w-md">
          {isVerifying ? 'This may take a few moments. Please wait.' : 'Do not close this window. Your wallet will prompt you to approve the transaction.'}
        </p>
      </div>
    </>
  );
}

interface SuccessStepProps {
  selectedTier: PurchaseTier | null;
  newBalance: string | null;
  transactionSignature: string | null;
  onClose: () => void;
}

export function SuccessStep({ selectedTier, newBalance, transactionSignature, onClose }: SuccessStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle className="h-5 w-5" />
          Purchase Successful!
        </DialogTitle>
        <DialogDescription>
          Your simulated SOL has been added to your balance
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-8 text-center space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-green-600 dark:text-green-400" />
          <div>
            <div className="text-sm text-muted-foreground mb-2">New Balance</div>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400">
              {newBalance ? parseFloat(newBalance).toFixed(2) : '0'} SOL
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            +{selectedTier?.simulatedSol} simulated SOL added
          </div>
        </div>

        {transactionSignature && (
          <div className="text-center">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://solscan.io/tx/${transactionSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                View on Solscan
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Start Trading</Button>
        </div>
      </div>
    </>
  );
}

interface ErrorStepProps {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export function ErrorStep({ error, onClose, onRetry }: ErrorStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Purchase Failed
        </DialogTitle>
        <DialogDescription>
          There was an error processing your purchase
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'An unknown error occurred'}</AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>Common issues:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Insufficient SOL balance in wallet</li>
            <li>Transaction rejected in wallet</li>
            <li>Network congestion</li>
            <li>RPC endpoint issues</li>
          </ul>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onRetry}>Try Again</Button>
        </div>
      </div>
    </>
  );
}
