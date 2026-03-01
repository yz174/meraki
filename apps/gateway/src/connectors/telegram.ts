/**
 * AgentFlow Gateway — Telegram Connector (Feature-Flagged Stub)
 *
 * Disabled by default. Enable by setting:
 *   CONNECTOR_ENABLED_TELEGRAM=true
 *
 * When enabled, registers POST /connectors/telegram/webhook to receive
 * Telegram Bot API updates and enqueue them as agent jobs.
 *
 * Requires:
 *   TELEGRAM_BOT_TOKEN — your bot token from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET — secret token for webhook verification
 */

import type { FastifyPluginAsync } from "fastify";
import { createLogger } from "@agentflow/shared";

const log = createLogger({ name: "connector:telegram" });

export const telegramConnector: FastifyPluginAsync = async (fastify) => {
  const enabled = process.env["CONNECTOR_ENABLED_TELEGRAM"] === "true";
  if (!enabled) {
    log.info({}, "Telegram connector disabled (CONNECTOR_ENABLED_TELEGRAM != true)");
    return;
  }

  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];

  if (!botToken || !webhookSecret) {
    log.warn(
      {},
      "Telegram connector enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET missing — skipping",
    );
    return;
  }

  // ── Webhook endpoint ───────────────────────────────────────────────────────
  fastify.post("/connectors/telegram/webhook", async (req, reply) => {
    // Verify the secret token Telegram sends in X-Telegram-Bot-Api-Secret-Token
    const token = req.headers["x-telegram-bot-api-secret-token"];
    if (token !== webhookSecret) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    // TODO (Phase 5): Parse Telegram Update, extract message/command,
    // normalise into AgentInputMessage, enqueue to agent-runs queue.
    log.info({ update: req.body }, "Telegram update received (stub — not yet processed)");

    return reply.send({ ok: true });
  });

  log.info({}, "Telegram connector registered");
};
