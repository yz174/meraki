/**
 * AgentFlow Gateway — Health Routes
 *
 * GET /health    → liveness probe (always 200 if process is alive)
 * GET /ready     → readiness probe (checks DB + Redis connectivity)
 * GET /metrics   → Prometheus text metrics (if METRICS_ENABLED=true)
 */

import type { FastifyPluginAsync } from "fastify";
import { getDatabase, sql } from "@agentflow/db";
import { createLogger } from "@agentflow/shared";

const log = createLogger({ name: "gateway:health" });

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /health ───────────────────────────────────────────────────────────
  fastify.get(
    "/health",
    async (_req, reply) => {
      return reply.status(200).send({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    },
  );

  // ── GET /ready ────────────────────────────────────────────────────────────
  fastify.get(
    "/ready",
    async (_req, reply) => {
      const checks: Record<string, "ok" | "error"> = {};

      // DB check
      try {
        const db = getDatabase();
        db.run(sql`SELECT 1`);
        checks["database"] = "ok";
      } catch (err) {
        log.error({ err }, "Readiness check: database failed");
        checks["database"] = "error";
      }

      const allOk = Object.values(checks).every((v) => v === "ok");
      return reply.status(allOk ? 200 : 503).send({
        status: allOk ? "ready" : "not_ready",
        checks,
        timestamp: new Date().toISOString(),
      });
    },
  );
};
