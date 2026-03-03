/**
 * Notification Routes
 *
 * API endpoints for managing user notifications
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import * as notificationService from '../services/notificationService.js';
import { authenticateToken, type AuthenticatedRequest } from '../plugins/auth.js';

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/notifications
   * Get user notifications
   */
  fastify.get(
    '/',
    {
      preHandler: [authenticateToken],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
            unreadOnly: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'notifications', 'unreadCount', 'hasMore'],
            properties: {
              success: { type: 'boolean', const: true },
              notifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    category: { type: 'string' },
                    title: { type: 'string' },
                    message: { type: 'string' },
                    read: { type: 'boolean' },
                    metadata: { type: 'string' },
                    actionUrl: { type: ['string', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              unreadCount: { type: 'number' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const userId = request.user!.id;
      const query = request.query as any;
      const limit = query.limit ? Number(query.limit) : 50;
      const offset = query.offset ? Number(query.offset) : 0;
      const unreadOnly = query.unreadOnly === 'true';

      const [notifications, unreadCount] = await Promise.all([
        notificationService.getUserNotifications(userId, limit, offset, unreadOnly),
        notificationService.getUnreadCount(userId),
      ]);

      const hasMore = notifications.length === limit;

      return {
        success: true,
        notifications,
        unreadCount,
        hasMore,
      };
    }
  );

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count
   */
  fastify.get(
    '/unread-count',
    {
      preHandler: [authenticateToken],
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['success', 'count'],
            properties: {
              success: { type: 'boolean', const: true },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const userId = request.user!.id;
      const count = await notificationService.getUnreadCount(userId);

      return {
        success: true,
        count,
      };
    }
  );

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications as read
   * NOTE: Must be registered BEFORE /:id/read to avoid Fastify matching "read-all" as :id
   */
  fastify.patch(
    '/read-all',
    {
      preHandler: [authenticateToken],
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean', const: true },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const userId = request.user!.id;
      await notificationService.markAllNotificationsAsRead(userId);

      return { success: true };
    }
  );

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read
   */
  fastify.patch(
    '/:id/read',
    {
      preHandler: [authenticateToken],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean', const: true },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const userId = request.user!.id;
      const { id } = request.params as { id: string };

      await notificationService.markNotificationAsRead(id, userId);

      return { success: true };
    }
  );

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticateToken],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean', const: true },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const userId = request.user!.id;
      const { id } = request.params as { id: string };

      await notificationService.deleteNotification(id, userId);

      return { success: true };
    }
  );
};

export default notificationsRoutes;
