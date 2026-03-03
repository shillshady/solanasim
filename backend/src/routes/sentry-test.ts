import type { FastifyInstance } from 'fastify';
import * as Sentry from '@sentry/node';

export default async function sentryTestRoutes(app: FastifyInstance) {
  // Test endpoint for Sentry - only enabled in development or when ENABLE_SENTRY_TEST is set
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SENTRY_TEST === 'true') {
    app.get('/api/sentry-test', async (request, reply) => {
      reply.send({
        message: 'Sentry test endpoints available',
        endpoints: [
          '/api/sentry-test/message',
          '/api/sentry-test/error',
          '/api/sentry-test/unhandled'
        ]
      });
    });

    // Send a test message to Sentry
    app.get('/api/sentry-test/message', async (request, reply) => {
      const message = `Test message from Solana Sim at ${new Date().toISOString()}`;
      Sentry.captureMessage(message, 'info');

      reply.send({
        success: true,
        message: 'Test message sent to Sentry',
        details: message
      });
    });

    // Throw a handled error for Sentry to catch
    app.get('/api/sentry-test/error', async (request, reply) => {
      try {
        // Simulate an error
        throw new Error(`Test error from Solana Sim at ${new Date().toISOString()}`);
      } catch (error) {
        // This will be caught by the global error handler
        throw error;
      }
    });

    // Trigger an unhandled rejection (will crash in production)
    app.get('/api/sentry-test/unhandled', async (request, reply) => {
      reply.send({
        warning: 'This will trigger an unhandled rejection in 1 second',
        note: 'Check Sentry dashboard for the error'
      });

      // Simulate an unhandled rejection
      setTimeout(() => {
        Promise.reject(new Error('Test unhandled rejection from Solana Sim'));
      }, 1000);
    });
  }
}