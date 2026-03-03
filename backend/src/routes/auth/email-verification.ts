import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import { authenticateToken, type AuthenticatedRequest } from "../../plugins/auth.js";
import { validateBody, authSchemas } from "../../plugins/validation.js";
import { authRateLimit } from "../../plugins/rateLimiting.js";
import { EmailService } from "../../services/emailService.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

export default async function emailVerificationRoutes(app: FastifyInstance) {
  // Verify email with token
  app.get("/verify-email/:token", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = req.params as { token: string };

      if (!token || token.length < 32) {
        return reply.code(400).send({
          error: "INVALID_TOKEN",
          message: "Invalid verification token format"
        });
      }

      const userWithToken = await prisma.user.findFirst({
        where: { emailVerificationToken: token }
      });

      if (!userWithToken) {
        logger.warn({ tokenPrefix: token.substring(0, 8) }, "No user found with verification token");
        return reply.code(400).send({
          error: "TOKEN_NOT_FOUND",
          message: "This verification link has already been used or is invalid. If you've already verified your email, you can log in directly."
        });
      }

      if (userWithToken.emailVerified) {
        logger.info({ userId: userWithToken.id }, "Email already verified");
        return {
          success: true,
          message: "Your email is already verified! You can log in.",
          user: {
            id: userWithToken.id,
            email: userWithToken.email,
            emailVerified: true
          }
        };
      }

      const now = new Date();
      const expiryTime = userWithToken.emailVerificationExpiry;

      if (!expiryTime || expiryTime < now) {
        logger.warn({ userId: userWithToken.id, expiryTime: expiryTime?.toISOString() }, "Verification token expired");
        return reply.code(400).send({
          error: "TOKEN_EXPIRED",
          message: "This verification link has expired. Please request a new verification email from your account settings."
        });
      }

      await prisma.user.update({
        where: { id: userWithToken.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null
        }
      });

      EmailService.sendWelcomeEmail(userWithToken.email!, userWithToken.username ?? "User").catch(error => {
        logger.error({ error }, "Failed to send welcome email");
      });

      logger.info({ userId: userWithToken.id, email: userWithToken.email }, "Email verified");

      return {
        success: true,
        message: "Email verified successfully!",
        user: {
          id: userWithToken.id,
          email: userWithToken.email,
          emailVerified: true
        }
      };

    } catch (error: any) {
      logger.error({ error }, "Email verification error");
      return reply.code(500).send({
        error: "VERIFICATION_FAILED",
        message: "Failed to verify email"
      });
    }
  });

  // Resend verification email
  app.post("/resend-verification", {
    preHandler: [authenticateToken, authRateLimit, validateBody(authSchemas.resendVerification)]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return reply.code(401).send({
          error: "UNAUTHORIZED",
          message: "Authentication required"
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true
        }
      });

      if (!user) {
        return reply.code(404).send({
          error: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      if (user.emailVerified) {
        return reply.code(400).send({
          error: "ALREADY_VERIFIED",
          message: "Email is already verified"
        });
      }

      if (!user.email || user.email.includes('@wallet.solanasim.fun')) {
        return reply.code(400).send({
          error: "INVALID_EMAIL",
          message: "This account does not have a valid email address"
        });
      }

      const verificationToken = EmailService.generateToken();
      const verificationExpiry = EmailService.generateTokenExpiry(24);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry
        }
      });

      const emailSent = await EmailService.sendVerificationEmail(
        user.email!,
        verificationToken,
        user.username ?? "User"
      );

      if (!emailSent) {
        logger.error({ email: user.email }, "Failed to send verification email");
        return reply.code(500).send({
          error: "EMAIL_SEND_FAILED",
          message: "Failed to send verification email. Please try again later or contact support if the problem persists."
        });
      }

      logger.info({ userId: user.id, email: user.email }, "Verification email resent");

      return {
        success: true,
        message: "Verification email sent successfully"
      };

    } catch (error: any) {
      logger.error({ error }, "Resend verification error");
      return reply.code(500).send({
        error: "RESEND_FAILED",
        message: "Failed to resend verification email. Please try again later."
      });
    }
  });
}
