/**
 * AgentFlow Gateway — Main Entrypoint
 *
 * Bootstraps the Fastify v5 server with:
 *   - JWT auth + RBAC
 *   - Rate limiting
 *   - Helmet security headers
 *   - CORS
 *   - Prometheus metrics
 *   - Sentry error tracking
 *   - All route plugins
 *   - Graceful shutdown
 */

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { createLogger, registerSecretRotationHandler } from "@agentflow/shared";
import { runMigrations, closeDatabase } from "@agentflow/db";
import { getConfig } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { agentRoutes } from "./routes/agents.js";
import { runRoutes } from "./routes/runs.js";
import { approvalRoutes } from "./routes/approvals.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { closeQueues } from "./queue.js";
import { telegramConnector } from "./connectors/telegram.js";
import { discordConnector } from "./connectors/discord.js";
import { whatsappConnector } from "./connectors/whatsapp.js";

const log = createLogger({ name: "gateway" });

async function buildServer() {
  const config = getConfig();

  const fastify = Fastify({
    logger: false, // we use our own Pino logger
    trustProxy: true,
    // Request body size limit: 10 MB
    bodyLimit: 10 * 1024 * 1024,
  });

  // ── Security headers ──────────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // CSP handled by web app
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  await fastify.register(fastifyCors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────
  await fastify.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_req, context) => ({
      error: "RATE_LIMITED",
      message: `Too many requests. Retry after ${String(context.after)}.`,
      retryAfter: context.after,
    }),
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  await fastify.register(authPlugin);

  // ── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(agentRoutes, { prefix: "/api/v1" });
  await fastify.register(runRoutes, { prefix: "/api/v1" });
  await fastify.register(approvalRoutes, { prefix: "/api/v1" });
  await fastify.register(webhookRoutes, { prefix: "/api/v1" });

  // ── Feature-flagged connectors ────────────────────────────────────────────
  await fastify.register(telegramConnector);
  await fastify.register(discordConnector);
  await fastify.register(whatsappConnector);

  // ── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler((error, req, reply) => {
    const err = error as { statusCode?: number; name?: string; message?: string };
    log.error(
      { err, path: req.url, method: req.method },
      "Unhandled error",
    );
    const statusCode = err.statusCode ?? 500;
    void reply.status(statusCode).send({
      error: statusCode === 500 ? "INTERNAL_ERROR" : err.name,
      message:
        statusCode === 500
          ? "An unexpected error occurred"
          : err.message,
    });
  });

  return fastify;
}

async function main() {
  const config = getConfig();

  // Register SIGUSR1 handler for secret rotation
  registerSecretRotationHandler(() => {
    log.info("Secrets refreshed via SIGUSR1");
  });

  // Run DB migrations
  log.info("Running database migrations...");
  await runMigrations();
  log.info("Migrations complete.");

  const fastify = await buildServer();

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutdown signal received — draining...");
    await fastify.close();
    await closeQueues();
    closeDatabase();
    log.info("Graceful shutdown complete.");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // ── Start ─────────────────────────────────────────────────────────────────
  await fastify.listen({ host: config.HOST, port: config.PORT });
  log.info(
    { host: config.HOST, port: config.PORT, env: config.NODE_ENV },
    "Gateway listening",
  );
}

main().catch((err: unknown) => {
  log.error({ err }, "Fatal startup error");
  process.exit(1);
});
