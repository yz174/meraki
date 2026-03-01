/**
 * AgentFlow Gateway — Agent CRUD Routes
 *
 * POST   /workspaces/:workspaceId/agents          → create agent
 * GET    /workspaces/:workspaceId/agents          → list agents
 * GET    /workspaces/:workspaceId/agents/:id      → get agent
 * PATCH  /workspaces/:workspaceId/agents/:id      → update agent
 * DELETE /workspaces/:workspaceId/agents/:id      → delete agent
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { generateUuidV4, createLogger } from "@agentflow/shared";
import {
  getDatabase,
  agents,
  eq,
  and,
  desc,
} from "@agentflow/db";

const log = createLogger({ name: "gateway:agents" });

const CreateAgentBodySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).default(""),
  llmProvider: z.enum(["anthropic", "openai", "ollama"]),
  llmModel: z.string().min(1).max(128),
  systemPrompt: z.string().max(8192).default(""),
  allowedTools: z.array(z.string()).default([]),
  requireApproval: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(300_000).default(120_000),
  maxToolCalls: z.number().int().min(1).max(50).default(10),
});

const UpdateAgentBodySchema = CreateAgentBodySchema.partial();

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // All agent routes require authentication
  fastify.addHook("preHandler", fastify.authenticate);

  // ── POST /workspaces/:workspaceId/agents ─────────────────────────────────
  fastify.post<{
    Params: { workspaceId: string };
    Body: z.infer<typeof CreateAgentBodySchema>;
  }>(
    "/workspaces/:workspaceId/agents",
    {
      preHandler: fastify.requireRole(["admin", "developer"]),
    },
    async (req, reply) => {
      const body = CreateAgentBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "VALIDATION_ERROR", issues: body.error.issues });
      }

      const { workspaceId } = req.params;
      const db = getDatabase();
      const id = generateUuidV4();
      const now = new Date().toISOString();

      await db.insert(agents).values({
        id,
        workspaceId,
        ...body.data,
        allowedTools: body.data.allowedTools,
        createdAt: now,
        updatedAt: now,
      });

      log.info({ agentId: id, workspaceId }, "Agent created");
      return reply.status(201).send({ id, ...body.data, workspaceId, createdAt: now, updatedAt: now });
    },
  );

  // ── GET /workspaces/:workspaceId/agents ───────────────────────────────────
  fastify.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/agents",
    async (req, reply) => {
      const db = getDatabase();
      const rows = await db
        .select()
        .from(agents)
        .where(eq(agents.workspaceId, req.params.workspaceId))
        .orderBy(desc(agents.createdAt));
      return reply.send({ items: rows, total: rows.length });
    },
  );

  // ── GET /workspaces/:workspaceId/agents/:id ───────────────────────────────
  fastify.get<{ Params: { workspaceId: string; id: string } }>(
    "/workspaces/:workspaceId/agents/:id",
    async (req, reply) => {
      const db = getDatabase();
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, req.params.id),
            eq(agents.workspaceId, req.params.workspaceId),
          ),
        );

      if (!agent) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Agent not found" });
      }
      return reply.send(agent);
    },
  );

  // ── PATCH /workspaces/:workspaceId/agents/:id ─────────────────────────────
  fastify.patch<{
    Params: { workspaceId: string; id: string };
    Body: z.infer<typeof UpdateAgentBodySchema>;
  }>(
    "/workspaces/:workspaceId/agents/:id",
    {
      preHandler: fastify.requireRole(["admin", "developer"]),
    },
    async (req, reply) => {
      const body = UpdateAgentBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "VALIDATION_ERROR", issues: body.error.issues });
      }

      const db = getDatabase();
      const now = new Date().toISOString();

      const [updated] = await db
        .update(agents)
        .set({ ...body.data, updatedAt: now })
        .where(
          and(
            eq(agents.id, req.params.id),
            eq(agents.workspaceId, req.params.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Agent not found" });
      }

      log.info({ agentId: req.params.id }, "Agent updated");
      return reply.send(updated);
    },
  );

  // ── DELETE /workspaces/:workspaceId/agents/:id ────────────────────────────
  fastify.delete<{ Params: { workspaceId: string; id: string } }>(
    "/workspaces/:workspaceId/agents/:id",
    {
      preHandler: fastify.requireRole(["admin"]),
    },
    async (req, reply) => {
      const db = getDatabase();
      const [deleted] = await db
        .delete(agents)
        .where(
          and(
            eq(agents.id, req.params.id),
            eq(agents.workspaceId, req.params.workspaceId),
          ),
        )
        .returning({ id: agents.id });

      if (!deleted) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Agent not found" });
      }

      log.info({ agentId: req.params.id }, "Agent deleted");
      return reply.status(204).send();
    },
  );
};
