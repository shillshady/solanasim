import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import redis from "../../plugins/redis.js";
import { getWalletBalances } from "../../services/walletService.js";
import { AuthService } from "../../plugins/auth.js";
import { validateBody, authSchemas, sanitizeInput } from "../../plugins/validation.js";
import { walletRateLimit } from "../../plugins/rateLimiting.js";
import { NonceService } from "../../plugins/nonce.js";
import * as notificationService from "../../services/notificationService.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

async function checkAndUpgradeVSOLHolder(userId: string, walletAddress: string) {
  try {
    const balances = await getWalletBalances(walletAddress);
    const vsolBalance = balances.find((token: any) =>
      token.mint === process.env.VSOL_TOKEN_MINT && token.uiAmount > 0
    );

    if (vsolBalance) {
      await prisma.user.update({
        where: { id: userId },
        data: { virtualSolBalance: 100 }
      });
      logger.info({ walletAddress }, "Upgraded VSOL holder to 100 SIM");
    }
  } catch (error) {
    logger.warn({ error, walletAddress }, "Failed to check VSOL holdings");
  }
}

export default async function walletRoutes(app: FastifyInstance) {
  // Wallet nonce generation
  app.post("/wallet/nonce", {
    preHandler: [walletRateLimit, validateBody(authSchemas.walletNonce)]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as { walletAddress: string };
      const { walletAddress } = sanitizedBody;

      const nonce = await NonceService.generateNonce(walletAddress);

      const walletUser = await prisma.user.upsert({
        where: { walletAddress },
        update: {
          walletNonce: null
        },
        create: {
          email: `${walletAddress.slice(0, 8)}@wallet.solanasim.fun`,
          username: walletAddress.slice(0, 16),
          handle: walletAddress.slice(0, 16),
          passwordHash: '',
          walletAddress,
          walletNonce: null,
          virtualSolBalance: 100,
          userTier: 'WALLET_USER'
        }
      });

      const isNewUser = await prisma.user.count({ where: { walletAddress } }) === 1;
      if (isNewUser) {
        notificationService.notifyWelcome(walletUser.id, walletUser.username ?? "User").catch(error => {
          logger.error({ error }, "Failed to send welcome notification");
        });
      }

      const message = NonceService.createSIWSMessage(walletAddress, nonce);

      return {
        nonce,
        message,
        expiresIn: 300
      };

    } catch (error: any) {
      logger.error({ error }, "Nonce generation error");

      if (error.message.includes('Too many nonce requests')) {
        return reply.code(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message: error.message
        });
      }

      return reply.code(500).send({
        error: "NONCE_GENERATION_FAILED",
        message: "Failed to generate authentication nonce"
      });
    }
  });

  // Wallet signature verification
  app.post("/wallet/verify", {
    preHandler: [walletRateLimit, validateBody(authSchemas.walletVerify)]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as {
        walletAddress: string;
        signature: string;
      };

      const { walletAddress, signature } = sanitizedBody;

      const user = await prisma.user.findUnique({ where: { walletAddress } });
      if (!user) {
        return reply.code(400).send({
          error: "USER_NOT_FOUND",
          message: "Wallet not found. Please request a new nonce."
        });
      }

      const hasValidNonce = await NonceService.hasValidNonce(walletAddress);
      if (!hasValidNonce) {
        return reply.code(400).send({
          error: "NONCE_EXPIRED",
          message: "Authentication nonce has expired. Please request a new one."
        });
      }

      const storedNonce = await redis.get(`nonce:${walletAddress}`);
      if (!storedNonce) {
        return reply.code(400).send({
          error: "NONCE_MISSING",
          message: "Authentication nonce not found"
        });
      }

      const message = NonceService.createSIWSMessage(walletAddress, storedNonce);
      const messageBytes = new TextEncoder().encode(message);

      try {
        const sig = bs58.decode(signature);
        const pub = bs58.decode(walletAddress);

        const isValidSignature = nacl.sign.detached.verify(messageBytes, sig, pub);
        if (!isValidSignature) {
          return reply.code(401).send({
            error: "INVALID_SIGNATURE",
            message: "Invalid wallet signature"
          });
        }
      } catch (sigError) {
        return reply.code(401).send({
          error: "SIGNATURE_DECODE_ERROR",
          message: "Failed to decode signature"
        });
      }

      const isNonceValid = await NonceService.verifyAndConsumeNonce(walletAddress, storedNonce);
      if (!isNonceValid) {
        return reply.code(401).send({
          error: "NONCE_VERIFICATION_FAILED",
          message: "Nonce verification failed"
        });
      }

      await checkAndUpgradeVSOLHolder(user.id, walletAddress);

      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!updatedUser) {
        return reply.code(500).send({
          error: "USER_UPDATE_FAILED",
          message: "Failed to update user data"
        });
      }

      const sessionId = await AuthService.createSession(updatedUser.id, updatedUser.userTier, {
        loginMethod: 'wallet',
        walletAddress,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      const { accessToken, refreshToken } = AuthService.generateTokens(
        updatedUser.id,
        updatedUser.userTier,
        sessionId
      );

      logger.info({ walletAddress: walletAddress.slice(0, 8), userId: updatedUser.id }, "Wallet authenticated");

      return {
        userId: updatedUser.id,
        accessToken,
        refreshToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          userTier: updatedUser.userTier,
          virtualSolBalance: updatedUser.virtualSolBalance.toString(),
          walletAddress: updatedUser.walletAddress
        }
      };

    } catch (error: any) {
      logger.error({ error }, "Wallet verification error");
      return reply.code(500).send({
        error: "WALLET_VERIFICATION_FAILED",
        message: "Failed to verify wallet signature"
      });
    }
  });
}
