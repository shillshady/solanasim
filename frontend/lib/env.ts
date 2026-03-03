import { z } from "zod";

/**
 * Environment Variable Schema
 * Validates all required environment variables at runtime
 * Prevents undefined env vars from causing runtime errors
 * 
 * CRITICAL: NEXT_PUBLIC_WS_URL must be wss:// and point directly
 * to your WebSocket endpoint, NOT through Vercel edge proxy
 */
const Env = z.object({
  // Required WebSocket URL - MUST be direct connection, not proxied
  NEXT_PUBLIC_WS_URL: z
    .string()
    .url()
    .refine(url => url.startsWith('wss://'), {
      message: "WebSocket URL must use wss:// for security"
    })
    .refine(url => !url.includes('vercel.app') || url.includes('ws.'), {
      message: "Avoid routing WebSocket through Vercel edge proxy - use direct ws.domain.com"
    })
    .describe("Direct WebSocket URL (e.g., wss://ws.solanasim.com/prices)"),
  
  // Required API URL for backend communication
  NEXT_PUBLIC_API_URL: z.string().url().describe("Backend API URL"),
  
  // Solana network configuration
  NEXT_PUBLIC_CHAIN: z.enum(["mainnet", "devnet", "testnet"]).default("mainnet").describe("Solana network"),
  
  // Optional public variables
  NEXT_PUBLIC_SOLANA_NETWORK: z
    .enum(["mainnet-beta", "devnet", "testnet"])
    .default("devnet")
    .describe("Solana network to connect to"),
  
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .string()
    .transform((val) => val === "true")
    .default("false")
    .describe("Enable Vercel Analytics"),

  // Node environment (server-side only, not prefixed with NEXT_PUBLIC_)
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validated environment variables with fast-fail validation
 * Throws meaningful errors at startup if URLs/keys are wrong
 */
const parseEnv = () => {
  try {
    return Env.parse({
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_CHAIN: process.env.NEXT_PUBLIC_CHAIN,
      NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
      NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error("❌ Environment validation failed - wrong URLs/keys will fail fast:", error);
    throw new Error(
      `Environment validation failed. Please check your .env.local file.\n${
        error instanceof z.ZodError
          ? error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n")
          : error
      }`
    );
  }
};

export const env = parseEnv();

/**
 * Type-safe environment variable access
 * Use this instead of process.env.* throughout the app
 */
export type Env = z.infer<typeof Env>;

