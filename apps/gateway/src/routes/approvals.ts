/**
 * AgentFlow Gateway — HITL Approval Routes
 *
 * GET  /workspaces/:wId/approvals          → list pending approvals
 * GET  /workspaces/:wId/approvals/:id      → get approval details
 * POST /workspaces/:wId/approvals/:id/decide  → submit decision (approve/reject/modify)
 */

import type { FastifyPluginAsync } from "fastify";
import { ApprovalResponseSchema, createLogger, sha256Hex } from "@agentflow/shared";
import { getDatabase, approvals, toolCalls, eq, and } from "@agentflow/db";

const log = createLogger({ name: "gateway:approvals" });

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET: Pending approvals ────────────────────────────────────────────────
  fastify.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/approvals",
    async (req, reply) => {
      const db = getDatabase();
      const rows = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.workspaceId, req.params.workspaceId),
            eq(approvals.status, "pending"),
          ),
        );
      return reply.send({ items: rows, total: rows.length });
    },
  );

  // ── GET: Single approval ──────────────────────────────────────────────────
  fastify.get<{ Params: { workspaceId: string; id: string } }>(
    "/workspaces/:workspaceId/approvals/:id",
    async (req, reply) => {
      const db = getDatabase();
      const [row] = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.id, req.params.id),
            eq(approvals.workspaceId, req.params.workspaceId),
          ),
        );

      if (!row) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Approval request not found" });
      }
      return reply.send(row);
    },
  );

  // ── POST: Submit decision ─────────────────────────────────────────────────
  fastify.post<{
    Params: { workspaceId: string; id: string };
  }>(
    "/workspaces/:workspaceId/approvals/:id/decide",
    {
      preHandler: fastify.requireRole(["admin", "developer", "operator"]),
    },
    async (req, reply) => {
      const parsed = ApprovalResponseSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
      }

      const { decision, note, modifiedInput } = parsed.data;
      const { id: approvalId, workspaceId } = req.params;
      const db = getDatabase();
      const now = new Date().toISOString();

      // Verify it exists and is still pending
      const [existing] = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.id, approvalId),
            eq(approvals.workspaceId, workspaceId),
          ),
        );

      if (!existing) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Approval request not found" });
      }

      if (existing.status !== "pending") {
        return reply.status(409).send({
          error: "CONFLICT",
          message: `Approval is already in '${existing.status}' state`,
        });
      }

      // Check expiry
      if (new Date(existing.expiresAt) < new Date()) {
        return reply.status(410).send({
          error: "APPROVAL_TIMEOUT",
          message: "This approval request has expired",
        });
      }

      // Compute hash if input was modified
      const modifiedInputHash =
        modifiedInput !== undefined
          ? sha256Hex(JSON.stringify(modifiedInput))
          : undefined;

      // Update approval record
      await db
        .update(approvals)
        .set({
          status: decision,
          decision,
          reviewerId: req.user.sub,
          reviewNote: note,
          modifiedInput: modifiedInput ?? null,
          modifiedInputHash: modifiedInputHash ?? null,
          decidedAt: now,
        })
        .where(eq(approvals.id, approvalId));

      // Update tool call status
      const toolCallStatus =
        decision === "approved" || decision === "modified"
          ? "approved"
          : "rejected";

      await db
        .update(toolCalls)
        .set({
          approvalDecision: decision,
          approvedBy: req.user.sub,
          approvedAt: now,
          status: toolCallStatus,
        })
        .where(eq(toolCalls.id, existing.toolCallId));

      log.info(
        {
          approvalId,
          toolCallId: existing.toolCallId,
          decision,
          reviewerId: req.user.sub,
        },
        "Approval decision recorded",
      );

      // TODO: Publish decision to Redis pub/sub so the worker can proceed
      // channel: `approval:${existing.toolCallId}:decision`

      return reply.send({
        approvalId,
        decision,
        status: "recorded",
        decidedAt: now,
      });
    },
  );
};
