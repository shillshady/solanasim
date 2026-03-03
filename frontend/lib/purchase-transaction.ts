// Purchase transaction utilities for Solana
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { errorLogger } from './error-logger';
import type { WalletContextState } from '@solana/wallet-adapter-react';

// Use the same RPC endpoint as the wallet provider
const getRpcEndpoint = (): string => {
  // Try to use custom RPC first (Helius recommended)
  const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (customRpc) {
    return customRpc;
  }
  
  // Fallback to Helius public endpoint (better rate limits than public Solana RPC)
  return 'https://mainnet.helius-rpc.com/?api-key=public';
};

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Create and send a SOL transfer transaction
 * @param wallet - Connected Solana wallet
 * @param recipientAddress - Recipient wallet address
 * @param amountSOL - Amount to send in SOL
 * @returns Transaction signature if successful
 */
export async function sendSolTransaction(
  wallet: WalletContextState,
  recipientAddress: string,
  amountSOL: number
): Promise<TransactionResult> {
  try {
    // Validate wallet is connected
    if (!wallet.connected || !wallet.publicKey) {
      return {
        success: false,
        error: 'Wallet not connected. Please connect your wallet first.'
      };
    }

    // Validate wallet can sign transactions
    if (!wallet.signTransaction) {
      return {
        success: false,
        error: 'Wallet does not support transaction signing.'
      };
    }

    // Create connection to Solana with better RPC endpoint
    const connection = new Connection(getRpcEndpoint(), {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    // Convert recipient address to PublicKey
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (err) {
      return {
        success: false,
        error: 'Invalid recipient wallet address.'
      };
    }

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Calculate lamports (1 SOL = 1,000,000,000 lamports)
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    // Create transaction
    const transaction = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    // Sign transaction
    let signedTransaction: Transaction;
    try {
      signedTransaction = await wallet.signTransaction(transaction);
    } catch (err: any) {
      if (err.message?.includes('User rejected')) {
        return {
          success: false,
          error: 'Transaction cancelled by user.'
        };
      }
      return {
        success: false,
        error: `Failed to sign transaction: ${err.message || 'Unknown error'}`
      };
    }

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }

    return {
      success: true,
      signature,
    };

  } catch (error: any) {
    errorLogger.error('Transaction error', { error: error as Error, component: 'purchase-transaction' });
    
    // Handle specific error cases
    if (error.message?.includes('insufficient funds')) {
      return {
        success: false,
        error: 'Insufficient SOL balance. Please add more SOL to your wallet.'
      };
    }

    if (error.message?.includes('blockhash not found')) {
      return {
        success: false,
        error: 'Transaction expired. Please try again.'
      };
    }

    return {
      success: false,
      error: error.message || 'An unexpected error occurred during the transaction.'
    };
  }
}

/**
 * Get wallet SOL balance
 * @param walletAddress - Wallet public key
 * @returns Balance in SOL
 */
export async function getWalletSolBalance(walletAddress: string): Promise<number> {
  try {
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    errorLogger.error('Error fetching balance', { error: error as Error, component: 'purchase-transaction' });
    return 0;
  }
}

/**
 * Estimate transaction fees
 * @returns Estimated fee in SOL
 */
export async function estimateTransactionFee(): Promise<number> {
  try {
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    // Get fee for a typical transfer transaction
    const testTransaction = new Transaction({
      feePayer: new PublicKey('11111111111111111111111111111111'),
      blockhash,
      lastValidBlockHeight: 0,
    }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey('11111111111111111111111111111111'),
        toPubkey: new PublicKey('11111111111111111111111111111111'),
        lamports: LAMPORTS_PER_SOL,
      })
    );
    const fee = await connection.getFeeForMessage(testTransaction.compileMessage(), 'confirmed');
    return (fee.value || 5000) / LAMPORTS_PER_SOL;
  } catch (error) {
    errorLogger.error('Error estimating fee', { error: error as Error, component: 'purchase-transaction' });
    // Return typical fee as fallback
    return 0.000005; // ~5000 lamports
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 * @param walletAddress - Wallet address to check
 * @param amountSOL - Amount to send in SOL
 * @returns True if sufficient balance
 */
export async function hasSufficientBalance(
  walletAddress: string,
  amountSOL: number
): Promise<boolean> {
  try {
    const balance = await getWalletSolBalance(walletAddress);
    const fee = await estimateTransactionFee();
    return balance >= (amountSOL + fee);
  } catch (error) {
    errorLogger.error('Error checking balance', { error: error as Error, component: 'purchase-transaction' });
    return false;
  }
}
