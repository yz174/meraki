/**
 * AgentFlow Gateway — Discord Connector (Feature-Flagged Stub)
 *
 * Disabled by default. Enable by setting:
 *   CONNECTOR_ENABLED_DISCORD=true
 *
 * When enabled, registers POST /connectors/discord/interactions to receive
 * Discord Interactions API payloads and enqueue them as agent jobs.
 *
 * Requires:
 *   DISCORD_APP_ID           — Discord application ID
 *   DISCORD_PUBLIC_KEY       — Ed25519 public key for interaction verification
 *   DISCORD_BOT_TOKEN        — Bot token for API calls
 */

import type { FastifyPluginAsync } from "fastify";
import { createLogger } from "@agentflow/shared";

const log = createLogger({ name: "connector:discord" });

export const discordConnector: FastifyPluginAsync = async (fastify) => {
  const enabled = process.env["CONNECTOR_ENABLED_DISCORD"] === "true";
  if (!enabled) {
    log.info({}, "Discord connector disabled (CONNECTOR_ENABLED_DISCORD != true)");
    return;
  }

  const publicKey = process.env["DISCORD_PUBLIC_KEY"];
  if (!publicKey) {
    log.warn({}, "Discord connector enabled but DISCORD_PUBLIC_KEY missing — skipping");
    return;
  }

  // ── Interactions endpoint ─────────────────────────────────────────────────
  fastify.post("/connectors/discord/interactions", async (req, reply) => {
    // Discord requires Ed25519 signature verification on every interaction.
    // TODO (Phase 5): Implement Ed25519 verification using DISCORD_PUBLIC_KEY.
    // Until then, reject all requests.
    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];

    if (!signature || !timestamp) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    // TODO (Phase 5): Verify Ed25519(timestamp + body, publicKey, signature).
    // TODO (Phase 5): Handle PING pong (type === 1 → reply { type: 1 }).
    // TODO (Phase 5): Parse APPLICATION_COMMAND interactions, dispatch to queue.
    log.info({ body: req.body }, "Discord interaction received (stub — not yet processed)");

    return reply.status(501).send({ error: "NOT_IMPLEMENTED", message: "Discord connector in progress" });
  });

  log.info({}, "Discord connector registered");
};
