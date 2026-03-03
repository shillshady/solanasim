// Environment variable validation and configuration
import { z } from 'zod';
import logger from '../utils/logger.js';

// Define the schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000').transform(Number),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (optional - app degrades gracefully without it)
  REDIS_URL: z.string().optional(),

  // Security - NO FALLBACKS IN PRODUCTION
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // Solana RPC
  SOLANA_RPC: z.string().optional(),
  HELIUS_RPC_URL: z.string().optional(),
  HELIUS_RPC: z.string().optional(),
  HELIUS_WS: z.string().optional(),
  HELIUS_API: z.string().optional(),
  RPC_ENDPOINT: z.string().optional(),

  // Purchase Configuration
  RECIPIENT_WALLET: z.string().default('8i6HFhHLfBX9Wwd2BTkd7yeXZGcdwtAgg4vRRB4xf1iL'),

  // External APIs
  DEXSCREENER_BASE: z.string().default('https://api.dexscreener.com'),
  JUPITER_BASE: z.string().default('https://quote-api.jup.ag'),
  BIRDEYE_API_KEY: z.string().optional(),

  // Token Configuration
  VSOL_TOKEN_MINT: z.string().optional(),

  // Rewards System
  REWARDS_WALLET_SECRET: z.string().optional(),

  // Frontend URL for CORS
  FRONTEND_URL: z.string().optional(),

  // Monitoring (optional but recommended)
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function validateEnvironment(): EnvConfig {
  try {
    // Parse and validate environment variables
    const parsed = envSchema.parse(process.env);

    // Additional production-specific validations
    if (parsed.NODE_ENV === 'production') {
      // Ensure critical services are configured
      if (!parsed.HELIUS_API && !parsed.SOLANA_RPC) {
        throw new Error('Production requires either HELIUS_API or SOLANA_RPC to be configured');
      }

      // Ensure JWT secret is strong
      if (parsed.JWT_SECRET.length < 64) {
        logger.warn('JWT_SECRET should be at least 64 characters in production');
      }

      // Check for monitoring
      if (!parsed.SENTRY_DSN) {
        logger.warn('SENTRY_DSN not configured - error tracking disabled');
      }

      // Validate rewards wallet if VSOL token is configured
      if (parsed.VSOL_TOKEN_MINT && !parsed.REWARDS_WALLET_SECRET) {
        throw new Error('REWARDS_WALLET_SECRET is required when VSOL_TOKEN_MINT is configured');
      }
    }

    config = parsed;

    // Log configuration (without sensitive data)
    logger.info('Environment validation successful');
    logger.info({
      NODE_ENV: parsed.NODE_ENV,
      PORT: parsed.PORT,
      LOG_LEVEL: parsed.LOG_LEVEL,
      DATABASE_URL: '***configured***',
      REDIS_URL: parsed.REDIS_URL ? '***configured***' : 'not configured',
      JWT_SECRET: '***configured***',
      HELIUS_API: parsed.HELIUS_API ? '***configured***' : 'not configured',
      SENTRY_DSN: parsed.SENTRY_DSN ? '***configured***' : 'not configured',
    }, 'Configuration');

    return parsed;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed');
      error.issues.forEach((err: any) => {
        logger.error({ path: err.path.join('.'), message: err.message }, 'Validation error');
      });

      // In development, provide helpful setup instructions
      if (process.env.NODE_ENV !== 'production') {
        logger.error('Setup instructions: 1) Copy backend/.env.example to backend/.env 2) Fill in the required values 3) Restart the application');
      }
    } else {
      logger.error({ err: error }, 'Environment validation error');
    }

    // Exit with error code
    process.exit(1);
  }
}

export function getConfig(): EnvConfig {
  if (!config) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return config;
}

// Helper to check if we're in production
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

// Helper to get safe config for logging (no secrets)
export function getSafeConfig(): Record<string, any> {
  const cfg = getConfig();
  return {
    NODE_ENV: cfg.NODE_ENV,
    PORT: cfg.PORT,
    LOG_LEVEL: cfg.LOG_LEVEL,
    hasSentry: !!cfg.SENTRY_DSN,
    hasHelius: !!cfg.HELIUS_API,
    hasBirdeye: !!cfg.BIRDEYE_API_KEY,
  };
}