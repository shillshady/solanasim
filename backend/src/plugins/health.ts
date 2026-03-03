// Health check and monitoring module
import { FastifyInstance } from 'fastify';
import prisma from './prisma.js';
import redis from './redis.js';
import priceService from './priceService.js';
import { performance } from 'perf_hooks';
import { loggers } from '../utils/logger.js';

const logger = loggers.server;

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    priceService: ComponentHealth;
    memory: ComponentHealth;
  };
  metrics?: {
    activeConnections?: number;
    requestsPerMinute?: number;
    avgResponseTime?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

// Track metrics
let requestCount = 0;
let totalResponseTime = 0;
const requestTimestamps: number[] = [];
const startTime = Date.now();

// Helper to check component health with timeout
async function checkComponent<T>(
  name: string,
  checkFn: () => Promise<T>,
  timeout: number = 3000
): Promise<ComponentHealth> {
  const start = performance.now();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeout)
    );

    await Promise.race([checkFn(), timeoutPromise]);
    const responseTime = performance.now() - start;

    return {
      status: 'up',
      responseTime: Math.round(responseTime)
    };
  } catch (error: any) {
    const responseTime = performance.now() - start;
    return {
      status: 'down',
      responseTime: Math.round(responseTime),
      error: error.message || 'Unknown error'
    };
  }
}

// Database health check
async function checkDatabase(): Promise<ComponentHealth> {
  return checkComponent('database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as alive, NOW() as server_time`;
    return result;
  });
}

// Redis health check
async function checkRedis(): Promise<ComponentHealth> {
  return checkComponent('redis', async () => {
    const start = Date.now();
    await redis.ping();
    const info = await redis.info('server');
    const responseTime = Date.now() - start;

    // Parse Redis version and uptime
    const versionMatch = info.match(/redis_version:(\S+)/);
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);

    return {
      status: 'up',
      responseTime,
      details: {
        version: versionMatch?.[1],
        uptimeSeconds: uptimeMatch?.[1] ? parseInt(uptimeMatch[1]) : undefined
      }
    };
  });
}

// Price service health check
async function checkPriceService(): Promise<ComponentHealth> {
  return checkComponent('priceService', async () => {
    const stats = priceService.getStats();
    const solPrice = priceService.getSolPrice();

    if (!solPrice || solPrice <= 0) {
      throw new Error('Invalid SOL price');
    }

    return {
      status: 'up',
      details: {
        solPrice,
        cachedPrices: stats.cachedPrices,
        subscribers: stats.priceSubscribers
      }
    };
  });
}

// Memory health check
async function checkMemory(): Promise<ComponentHealth> {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // Get total system memory (8GB on Railway)
  const totalSystemMemory = 8 * 1024 * 1024 * 1024; // 8GB in bytes
  const systemMemoryUsedPercent = (memUsage.rss / totalSystemMemory) * 100;

  // Use system memory percentage for health check, not heap percentage
  // Node.js heap can be high percentage of heap total but still using minimal system memory
  if (systemMemoryUsedPercent > 80) {
    return {
      status: 'down',
      error: `High system memory usage: ${systemMemoryUsedPercent.toFixed(2)}%`,
      details: memUsage
    };
  }

  // Consider degraded if system memory usage is above 60%
  if (systemMemoryUsedPercent > 60) {
    return {
      status: 'degraded',
      error: `Elevated system memory usage: ${systemMemoryUsedPercent.toFixed(2)}%`,
      details: memUsage
    };
  }

  return {
    status: 'up',
    details: {
      heapUsedPercent: heapUsedPercent.toFixed(2),
      systemMemoryUsedPercent: systemMemoryUsedPercent.toFixed(2),
      heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
      totalSystemMemoryGB: (totalSystemMemory / 1024 / 1024 / 1024).toFixed(2)
    }
  };
}

// Calculate requests per minute
function getRequestsPerMinute(): number {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }

  return requestTimestamps.length;
}

// Main health check function
async function performHealthCheck(detailed: boolean = false): Promise<HealthCheckResult> {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkPriceService(),
    checkMemory()
  ]);

  const [database, redisHealth, priceServiceHealth, memory] = checks;

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (checks.some(c => c.status === 'down')) {
    overallStatus = 'unhealthy';
  } else if (checks.some(c => c.status === 'degraded')) {
    overallStatus = 'degraded';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database,
      redis: redisHealth,
      priceService: priceServiceHealth,
      memory
    }
  };

  // Add detailed metrics if requested
  if (detailed) {
    result.metrics = {
      requestsPerMinute: getRequestsPerMinute(),
      avgResponseTime: requestCount > 0 ? totalResponseTime / requestCount : 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  return result;
}

export default async function healthPlugin(app: FastifyInstance) {
  // Track request metrics
  app.addHook('onRequest', async () => {
    requestTimestamps.push(Date.now());
    requestCount++;
  });

  app.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.getResponseTime();
    totalResponseTime += responseTime;
  });

  // Basic health check endpoint
  app.get('/health', async (request, reply) => {
    try {
      const result = await performHealthCheck(false);

      const statusCode = result.status === 'healthy' ? 200 :
                        result.status === 'degraded' ? 200 : 503;

      return reply.code(statusCode).send(result);
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Detailed health check endpoint (protected)
  app.get('/health/detailed', async (request, reply) => {
    // You might want to add authentication here for production
    try {
      const result = await performHealthCheck(true);

      const statusCode = result.status === 'healthy' ? 200 :
                        result.status === 'degraded' ? 200 : 503;

      return reply.code(statusCode).send(result);
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Liveness probe for Kubernetes/Docker
  app.get('/health/live', async (request, reply) => {
    return reply.code(200).send({ status: 'alive' });
  });

  // Readiness probe for Kubernetes/Docker
  app.get('/health/ready', async (request, reply) => {
    try {
      // Quick check of critical components only
      const dbCheck = await checkDatabase();
      const redisCheck = await checkRedis();

      if (dbCheck.status === 'up' && redisCheck.status === 'up') {
        return reply.code(200).send({ status: 'ready' });
      }

      return reply.code(503).send({
        status: 'not ready',
        database: dbCheck.status,
        redis: redisCheck.status
      });
    } catch (error) {
      return reply.code(503).send({ status: 'not ready' });
    }
  });

  logger.info("Health monitoring initialized at /health");
}