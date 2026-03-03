// Purchase verification service - verifies Solana transactions
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { loggers } from "../utils/logger.js";
const logger = loggers.purchase;

const RECIPIENT_WALLET = process.env.RECIPIENT_WALLET || '8i6HFhHLfBX9Wwd2BTkd7yeXZGcdwtAgg4vRRB4xf1iL';
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || process.env.HELIUS_RPC || 'https://api.mainnet-beta.solana.com';

// Define purchase tiers (must match frontend)
export const PURCHASE_TIERS = {
  TIER_1: { realSol: 0.05, simulatedSol: 100, label: 'Starter' },
  TIER_2: { realSol: 0.1, simulatedSol: 220, label: 'Bronze' },
  TIER_3: { realSol: 0.25, simulatedSol: 600, label: 'Silver (Popular)' },
  TIER_4: { realSol: 0.5, simulatedSol: 1300, label: 'Gold' },
  TIER_5: { realSol: 1.0, simulatedSol: 2800, label: 'Platinum' },
} as const;

export type PurchaseTier = typeof PURCHASE_TIERS[keyof typeof PURCHASE_TIERS];

// Validate tier amount
export function validateTierAmount(amount: number): PurchaseTier | null {
  for (const tier of Object.values(PURCHASE_TIERS)) {
    if (Math.abs(tier.realSol - amount) < 0.0001) { // Allow small floating point differences
      return tier;
    }
  }
  return null;
}

// Get tier by amount
export function getTierByAmount(amount: number): PurchaseTier | null {
  return validateTierAmount(amount);
}

// Create Solana connection
export function createSolanaConnection(): Connection {
  return new Connection(RPC_ENDPOINT, 'confirmed');
}

// Verify transaction exists and matches expected parameters
export async function verifyTransaction(
  transactionSignature: string,
  expectedAmount: number,
  senderWallet: string
): Promise<{
  success: boolean;
  error?: string;
  actualAmount?: number;
  recipientWallet?: string;
}> {
  try {
    const connection = createSolanaConnection();
    
    // Fetch transaction details
    const transaction = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!transaction) {
      return { success: false, error: 'Transaction not found on blockchain' };
    }

    // Check transaction was successful
    if (transaction.meta?.err) {
      return { success: false, error: 'Transaction failed on blockchain' };
    }

    // Parse transaction to find SOL transfer
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction.message.getAccountKeys().staticAccountKeys;

    // Find recipient account index
    const recipientPubkey = new PublicKey(RECIPIENT_WALLET);
    let recipientIndex = -1;
    let senderIndex = -1;

    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].equals(recipientPubkey)) {
        recipientIndex = i;
      }
      if (accountKeys[i].toBase58() === senderWallet) {
        senderIndex = i;
      }
    }

    if (recipientIndex === -1) {
      return { 
        success: false, 
        error: 'Transaction does not include the correct recipient wallet' 
      };
    }

    if (senderIndex === -1) {
      return { 
        success: false, 
        error: 'Transaction sender does not match provided wallet address' 
      };
    }

    // Calculate amount transferred to recipient
    const recipientBalanceChange = postBalances[recipientIndex] - preBalances[recipientIndex];
    const actualAmountSOL = recipientBalanceChange / LAMPORTS_PER_SOL;

    // Verify amount (allow 0.5% tolerance for fees)
    const tolerance = expectedAmount * 0.005;
    if (Math.abs(actualAmountSOL - expectedAmount) > tolerance) {
      return {
        success: false,
        error: `Amount mismatch: expected ${expectedAmount} SOL, got ${actualAmountSOL.toFixed(4)} SOL`,
        actualAmount: actualAmountSOL
      };
    }

    return {
      success: true,
      actualAmount: actualAmountSOL,
      recipientWallet: RECIPIENT_WALLET
    };

  } catch (error: any) {
    logger.error({ err: error }, "Transaction verification error");
    return {
      success: false,
      error: error.message || 'Failed to verify transaction'
    };
  }
}

// Check if transaction signature has already been used
export async function isTransactionUsed(
  prisma: any,
  transactionSignature: string
): Promise<boolean> {
  const existing = await prisma.solPurchase.findUnique({
    where: { transactionSignature }
  });
  return !!existing;
}

// Get recipient wallet address
export function getRecipientWallet(): string {
  return RECIPIENT_WALLET;
}
