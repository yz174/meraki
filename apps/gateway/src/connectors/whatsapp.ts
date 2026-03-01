/**
 * AgentFlow Gateway — WhatsApp Connector (Feature-Flagged Stub)
 *
 * Disabled by default. Enable by setting:
 *   CONNECTOR_ENABLED_WHATSAPP=true
 *
 * When enabled, registers:
 *   GET  /connectors/whatsapp/webhook  → Meta webhook verification challenge
 *   POST /connectors/whatsapp/webhook  → receive WhatsApp Cloud API messages
 *
 * Requires:
 *   WHATSAPP_VERIFY_TOKEN   — webhook verification token (set in Meta dashboard)
 *   WHATSAPP_APP_SECRET     — app secret for payload HMAC verification
 *   WHATSAPP_ACCESS_TOKEN   — permanent system user access token
 *   WHATSAPP_PHONE_ID       — WhatsApp business phone number ID
 */

import type { FastifyPluginAsync } from "fastify";
import { createLogger } from "@agentflow/shared";

const log = createLogger({ name: "connector:whatsapp" });

export const whatsappConnector: FastifyPluginAsync = async (fastify) => {
  const enabled = process.env["CONNECTOR_ENABLED_WHATSAPP"] === "true";
  if (!enabled) {
    log.info({}, "WhatsApp connector disabled (CONNECTOR_ENABLED_WHATSAPP != true)");
    return;
  }

  const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"];
  if (!verifyToken) {
    log.warn({}, "WhatsApp connector enabled but WHATSAPP_VERIFY_TOKEN missing — skipping");
    return;
  }

  // ── Meta webhook verification (GET) ──────────────────────────────────────
  fastify.get<{
    Querystring: {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };
  }>(
    "/connectors/whatsapp/webhook",
    async (req, reply) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === verifyToken) {
        log.info({}, "WhatsApp webhook verified");
        return reply.send(challenge ?? "");
      }

      return reply.status(403).send({ error: "FORBIDDEN" });
    },
  );

  // ── Incoming message webhook (POST) ──────────────────────────────────────
  fastify.post("/connectors/whatsapp/webhook", async (req, reply) => {
    // TODO (Phase 5): Verify X-Hub-Signature-256 HMAC against WHATSAPP_APP_SECRET.
    // TODO (Phase 5): Parse Cloud API notification, extract message text,
    //                 normalise into AgentInputMessage, enqueue to agent-runs.
    log.info({ body: req.body }, "WhatsApp message received (stub — not yet processed)");

    // Meta expects a 200 OK quickly or it retries.
    return reply.send({ ok: true });
  });

  log.info({}, "WhatsApp connector registered");
};
