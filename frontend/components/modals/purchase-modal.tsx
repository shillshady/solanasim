'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wallet, AlertCircle, Sparkles } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { TierCard } from '@/components/purchase/tier-card';
import { ConfirmStep, ProcessingStep, SuccessStep, ErrorStep } from './purchase-steps';
import * as api from '@/lib/api';
import * as purchaseTransaction from '@/lib/purchase-transaction';
import type { PurchaseTier } from '@/lib/types/backend';

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

type PurchaseStep = 'select' | 'confirm' | 'processing' | 'verifying' | 'success' | 'error';

export function PurchaseModal({ open, onOpenChange, userId }: PurchaseModalProps) {
  const { connected, publicKey, signTransaction, wallet, connect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<PurchaseStep>('select');
  const [selectedTier, setSelectedTier] = useState<PurchaseTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch available tiers
  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ['purchaseTiers'],
    queryFn: api.getPurchaseTiers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('select');
        setSelectedTier(null);
        setError(null);
        setTransactionSignature(null);
        setNewBalance(null);
        setIsConnecting(false);
      }, 300);
    }
  }, [open]);

  // Handle wallet connection success
  useEffect(() => {
    if (connected && publicKey && isConnecting) {
      setIsConnecting(false);
      toast({
        title: 'Wallet Connected',
        description: `Connected: ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`,
      });
      
      // If user selected a tier and is now connected, auto-proceed to confirmation
      if (selectedTier) {
        setTimeout(() => {
          setStep('confirm');
        }, 500);
      }
    }
  }, [connected, publicKey, isConnecting, selectedTier, toast]);

  // Initiate purchase mutation
  const initiateMutation = useMutation({
    mutationFn: async (tier: PurchaseTier) => {
      if (!publicKey) throw new Error('Wallet not connected');
      
      return api.initiatePurchase({
        userId,
        amount: tier.realSol,
        walletAddress: publicKey.toBase58(),
      });
    },
  });

  // Verify purchase mutation
  const verifyMutation = useMutation({
    mutationFn: async (signature: string) => {
      if (!publicKey) throw new Error('Wallet not connected');

      return api.verifyPurchase({
        userId,
        transactionSignature: signature,
        walletAddress: publicKey.toBase58(),
      });
    },
    onSuccess: (data) => {
      setNewBalance(data.newBalance);
      setTransactionSignature(data.transactionSignature);
      setStep('success');
      
      // Invalidate balance queries
      queryClient.invalidateQueries({ queryKey: ['walletBalance', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseHistory', userId] });

      toast({
        title: 'Purchase Successful! 🎉',
        description: `${data.simulatedSolAdded} SOL added to your balance`,
      });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to verify purchase');
      setStep('error');
    },
  });

  // Handle tier selection
  const handleTierSelect = (tier: PurchaseTier) => {
    setSelectedTier(tier);
    setError(null);
  };

  // Handle continue to confirmation
  const handleContinue = async () => {
    if (!connected) {
      // If no wallet is connected, show wallet selection modal
      setIsConnecting(true);
      setError(null);
      
      try {
        if (!wallet) {
          // No wallet adapter selected, show wallet modal
          setWalletModalVisible(true);
        } else {
          // Wallet adapter exists but not connected, try to connect
          await connect();
          
          // After successful connection, check if we have public key
          if (publicKey) {
            toast({
              title: 'Wallet Connected',
              description: 'You can now proceed with your purchase',
            });
            setIsConnecting(false);
          }
        }
      } catch (err) {
        console.error('Wallet connection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        setIsConnecting(false);
      }
      
      return;
    }

    if (!selectedTier) {
      setError('Please select a tier');
      return;
    }

    setStep('confirm');
  };

  // Handle purchase execution
  const handlePurchase = async () => {
    if (!selectedTier || !publicKey || !signTransaction) {
      setError('Wallet not ready');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      // Check balance
      const hasFunds = await purchaseTransaction.hasSufficientBalance(
        publicKey.toBase58(),
        selectedTier.realSol
      );

      if (!hasFunds) {
        setError('Insufficient SOL balance (including fees)');
        setStep('error');
        return;
      }

      // Initiate purchase on backend
      const initiateResponse = await initiateMutation.mutateAsync(selectedTier);

      // Send transaction
      const txResult = await purchaseTransaction.sendSolTransaction(
        { connected, publicKey, signTransaction } as any,
        initiateResponse.recipientWallet,
        selectedTier.realSol
      );

      if (!txResult.success || !txResult.signature) {
        setError(txResult.error || 'Transaction failed');
        setStep('error');
        return;
      }

      // Verify transaction on backend
      setStep('verifying');
      await verifyMutation.mutateAsync(txResult.signature);

    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message || 'Purchase failed');
      setStep('error');
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (step === 'processing' || step === 'verifying') {
      return; // Don't allow cancel during processing
    }
    setStep('select');
    setError(null);
  };

  // Handle close
  const handleClose = () => {
    if (step === 'processing' || step === 'verifying') {
      return; // Don't allow close during processing
    }
    onOpenChange(false);
  };

  // Render step content
  const renderContent = () => {
    switch (step) {
      case 'select':
        return (
          <>
            <DialogHeader className="space-y-4 pb-6">
              <div className="flex items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                <DialogTitle className="text-3xl font-black text-white dark:text-white">
                  Purchase Simulated SOL
                </DialogTitle>
              </div>
              <DialogDescription className="text-base text-center text-gray-300 dark:text-gray-300">
                Choose your tier and boost your trading balance instantly
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {tiersLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading tiers...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 py-4">
                  {tiersData?.tiers.map((tier, index) => (
                    <TierCard
                      key={index}
                      tier={tier}
                      selected={selectedTier?.realSol === tier.realSol}
                      onSelect={() => handleTierSelect(tier)}
                    />
                  ))}
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="animate-in slide-in-from-top-2 border-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {!connected && (
                <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 animate-in slide-in-from-bottom-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <AlertDescription className="text-foreground font-medium">
                    <strong className="font-bold text-foreground">Connect your wallet</strong> to purchase simulated SOL and start trading
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
                <Button variant="outline" onClick={handleClose} className="px-8">Cancel</Button>
                <Button
                  onClick={handleContinue}
                  disabled={!selectedTier || isConnecting}
                  className="min-w-[180px] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg font-bold"
                  size="lg"
                >
                  {isConnecting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
                  ) : !connected ? (
                    <><Wallet className="h-4 w-4 mr-2" />Connect Wallet</>
                  ) : (
                    <>Continue<Sparkles className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          </>
        );

      case 'confirm':
        return selectedTier ? (
          <ConfirmStep
            selectedTier={selectedTier}
            error={error}
            onPurchase={handlePurchase}
            onCancel={handleCancel}
          />
        ) : null;

      case 'processing':
        return <ProcessingStep />;

      case 'verifying':
        return <ProcessingStep isVerifying />;

      case 'success':
        return (
          <SuccessStep
            selectedTier={selectedTier}
            newBalance={newBalance}
            transactionSignature={transactionSignature}
            onClose={handleClose}
          />
        );

      case 'error':
        return (
          <ErrorStep
            error={error}
            onClose={handleClose}
            onRetry={() => setStep('select')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-7xl max-h-[95vh] overflow-y-auto p-8">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
