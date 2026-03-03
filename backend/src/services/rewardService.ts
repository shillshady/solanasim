// Reward service placeholder
import prisma from "../plugins/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { loggers } from "../utils/logger.js";
const logger = loggers.rewards;

// Initialize reward system configuration from environment variables
let SIM_MINT: PublicKey | null = null;
let REWARDS_WALLET: Keypair | null = null;

// Initialize from environment variables
try {
  if (process.env.VSOL_TOKEN_MINT) {
    SIM_MINT = new PublicKey(process.env.VSOL_TOKEN_MINT);
    logger.info({ mint: SIM_MINT.toBase58() }, "VSOL Token Mint configured");
  } else {
    logger.warn("VSOL_TOKEN_MINT not configured - reward claiming disabled");
  }

  if (process.env.REWARDS_WALLET_SECRET) {
    const secretKeyArray = JSON.parse(process.env.REWARDS_WALLET_SECRET);
    REWARDS_WALLET = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    logger.info({ wallet: REWARDS_WALLET.publicKey.toBase58() }, "Rewards Wallet configured");
  } else {
    logger.warn("REWARDS_WALLET_SECRET not configured - reward claiming disabled");
  }

  // Validate both are set together
  if ((SIM_MINT && !REWARDS_WALLET) || (!SIM_MINT && REWARDS_WALLET)) {
    logger.error("Both VSOL_TOKEN_MINT and REWARDS_WALLET_SECRET must be configured together");
    SIM_MINT = null;
    REWARDS_WALLET = null;
  }
} catch (error) {
  logger.error({ err: error }, "Failed to initialize reward system");
  SIM_MINT = null;
  REWARDS_WALLET = null;
}

const RPC_URL = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// Check if reward system is enabled
export function isRewardSystemEnabled(): boolean {
  return SIM_MINT !== null && REWARDS_WALLET !== null;
}

// --- 1. Add points whenever a trade is made ---
export async function addTradePoints(userId: string, tradeVolumeUsd: Decimal) {
  await prisma.user.update({
    where: { id: userId },
    data: { rewardPoints: { increment: tradeVolumeUsd } }
  });
}

// --- 2. Snapshot epoch & allocate pool ---
export async function snapshotRewards(epoch: number, poolAmount: Decimal) {
  try {
    const users = await prisma.user.findMany({ where: { rewardPoints: { gt: 0 } } });
    
    if (users.length === 0) {
      logger.info({ epoch }, "No users with reward points for epoch");
      return;
    }
    
    const totalPoints = users.reduce((sum: Decimal, u: any) => sum.add(u.rewardPoints as any), new Decimal(0));
    
    if (totalPoints.eq(0)) {
      logger.info({ epoch }, "Total points is 0 for epoch");
      return;
    }

    // Create snapshot record
    await prisma.rewardSnapshot.create({
      data: { epoch, totalPoints, poolAmount }
    });

    logger.info({ epoch, userCount: users.length, totalPoints: totalPoints.toString(), poolAmount: poolAmount.toString() }, "Created reward snapshot");

    // Record claim entitlements in batch
    const claimData = [];
    for (const u of users) {
      const share = (u.rewardPoints as any as Decimal).div(totalPoints);
      const amount = poolAmount.mul(share);

      if (amount.gt(0) && u.walletAddress) {
        claimData.push({
          userId: u.id,
          epoch,
          wallet: u.walletAddress,
          amount,
          status: "PENDING"
        });
      }
    }
    
    // Batch create claims
    if (claimData.length > 0) {
      await prisma.rewardClaim.createMany({
        data: claimData
      });
      logger.info({ claimCount: claimData.length }, "Created reward claims");
    }
    
    // Reset points for next round (batch update)
    await prisma.user.updateMany({
      where: { id: { in: users.map((u: any) => u.id) } },
      data: { rewardPoints: new Decimal(0) }
    });
    
    logger.info({ userCount: users.length }, "Reset reward points");
    
  } catch (error) {
    logger.error({ epoch, err: error }, "Snapshot failed");
    throw error;
  }
}

// --- 3. Claim rewards ---
export async function claimReward(userId: string, epoch: number, wallet: string) {
  // Check if reward system is configured
  if (!SIM_MINT || !REWARDS_WALLET) {
    throw new Error("Reward system not configured. Please set VSOL_TOKEN_MINT and REWARDS_WALLET_SECRET environment variables.");
  }

  const claim = await prisma.rewardClaim.findFirst({
    where: { userId, epoch, claimedAt: null }
  });
  if (!claim) throw new Error("No claimable rewards");

  try {
    const userWallet = new PublicKey(wallet);
    const userAta = await getAssociatedTokenAddress(SIM_MINT, userWallet);
    const rewardsAta = await getAssociatedTokenAddress(SIM_MINT, REWARDS_WALLET.publicKey);
    
    // Check if user's ATA exists, create if needed
    const userAtaInfo = await connection.getAccountInfo(userAta);
    const tx = new Transaction();
    
    if (!userAtaInfo) {
      const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
      tx.add(
        createAssociatedTokenAccountInstruction(
          REWARDS_WALLET.publicKey, // payer
          userAta,
          userWallet,
          SIM_MINT
        )
      );
    }
    
    // Add transfer instruction
    const transferAmount = Math.floor(claim.amount.toNumber() * 10 ** 6); // 6 decimals
    tx.add(
      createTransferInstruction(
        rewardsAta,
        userAta,
        REWARDS_WALLET.publicKey,
        transferAmount
      )
    );

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = REWARDS_WALLET.publicKey;
    
    // Send and confirm transaction
    const sig = await connection.sendTransaction(tx, [REWARDS_WALLET], {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    });

    // Update claim record
    await prisma.rewardClaim.update({
      where: { id: claim.id },
      data: { 
        claimedAt: new Date(), 
        txSig: sig,
        status: "COMPLETED"
      }
    });

    logger.info({ amount: claim.amount.toString(), wallet, txSig: sig }, "Reward claimed");
    return { sig, amount: claim.amount };
    
  } catch (error: any) {
    // Mark claim as failed
    await prisma.rewardClaim.update({
      where: { id: claim.id },
      data: { status: "FAILED" }
    });
    
    logger.error({ wallet, err: error }, "Reward claim failed");
    throw new Error(`Reward claim failed: ${error.message}`);
  }
}
