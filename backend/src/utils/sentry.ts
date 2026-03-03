import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from '../utils/logger.js';

export function initSentry() {
  const SENTRY_DSN = process.env.SENTRY_DSN;

  if (!SENTRY_DSN) {
    logger.info('Sentry DSN not found, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Profiling (requires tracesSampleRate > 0)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Release tracking
    release: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    // Additional options
    beforeSend(event, hint) {
      // Filter out non-error events in production
      if (process.env.NODE_ENV === 'production') {
        const error = hint.originalException;
        // Don't send validation errors to Sentry
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            return null; // Don't send client errors
          }
        }
      }
      return event;
    },
  });

  logger.info('Sentry initialized successfully');
}

// Error handler middleware for Fastify
export function sentryErrorHandler(error: Error, request: any, reply: any) {
  Sentry.captureException(error, {
    contexts: {
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
        params: request.params,
      },
    },
    user: request.user ? {
      id: request.user.id,
      email: request.user.email,
    } : undefined,
  });
}

// Test Sentry connection
export function testSentryConnection() {
  try {
    Sentry.captureMessage('Sentry test message from Solana Sim backend', 'info');
    logger.info('Test message sent to Sentry');

    // Also test error capture
    const testError = new Error('Test error from Solana Sim backend initialization');
    Sentry.captureException(testError);
    logger.info('Test error sent to Sentry');

    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to test Sentry');
    return false;
  }
}