'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  TorusWalletAdapter,
  LedgerWalletAdapter,
  MathWalletAdapter,
  Coin98WalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { errorLogger } from './error-logger';

// Import the default wallet adapter CSS for styling
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
}

/**
 * Solana Wallet Provider
 * Provides wallet connection functionality to the entire app
 * Supports multiple wallet types with mainnet configuration for production
 * Note: PhantomWalletAdapter removed as Phantom now uses Standard Wallet API
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Configure Solana network - use mainnet for production
  const network = WalletAdapterNetwork.Mainnet;
  
  // Use custom RPC endpoint or fallback to cluster API URL
  const endpoint = useMemo(() => {
    // Use Helius RPC or custom endpoint if provided
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) {
      return customRpc;
    }
    // Fallback to cluster API URL
    return clusterApiUrl(network);
  }, [network]);

  // Initialize wallet adapters
  const wallets = useMemo(
    () => {
      try {
        return [
          // Removed PhantomWalletAdapter as it's now a Standard Wallet
          // Removed SolflareWalletAdapter as it's now also a Standard Wallet
          new TorusWalletAdapter(),
          new LedgerWalletAdapter(),
          new MathWalletAdapter(),
          new Coin98WalletAdapter(),
        ];
      } catch (error) {
        errorLogger.warn('Error initializing wallet adapters', { error: error as Error, component: 'SolanaWalletProvider' });
        return [];
      }
    },
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}