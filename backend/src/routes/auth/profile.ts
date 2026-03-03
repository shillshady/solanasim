import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../../plugins/prisma.js";
import { authenticateToken, type AuthenticatedRequest } from "../../plugins/auth.js";
import { validateBody, authSchemas, sanitizeInput } from "../../plugins/validation.js";
import { invalidateLeaderboardCache } from "../../utils/redis-helpers.js";
import { loggers } from "../../utils/logger.js";

const logger = loggers.auth;

export default async function profileRoutes(app: FastifyInstance) {
  // Profile update
  app.post("/profile", {
    preHandler: [authenticateToken, validateBody(authSchemas.profileUpdate)]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      const sanitizedBody = sanitizeInput(req.body) as {
        userId: string;
        username?: string;
        handle?: string;
        profileImage?: string;
        bio?: string;
        displayName?: string;
      };

      const { userId, username, handle, profileImage, bio, displayName } = sanitizedBody;

      if (req.user?.id !== userId) {
        return reply.code(403).send({
          error: "FORBIDDEN",
          message: "You can only update your own profile"
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          username,
          handle,
          profileImage,
          avatarUrl: profileImage,
          avatar: profileImage,
          bio,
          displayName
        }
      });

      await invalidateLeaderboardCache("profile-update");

      return {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          handle: updatedUser.handle,
          profileImage: updatedUser.profileImage,
          avatarUrl: updatedUser.avatarUrl,
          bio: updatedUser.bio,
          displayName: updatedUser.displayName
        }
      };
    } catch (error: any) {
      return reply.code(500).send({
        error: "PROFILE_UPDATE_FAILED",
        message: "Failed to update profile"
      });
    }
  });

  // Get user profile
  app.get("/user/:userId", async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!uuidRegex.test(userId)) {
      return reply.code(400).send({
        error: "INVALID_USER_ID",
        message: "Invalid user ID format"
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          avatar: true,
          avatarUrl: true,
          twitter: true,
          discord: true,
          telegram: true,
          website: true,
          virtualSolBalance: true,
          userTier: true,
          walletAddress: true,
          handle: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return reply.code(404).send({
          error: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      return {
        ...user,
        virtualSolBalance: user.virtualSolBalance.toString()
      };
    } catch (error: any) {
      logger.error({ error, userId }, "Get user profile error");
      return reply.code(500).send({
        error: "FETCH_USER_FAILED",
        message: "Failed to fetch user profile"
      });
    }
  });

  // Update avatar
  app.post("/update-avatar", {
    preHandler: [authenticateToken]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      const { userId, avatarUrl } = req.body as {
        userId: string;
        avatarUrl: string;
      };

      if (!userId || !avatarUrl) {
        return reply.code(400).send({
          error: "MISSING_FIELDS",
          message: "userId and avatarUrl required"
        });
      }

      if (req.user?.id !== userId) {
        return reply.code(403).send({
          error: "FORBIDDEN",
          message: "You can only update your own avatar"
        });
      }

      const isDataUrl = avatarUrl.startsWith('data:image/');
      const isHttpUrl = avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://');

      if (!isDataUrl && !isHttpUrl) {
        return reply.code(400).send({
          error: "INVALID_URL",
          message: "Avatar must be a valid URL or base64 data URL"
        });
      }

      if (isHttpUrl) {
        try {
          new URL(avatarUrl);
        } catch {
          return reply.code(400).send({
            error: "INVALID_URL",
            message: "Invalid avatar URL format"
          });
        }
      }

      if (isDataUrl) {
        const validImageTypes = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/webp', 'data:image/gif'];
        const isValidType = validImageTypes.some(type => avatarUrl.startsWith(type));

        if (!isValidType) {
          return reply.code(400).send({
            error: "INVALID_IMAGE_TYPE",
            message: "Only JPEG, PNG, WebP, and GIF images are allowed"
          });
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: avatarUrl,
          avatar: avatarUrl,
          profileImage: avatarUrl
        }
      });

      await invalidateLeaderboardCache("avatar-update");

      return {
        success: true,
        avatarUrl: user.avatarUrl,
        message: "Avatar updated successfully"
      };

    } catch (error: any) {
      logger.error({ error }, "Update avatar error");
      return reply.code(500).send({
        error: "AVATAR_UPDATE_FAILED",
        message: "Failed to update avatar"
      });
    }
  });

  // Remove avatar
  app.post("/remove-avatar", {
    preHandler: [authenticateToken]
  }, async (req: AuthenticatedRequest, reply) => {
    try {
      const { userId } = req.body as { userId: string };

      if (!userId) {
        return reply.code(400).send({
          error: "MISSING_USER_ID",
          message: "userId required"
        });
      }

      if (req.user?.id !== userId) {
        return reply.code(403).send({
          error: "FORBIDDEN",
          message: "You can only remove your own avatar"
        });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: null,
          avatar: null,
          profileImage: null
        }
      });

      await invalidateLeaderboardCache("avatar-remove");

      return {
        success: true,
        message: "Avatar removed successfully"
      };

    } catch (error: any) {
      logger.error({ error }, "Remove avatar error");
      return reply.code(500).send({
        error: "AVATAR_REMOVAL_FAILED",
        message: "Failed to remove avatar"
      });
    }
  });
}
