import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import bcrypt from "bcryptjs";
import { AuthService, authenticateToken, type AuthenticatedRequest } from "../../plugins/auth.js";
import { validateBody, authSchemas, sanitizeInput } from "../../plugins/validation.js";
import { authRateLimit, sensitiveRateLimit } from "../../plugins/rateLimiting.js";
import { EmailService } from "../../services/emailService.js";
import { validatePasswordStrength, getPasswordErrorMessage } from "../../utils/password-validator.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

export default async function passwordRoutes(app: FastifyInstance) {
  // Change password
  app.post("/change-password", {
    preHandler: [authenticateToken, sensitiveRateLimit, validateBody(authSchemas.changePassword)]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as {
        userId: string;
        currentPassword: string;
        newPassword: string;
      };

      const { userId, currentPassword, newPassword } = sanitizedBody;

      if (req.user?.id !== userId) {
        return reply.code(403).send({
          error: "FORBIDDEN",
          message: "You can only change your own password"
        });
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: getPasswordErrorMessage(passwordValidation),
          details: passwordValidation.errors
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user || !user.passwordHash) {
        return reply.code(404).send({
          error: "USER_NOT_FOUND",
          message: "User not found or no password set"
        });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return reply.code(401).send({
          error: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect"
        });
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash }
      });

      await AuthService.invalidateAllUserSessions(userId);

      logger.info({ userId }, "Password changed");

      return {
        success: true,
        message: "Password updated successfully. Please log in again."
      };

    } catch (error: any) {
      logger.error({ error }, "Change password error");
      return reply.code(500).send({
        error: "PASSWORD_CHANGE_FAILED",
        message: "Failed to change password"
      });
    }
  });

  // Request password reset
  app.post("/forgot-password", {
    preHandler: [authRateLimit]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email } = req.body as { email: string };

      if (!email) {
        return reply.code(400).send({
          error: "MISSING_EMAIL",
          message: "Email is required"
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success to prevent email enumeration
      if (!user || !user.passwordHash) {
        logger.info({ email }, "Password reset requested for non-existent/wallet user");
        return {
          success: true,
          message: "If an account exists with this email, you will receive password reset instructions"
        };
      }

      const resetToken = EmailService.generateToken();
      const resetExpiry = EmailService.generateTokenExpiry(1);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry
        }
      });

      await EmailService.sendPasswordResetEmail(user.email!, resetToken, user.username ?? "User");

      logger.info({ userId: user.id }, "Password reset email sent");

      return {
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions"
      };

    } catch (error: any) {
      logger.error({ error }, "Forgot password error");
      return {
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions"
      };
    }
  });

  // Reset password with token
  app.post("/reset-password", {
    preHandler: [authRateLimit]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      if (!token || !newPassword) {
        return reply.code(400).send({
          error: "MISSING_FIELDS",
          message: "Token and new password are required"
        });
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: getPasswordErrorMessage(passwordValidation),
          details: passwordValidation.errors
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpiry: { gte: new Date() }
        }
      });

      if (!user) {
        return reply.code(400).send({
          error: "INVALID_OR_EXPIRED_TOKEN",
          message: "Password reset link is invalid or has expired"
        });
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetToken: null,
          passwordResetExpiry: null
        }
      });

      await AuthService.invalidateAllUserSessions(user.id);

      logger.info({ userId: user.id }, "Password reset successful");

      return {
        success: true,
        message: "Password reset successfully. Please log in with your new password."
      };

    } catch (error: any) {
      logger.error({ error }, "Reset password error");
      return reply.code(500).send({
        error: "RESET_FAILED",
        message: "Failed to reset password"
      });
    }
  });
}
