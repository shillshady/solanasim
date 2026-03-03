// Fastify app entrypoint
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

// Import Sentry for error monitoring
import * as Sentry from '@sentry/node';
import { initSentry, sentryErrorHandler, testSentryConnection } from "./utils/sentry.js";

// Import route handlers
import tradeRoutes from "./routes/trade.js";
import portfolioRoutes from "./routes/portfolio.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import trendingRoutes from "./routes/trending.js";
import stocksRoutes from "./routes/stocks.js";
import authRoutes from "./routes/auth/index.js";
import rewardsRoutes from "./routes/rewards.js";
import tradesRoutes from "./routes/trades.js";
import walletRoutes from "./routes/wallet.js";
import walletTrackerRoutes from "./routes/walletTracker.js";
import walletTrackerV2Routes from "./routes/walletTrackerV2.js";
import searchRoutes from "./routes/search.js";
import debugRoutes from "./routes/debug.js";
import adminRoutes from "./routes/admin.js";
import sentryTestRoutes from "./routes/sentry-test.js";
import purchaseRoutes from "./routes/purchase.js";
import notificationsRoutes from "./routes/notifications.js";
import perpRoutes from "./routes/perpRoutes.js";

// Import plugins and services
import wsPlugin from "./plugins/ws.js";
import wsWalletTrackerPlugin from "./plugins/wsWalletTracker.js";
import priceService from "./plugins/priceService/index.js";
import { generalRateLimit } from "./plugins/rateLimiting.js";
import { NonceCleanupService } from "./plugins/nonce.js";
import { RateLimitCleanupService } from "./plugins/rateLimiting.js";
import * as liquidationEngine from "./services/liquidationEngine.js";

import { validateEnvironment, getConfig, isProduction } from "./utils/env.js";
import healthPlugin from "./plugins/health.js";
import { loggers } from "./utils/logger.js";

const logger = loggers.server;

// Validate environment variables on startup (MUST be first)
validateEnvironment();
const config = getConfig();

// Initialize Sentry error monitoring
initSentry();

const app = Fastify({
  logger: { transport: { target: "pino-pretty" } }
});

// Add global error handler for Sentry
app.setErrorHandler((error, request, reply) => {
  // Capture error to Sentry
  sentryErrorHandler(error, request, reply);

  // Send response to client
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
    statusCode: error.statusCode || 500
  });
});

// Production-grade security headers
app.register(helmet, {
  // Content Security Policy - Prevent XSS attacks
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for JSON parsing in some cases
      connectSrc: [
        "'self'", 
        "wss:", 
        "https:",
        "https://api.birdeye.so",
        "https://api.dexscreener.com",
        "https://solanasim.fun",
        "wss://solanasim.fun"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https:", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      upgradeInsecureRequests: isProduction() ? [] : null // Only in production
    }
  },
  
  // HTTP Strict Transport Security - Force HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Frame-Options - Prevent clickjacking
  frameguard: {
    action: 'deny'
  },

  // X-Content-Type-Options - Prevent MIME sniffing
  noSniff: true,

  // Referrer Policy - Control referrer information
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },

  // Note: permissionsPolicy not available in current helmet version

  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // Allow external resources for trading data
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // Hide server information
  hidePoweredBy: true
});

// CORS for frontend - support multiple origins with WebSocket support
const allowedOrigins = [
  "http://localhost:3000",
  "https://solsim.fun",
  "https://www.solsim.fun",
  "https://solanasim.fun",
  "https://www.solanasim.fun",
  "https://starsol.fun",
  "https://www.starsol.fun",
  process.env.FRONTEND_URL
].filter(Boolean);

app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) {
      logger.debug('CORS accepted: no origin (mobile/postman)');
      return cb(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      logger.debug({ origin }, 'CORS accepted from allowedOrigins');
      return cb(null, true);
    }

    // Allow any subdomain of our domains
    if (origin.endsWith('.solsim.fun') || origin.endsWith('.solanasim.fun') || origin.endsWith('.starsol.fun')) {
      logger.debug({ origin }, 'CORS accepted (known domain)');
      return cb(null, true);
    }

    // Allow Vercel preview deployments (project-specific only)
    if (origin.match(/^https:\/\/solsim[a-z0-9-]*\.vercel\.app$/)) {
      logger.debug({ origin }, 'CORS accepted (Vercel deployment)');
      return cb(null, true);
    }

    logger.warn({ origin }, 'CORS rejected origin');
    // Return error instead of false to ensure proper headers are sent
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  // Add WebSocket-specific headers and cache control headers
  allowedHeaders: ['Content-Type', 'Authorization', 'Upgrade', 'Connection', 'Sec-WebSocket-Key', 'Sec-WebSocket-Version', 'Sec-WebSocket-Protocol', 'Cache-Control', 'Pragma'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Explicitly set preflight to continue so OPTIONS requests get proper responses
  preflightContinue: false,
  optionsSuccessStatus: 204
});

