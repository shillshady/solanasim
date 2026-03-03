// Prisma client singleton with connection pooling for production scale
import { PrismaClient } from "@prisma/client";
import { loggers } from "../utils/logger.js";

const logger = loggers.database;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Calculate optimal connection pool based on environment
// Railway Postgres Starter: 20 connections total
// OPTIMIZED: Increased from 15 to 20 connections, reduced timeout for faster failure
const getConnectionPoolConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return {
      connection_limit: 20,        // Increased from 15 (use full Railway allocation)
      pool_timeout: 30,            // Reduced from 60 (fail faster)
      statement_cache_size: 1000   // Increased from 500 (better query caching)
    };
  }

  return {
    connection_limit: 5,
    pool_timeout: 30,
    statement_cache_size: 100
  };
};

// Enhance DATABASE_URL with pooling parameters
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return baseUrl;

  const config = getConnectionPoolConfig();
  const url = new URL(baseUrl);

  // Add connection pool parameters
  url.searchParams.set('connection_limit', config.connection_limit.toString());
  url.searchParams.set('pool_timeout', config.pool_timeout.toString());
  url.searchParams.set('statement_cache_size', config.statement_cache_size.toString());

  return url.toString();
};

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  },
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Connection monitoring
let activeConnections = 0;
let peakConnections = 0;

prisma.$use(async (params, next) => {
  activeConnections++;
  peakConnections = Math.max(peakConnections, activeConnections);

  // OPTIMIZED: Alert at 60% instead of 80% for earlier warning
  const config = getConnectionPoolConfig();
  const utilization = activeConnections / config.connection_limit;

  if (utilization > 0.8) {
    logger.error({ activeConnections, connectionLimit: config.connection_limit, utilizationPct: (utilization * 100).toFixed(0) }, "CRITICAL DB connection alert");
    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
  } else if (utilization > 0.6) {
    logger.warn({ activeConnections, connectionLimit: config.connection_limit, utilizationPct: (utilization * 100).toFixed(0) }, "High DB connection usage");
  }

  try {
    return await next(params);
  } finally {
    activeConnections--;
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Disconnecting Prisma");
  await prisma.$disconnect();
};

process.on("beforeExit", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Export connection stats for monitoring
export function getConnectionStats() {
  const config = getConnectionPoolConfig();
  return {
    active: activeConnections,
    peak: peakConnections,
    limit: config.connection_limit,
    utilization: ((peakConnections / config.connection_limit) * 100).toFixed(1) + '%'
  };
}

logger.info({ poolConfig: getConnectionPoolConfig() }, "Prisma initialized with connection pooling");

export default prisma;
