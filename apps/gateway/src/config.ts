/**
 * AgentFlow Gateway — Config
 *
 * Validates all required environment variables at startup via Zod.
 * Fails fast with a clear error message if anything is missing.
 */

import { z } from "zod";
import { getSecret } from "@agentflow/shared";

const RbacRoleSchema = z.enum(["admin", "developer", "operator", "readonly"]);

const GatewayEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Database
  DATABASE_URL: z.string().min(1).default("state/db.sqlite"),

  // Redis / BullMQ
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // Runner
  RUNNER_URL: z.string().url().default("http://127.0.0.1:8765"),

  // Metrics
  METRICS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3001"),
});

export type GatewayConfig = z.infer<typeof GatewayEnvSchema>;

let _config: GatewayConfig | null = null;

/**
 * Returns the validated gateway config singleton.
 * Reads JWT_SECRET from the secret provider.
 */
export function getConfig(): GatewayConfig {
  if (_config !== null) return _config;

  const raw = {
    ...process.env,
    // Override with secret provider value (env takes precedence via provider)
    JWT_SECRET: getSecret("JWT_SECRET", true),
  };

  const result = GatewayEnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Gateway config validation failed:\n${issues}`);
  }

  _config = result.data;
  return _config;
}

export { RbacRoleSchema };
