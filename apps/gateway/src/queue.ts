/**
 * AgentFlow Gateway — BullMQ Queue Client
 *
 * Exports typed queue instances for all AgentFlow job types.
 * Workers are defined in packages/orchestration — the gateway only enqueues.
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { createLogger } from "@agentflow/shared";
import { getConfig } from "./config.js";

const log = createLogger({ name: "gateway:queue" });

// ── Job payload types ────────────────────────────────────────────────────────

export interface AgentRunJobData {
  runId: string;
  agentId: string;
  workspaceId: string;
  input: {
    task: string;
    context?: Record<string, unknown>;
    idempotencyKey?: string;
    timeoutMs?: number;
  };
}

export interface WebhookProcessJobData {
  deliveryId: string;
  connectorId: string;
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

// ── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  AGENT_RUNS: "agent-runs",
  WEBHOOK_PROCESSING: "webhook-processing",
  APPROVAL_TIMEOUT: "approval-timeout",
} as const;

// ── Shared Redis connection ──────────────────────────────────────────────────

let _connection: ConnectionOptions | null = null;

function getConnection(): ConnectionOptions {
  if (_connection !== null) return _connection;
  const { REDIS_URL } = getConfig();
  const url = new URL(REDIS_URL);
  _connection = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
  };
  return _connection;
}

// ── Queue instances ──────────────────────────────────────────────────────────

let _agentRunsQueue: Queue<AgentRunJobData> | null = null;
let _webhookQueue: Queue<WebhookProcessJobData> | null = null;

export function getAgentRunsQueue(): Queue<AgentRunJobData> {
  if (_agentRunsQueue !== null) return _agentRunsQueue;
  _agentRunsQueue = new Queue<AgentRunJobData>(QUEUE_NAMES.AGENT_RUNS, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 500 },
    },
  });
  log.info({ queue: QUEUE_NAMES.AGENT_RUNS }, "Queue initialized");
  return _agentRunsQueue;
}

export function getWebhookQueue(): Queue<WebhookProcessJobData> {
  if (_webhookQueue !== null) return _webhookQueue;
  _webhookQueue = new Queue<WebhookProcessJobData>(
    QUEUE_NAMES.WEBHOOK_PROCESSING,
    {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    },
  );
  log.info({ queue: QUEUE_NAMES.WEBHOOK_PROCESSING }, "Queue initialized");
  return _webhookQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    _agentRunsQueue?.close(),
    _webhookQueue?.close(),
  ]);
  _agentRunsQueue = null;
  _webhookQueue = null;
  log.info("All queues closed");
}
