/**
 * AgentFlow Gateway — Agent Run Routes
 *
 * POST /workspaces/:wId/agents/:agentId/runs   → enqueue a new run
 * GET  /workspaces/:wId/agents/:agentId/runs   → list runs
 * GET  /workspaces/:wId/runs/:runId            → get run status
 * GET  /workspaces/:wId/runs/:runId/stream     → SSE stream of run events
 * POST /workspaces/:wId/runs/:runId/cancel     → cancel a run
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  generateUuidV4,
  AgentRunInputSchema,
  createLogger,
} from "@agentflow/shared";
import {
  getDatabase,
  agents,
  runs,
  eq,
  and,
  desc,
} from "@agentflow/db";
import { getAgentRunsQueue, type AgentRunJobData } from "../queue.js";

const log = createLogger({ name: "gateway:runs" });

export const runRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── POST: Start a new agent run ───────────────────────────────────────────
  fastify.post<{
    Params: { workspaceId: string; agentId: string };
    Body: z.infer<typeof AgentRunInputSchema>;
  }>(
    "/workspaces/:workspaceId/agents/:agentId/runs",
    async (req, reply) => {
      const input = AgentRunInputSchema.safeParse(req.body);
      if (!input.success) {
        return reply.status(400).send({ error: "VALIDATION_ERROR", issues: input.error.issues });
      }

      const { workspaceId, agentId } = req.params;
      const db = getDatabase();

      // Verify agent exists and belongs to this workspace
      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)));

      if (!agent) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Agent not found" });
      }

      // Idempotency key deduplication
      if (input.data.idempotencyKey) {
        const [existing] = await db
          .select({ id: runs.id, status: runs.status })
          .from(runs)
          .where(eq(runs.idempotencyKey, input.data.idempotencyKey));
        if (existing) {
          log.info({ runId: existing.id }, "Idempotent run returned");
          return reply.status(200).send({ runId: existing.id, status: existing.status, idempotent: true });
        }
      }

      // Create the run record
      const runId = generateUuidV4();
      const now = new Date().toISOString();

      await db.insert(runs).values({
        id: runId,
        agentId,
        workspaceId,
        status: "queued",
        input: input.data,
        triggeredBy: "api",
        triggeredByUserId: req.user.sub,
        idempotencyKey: input.data.idempotencyKey ?? null,
        createdAt: now,
      });

      // Enqueue the BullMQ job — strip undefined optionals (exactOptionalPropertyTypes)
      const jobInput: AgentRunJobData["input"] = { task: input.data.task };
      if (input.data.context !== undefined) jobInput.context = input.data.context;
      if (input.data.idempotencyKey !== undefined) jobInput.idempotencyKey = input.data.idempotencyKey;
      if (input.data.timeoutMs !== undefined) jobInput.timeoutMs = input.data.timeoutMs;

      const queue = getAgentRunsQueue();
      await queue.add(
        "run",
        {
          runId,
          agentId,
          workspaceId,
          input: jobInput,
        },
        {
          jobId: runId,
          priority: 1,
        },
      );

      log.info({ runId, agentId, workspaceId }, "Run enqueued");
      return reply.status(202).send({ runId, status: "queued" });
    },
  );

  // ── GET: List runs for an agent ───────────────────────────────────────────
  fastify.get<{ Params: { workspaceId: string; agentId: string } }>(
    "/workspaces/:workspaceId/agents/:agentId/runs",
    async (req, reply) => {
      const db = getDatabase();
      const rows = await db
        .select()
        .from(runs)
        .where(
          and(
            eq(runs.agentId, req.params.agentId),
            eq(runs.workspaceId, req.params.workspaceId),
          ),
        )
        .orderBy(desc(runs.createdAt))
        .limit(50);
      return reply.send({ items: rows, total: rows.length });
    },
  );

  // ── GET: Run status ───────────────────────────────────────────────────────
  fastify.get<{ Params: { workspaceId: string; runId: string } }>(
    "/workspaces/:workspaceId/runs/:runId",
    async (req, reply) => {
      const db = getDatabase();
      const [run] = await db
        .select()
        .from(runs)
        .where(
          and(
            eq(runs.id, req.params.runId),
            eq(runs.workspaceId, req.params.workspaceId),
          ),
        );

      if (!run) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Run not found" });
      }
      return reply.send(run);
    },
  );

  // ── GET: SSE stream for run events ───────────────────────────────────────
  fastify.get<{ Params: { workspaceId: string; runId: string } }>(
    "/workspaces/:workspaceId/runs/:runId/stream",
    async (req, reply) => {
      const { runId } = req.params;

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const send = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // TODO: Subscribe to Redis pub/sub channel `run:${runId}:events`
      // For now, emit a connected event
      send("connected", { runId, timestamp: new Date().toISOString() });

      // Keep-alive ping every 15s
      const ping = setInterval(() => {
        reply.raw.write(": ping\n\n");
      }, 15_000);

      req.raw.on("close", () => {
        clearInterval(ping);
        log.info({ runId }, "SSE client disconnected");
      });
    },
  );

  // ── POST: Cancel a run ────────────────────────────────────────────────────
  fastify.post<{ Params: { workspaceId: string; runId: string } }>(
    "/workspaces/:workspaceId/runs/:runId/cancel",
    {
      preHandler: fastify.requireRole(["admin", "developer", "operator"]),
    },
    async (req, reply) => {
      const db = getDatabase();
      const now = new Date().toISOString();
      const [updated] = await db
        .update(runs)
        .set({ status: "cancelled", completedAt: now })
        .where(
          and(
            eq(runs.id, req.params.runId),
            eq(runs.workspaceId, req.params.workspaceId),
          ),
        )
        .returning({ id: runs.id, status: runs.status });

      if (!updated) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Run not found" });
      }

      log.info({ runId: req.params.runId }, "Run cancelled");
      return reply.send({ runId: req.params.runId, status: "cancelled" });
    },
  );
};
