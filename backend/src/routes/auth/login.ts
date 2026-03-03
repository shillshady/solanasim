import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import bcrypt from "bcryptjs";
import redis from "../../plugins/redis.js";
import { AuthService, authenticateToken, type AuthenticatedRequest } from "../../plugins/auth.js";
import { validateBody, authSchemas, sanitizeInput } from "../../plugins/validation.js";
import { authRateLimit } from "../../plugins/rateLimiting.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

export default async function loginRoutes(app: FastifyInstance) {
  // Email login
  app.post("/login-email", {
    preHandler: [authRateLimit, validateBody(authSchemas.emailLogin)]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as {
        email: string;
        password: string;
      };

      const { email, password } = sanitizedBody;

      const lockoutKey = `lockout:${email}`;
      const failedAttemptsKey = `failed_attempts:${email}`;

      const isLockedOut = await redis.get(lockoutKey);
      if (isLockedOut) {
        const ttl = await redis.ttl(lockoutKey);
        return reply.code(429).send({
          error: "ACCOUNT_LOCKED",
          message: `Too many failed login attempts. Please try again in ${Math.ceil(ttl / 60)} minutes.`
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        const attempts = await redis.incr(failedAttemptsKey);
        await redis.expire(failedAttemptsKey, 900);

        if (attempts >= 5) {
          await redis.setex(lockoutKey, 900, '1');
          await redis.del(failedAttemptsKey);
        }

        return reply.code(401).send({
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        const attempts = await redis.incr(failedAttemptsKey);
        await redis.expire(failedAttemptsKey, 900);

        if (attempts >= 5) {
          await redis.setex(lockoutKey, 900, '1');
          await redis.del(failedAttemptsKey);
          logger.warn({ email }, "Account locked due to failed attempts");

          return reply.code(429).send({
            error: "ACCOUNT_LOCKED",
            message: "Too many failed login attempts. Your account has been locked for 15 minutes."
          });
        }

        return reply.code(401).send({
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }

      await redis.del(failedAttemptsKey);
      await redis.del(lockoutKey);

      const sessionId = await AuthService.createSession(user.id, user.userTier, {
        loginMethod: 'email',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      const { accessToken, refreshToken } = AuthService.generateTokens(user.id, user.userTier, sessionId);

      logger.info({ userId: user.id, email }, "User logged in");

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
      logger.error({ error }, "Login error");
      return reply.code(500).send({
        error: "LOGIN_FAILED",
        message: "Failed to log in"
      });
    }
  });

  // Refresh token
  app.post("/refresh-token", {
    preHandler: [validateBody(authSchemas.refreshToken)]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      const payload = AuthService.verifyToken(refreshToken);

      if (!payload.type || payload.type !== 'refresh') {
        return reply.code(401).send({
          error: "INVALID_REFRESH_TOKEN",
          message: "Invalid refresh token"
        });
      }

      const isValidSession = await AuthService.validateSession(payload.sessionId);
      if (!isValidSession) {
        return reply.code(401).send({
          error: "SESSION_EXPIRED",
          message: "Session has expired"
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, userTier: true }
      });

      if (!user) {
        await AuthService.invalidateSession(payload.sessionId);
        return reply.code(401).send({
          error: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      const { accessToken } = AuthService.generateTokens(user.id, user.userTier, payload.sessionId);

      return { accessToken };

    } catch (error: any) {
      return reply.code(401).send({
        error: "REFRESH_FAILED",
        message: "Failed to refresh token"
      });
    }
  });

  // Logout
  app.post("/logout", {
    preHandler: [authenticateToken]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      if (req.user?.sessionId) {
        await AuthService.invalidateSession(req.user.sessionId);
      }

      return { success: true, message: "Logged out successfully" };
    } catch (error: any) {
      return reply.code(500).send({
        error: "LOGOUT_FAILED",
        message: "Failed to log out"
      });
    }
  });

  // Logout from all devices
  app.post("/logout-all", {
    preHandler: [authenticateToken]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      if (req.user?.id) {
        await AuthService.invalidateAllUserSessions(req.user.id);
      }

      return { success: true, message: "Logged out from all devices" };
    } catch (error: any) {
      return reply.code(500).send({
        error: "LOGOUT_ALL_FAILED",
        message: "Failed to log out from all devices"
      });
    }
  });
}