app.register(healthPlugin);

// WebSocket support - register BEFORE any other routes for proper Railway compatibility
// Disable perMessageDeflate to prevent proxy/CDN negotiation edge cases
app.register(websocket, {
  options: {
    perMessageDeflate: false,
    maxPayload: 100 * 1024, // 100KB max payload
    clientTracking: true
  }
})

// Register WebSocket routes BEFORE rate limiting
app.register(wsPlugin)
app.register(wsWalletTrackerPlugin)

// Legacy rate limiting fallback for non-covered routes
app.register(async function (app) {
  app.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for WebSocket upgrade requests
    if (request.headers.upgrade === 'websocket') {
      return;
    }
    return generalRateLimit(request, reply);
  });
});

// Health check is now handled by healthPlugin

// API Routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(tradeRoutes, { prefix: "/api/trade" });
app.register(portfolioRoutes, { prefix: "/api/portfolio" });
app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
app.register(trendingRoutes, { prefix: "/api/trending" });
app.register(stocksRoutes, { prefix: "/api/stocks" });
app.register(rewardsRoutes, { prefix: "/api/rewards" });
app.register(tradesRoutes, { prefix: "/api/trades" });
app.register(walletRoutes, { prefix: "/api/wallet" });
app.register(walletTrackerRoutes, { prefix: "/api/wallet-tracker" });
app.register(walletTrackerV2Routes, { prefix: "/api/wallet-tracker/v2" });
app.register(searchRoutes, { prefix: "/api/search" });
app.register(purchaseRoutes, { prefix: "/api/purchase" });
app.register(notificationsRoutes, { prefix: "/api/notifications" });
app.register(perpRoutes, { prefix: "/api/perp" }); // Perpetual trading routes
app.register(debugRoutes); // Debug routes for price service monitoring
app.register(adminRoutes, { prefix: "/api/admin" }); // Admin maintenance routes (protected)
app.register(sentryTestRoutes); // Sentry test routes (dev only)

// Start background services
logger.info("Starting background services");

// Start cleanup services
NonceCleanupService.start();
RateLimitCleanupService.start();

// Start WS price streamer (Birdeye) + warm SOL price
await priceService.start();

// Start liquidation engine for perpetual trading
await liquidationEngine.startLiquidationEngine();
logger.info("Liquidation engine started");

const port = Number(process.env.PORT || 4000);

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown");

  try {
    // Stop accepting new connections
    await app.close();
    
    // Stop background services
    logger.info("Stopping background services");
    NonceCleanupService.stop();
    RateLimitCleanupService.stop();
    await priceService.stop();
    await liquidationEngine.stopLiquidationEngine();

    logger.info("Graceful shutdown completed");
    // Safety net: force exit after 5s if event loop doesn't drain
    setTimeout(() => process.exit(0), 5000).unref();
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  // Send to Sentry before shutting down
  Sentry.captureException(error, {
    tags: { type: 'uncaughtException' },
    level: 'fatal'
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason: String(reason) }, "Unhandled rejection");
  // Log to Sentry but don't shut down — non-critical rejections shouldn't kill the server
  Sentry.captureException(new Error(`Unhandled Rejection: ${reason}`), {
    tags: { type: 'unhandledRejection' },
    level: 'error',
    extra: { promise, reason }
  });
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  logger.info({ port }, "Solana Sim API running");
  logger.info("Security: JWT, Production Rate Limiting, Input Validation, Secure Nonces");
  logger.info("Monitoring: Health checks, Request tracking, Error logging");
  logger.info("Performance: Redis caching, Database optimization, Connection pooling");

  // Test Sentry connection on startup
  if (process.env.SENTRY_DSN) {
    logger.info("Sentry error monitoring enabled");
    testSentryConnection();
  }
});
