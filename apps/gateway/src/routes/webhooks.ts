/**
 * AgentFlow Gateway — Webhook Ingestion Routes
 *
 * POST /webhooks/:connectorId   → ingest a webhook, verify HMAC, enqueue job
 */

import type { FastifyPluginAsync } from "fastify";
import { generateUuidV4, verifyWebhook, sha256Hex, createLogger } from "@agentflow/shared";
import {
  getDatabase,
  connectors,
  webhookDeliveries,
  eq,
} from "@agentflow/db";
import { getWebhookQueue } from "../queue.js";

const log = createLogger({ name: "gateway:webhooks" });

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { connectorId: string } }>(
    "/webhooks/:connectorId",
    async (req, reply) => {
      const { connectorId } = req.params;
      const db = getDatabase();

      // Look up the connector
      const [connector] = await db
        .select()
        .from(connectors)
        .where(eq(connectors.id, connectorId));

      if (!connector) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Connector not found" });
      }

      if (!connector.enabled || connector.status !== "active") {
        log.warn({ connectorId }, "Webhook received for inactive or disabled connector");
        return reply.status(200).send({ ok: true }); // silent discard
      }

      // Get the raw body for HMAC verification
      // @ts-expect-error — rawBody is added by content-type-parser
      const rawBody: Buffer = req.rawBody as Buffer ?? Buffer.from(JSON.stringify(req.body), "utf8");

      // Verify HMAC signature
      if (connector.secretRef) {
        const { getSecret } = await import("@agentflow/shared");
        const secret = getSecret(connector.secretRef);

        if (secret) {
          const provider =
            connector.type === "github"
              ? "github"
              : connector.type === "slack"
                ? "slack"
                : "generic";

          const verification = verifyWebhook({
            provider,
            rawBody,
            headers: req.headers as Record<string, string>,
            secret,
          });

          if (!verification.valid) {
            log.warn(
              { connectorId, reason: verification.reason },
              "Webhook HMAC verification failed",
            );
            return reply.status(401).send({ error: "UNAUTHORIZED", message: "Webhook signature invalid" });
          }
        }
      }

      // Deduplication via payload hash
      const payloadHash = sha256Hex(rawBody);
      const [duplicate] = await db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.payloadHash, payloadHash));

      if (duplicate) {
        log.info({ connectorId, payloadHash }, "Duplicate webhook delivery ignored");
        return reply.status(200).send({ ok: true, duplicate: true });
      }

      // Record the delivery
      const deliveryId = generateUuidV4();
      const eventType =
        (req.headers["x-github-event"] as string) ??
        (req.headers["x-slack-event"] as string) ??
        "webhook";

      await db.insert(webhookDeliveries).values({
        id: deliveryId,
        connectorId,
        workspaceId: connector.workspaceId,
        eventType,
        payloadHash,
        payload: req.body as Record<string, unknown>,
        status: "received",
      });

      // Enqueue for processing
      const queue = getWebhookQueue();
      await queue.add("process", {
        deliveryId,
        connectorId,
        workspaceId: connector.workspaceId,
        eventType,
        payload: req.body as Record<string, unknown>,
      });

      log.info({ deliveryId, connectorId, eventType }, "Webhook enqueued");
      return reply.status(202).send({ ok: true, deliveryId });
    },
  );
};
