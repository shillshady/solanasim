import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import bcrypt from "bcryptjs";
import { AuthService } from "../../plugins/auth.js";
import { validateBody, authSchemas, sanitizeInput } from "../../plugins/validation.js";
import { authRateLimit } from "../../plugins/rateLimiting.js";
import { EmailService } from "../../services/emailService.js";
import * as notificationService from "../../services/notificationService.js";
import { validatePasswordStrength, getPasswordErrorMessage } from "../../utils/password-validator.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

export default async function signupRoutes(app: FastifyInstance) {
  app.post("/signup-email", {
    preHandler: [authRateLimit, validateBody(authSchemas.emailSignup)]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as {
        email: string;
        password: string;
        username?: string;
        handle?: string;
        profileImage?: string;
      };

      const { email, password, username, handle, profileImage } = sanitizedBody;

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: getPasswordErrorMessage(passwordValidation),
          details: passwordValidation.errors
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.code(409).send({
          error: "USER_EXISTS",
          message: "An account with this email already exists"
        });
      }

      const hash = await bcrypt.hash(password, 12);

      const verificationToken = EmailService.generateToken();
      const verificationExpiry = EmailService.generateTokenExpiry(24);

      const user = await prisma.user.create({
        data: {
          email,
          username: username || email.split('@')[0],
          passwordHash: hash,
          handle: handle || email.split('@')[0],
          profileImage: profileImage || null,
          virtualSolBalance: 100,
          userTier: 'EMAIL_USER',
          emailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry
        }
      });

      EmailService.sendVerificationEmail(email, verificationToken, user.username ?? email).catch(error => {
        logger.error({ error }, "Failed to send verification email");
      });

      notificationService.notifyWelcome(user.id, user.username ?? "User").catch(error => {
        logger.error({ error }, "Failed to send welcome notification");
      });

      const sessionId = await AuthService.createSession(user.id, user.userTier, {
        signupMethod: 'email',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      const { accessToken, refreshToken } = AuthService.generateTokens(user.id, user.userTier, sessionId);

      logger.info({ userId: user.id, email }, "New user registered");

      return {
        userId: user.id,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          userTier: user.userTier,
          virtualSolBalance: user.virtualSolBalance.toString(),
          emailVerified: user.emailVerified
        }
      };

    } catch (error: any) {
      logger.error({ error }, "Signup error");
      return reply.code(500).send({
        error: "SIGNUP_FAILED",
        message: "Failed to create account"
      });
    }
  });
}
