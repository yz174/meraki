#!/usr/bin/env node
/**
 * AgentFlow CLI — Entry Point
 *
 * Provides a unified command-line interface for interacting with an
 * AgentFlow gateway and the local Docker-compose stack.
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  agentChat,
  agentRun,
  agentStatus,
  listAgents,
} from "./commands/agent-commands.js";
import { logsCommand } from "./commands/logs-command.js";
import { memorySearch } from "./commands/memory-command.js";
import {
  configGet,
  configList,
  configReset,
  configSet,
} from "./commands/config-command.js";
import {
  dockerDown,
  dockerLogs,
  dockerRebuild,
  dockerStatus,
  dockerUp,
} from "./commands/docker-command.js";

export const CLI_VERSION = "0.1.0";

void yargs(hideBin(process.argv))
  .scriptName("agentflow")
  .version(CLI_VERSION)
  .strict()

  // ── agent ──────────────────────────────────────────────────────────────────
  .command(
    "agent <subcommand>",
    "Manage agents",
    (yargs) =>
      yargs
        .command(
          "list",
          "List all agents",
          () => {},
          (argv) => void listAgents(argv),
        )
        .command(
          "status <id>",
          "Show agent status",
          (y) => y.positional("id", { type: "string", demandOption: true }),
          (argv) => void agentStatus(argv as Parameters<typeof agentStatus>[0]),
        )
        .command(
          "run <agentId>",
          "Start a run for an agent",
          (y) =>
            y
              .positional("agentId", { type: "string", demandOption: true })
              .option("task", { type: "string", demandOption: true, describe: "Task description" })
              .option("workspace", { alias: "w", type: "string", default: "default" }),
          (argv) => void agentRun(argv as unknown as Parameters<typeof agentRun>[0]),
        )
        .command(
          "chat <agentId>",
          "Open an interactive chat session",
          (y) =>
            y
              .positional("agentId", { type: "string", demandOption: true })
              .option("workspace", { alias: "w", type: "string", default: "default" })
              .option("session", { type: "string", describe: "Existing session/run ID to resume" }),
          (argv) => void agentChat(argv as unknown as Parameters<typeof agentChat>[0]),
        )
        .demandCommand(1, "Specify a subcommand: list | status | run | chat"),
    () => {},
  )

  // ── logs ───────────────────────────────────────────────────────────────────
  .command(
    "logs",
    "Stream logs from the gateway",
    (y) =>
      y
        .option("level", {
          choices: ["error", "warn", "info", "debug"] as const,
          default: "info" as const,
          describe: "Minimum log level to display",
        })
        .option("session", { type: "string", alias: "s", describe: "Filter by run ID" })
        .option("follow", { type: "boolean", alias: "f", default: true }),
    (argv) => void logsCommand(argv as unknown as Parameters<typeof logsCommand>[0]),
  )

  // ── memory ─────────────────────────────────────────────────────────────────
  .command(
    "memory <subcommand>",
    "Interact with vector memory",
    (yargs) =>
      yargs
        .command(
          "search <query>",
          "Semantic search over stored memory",
          (y) =>
            y
              .positional("query", { type: "string", demandOption: true })
              .option("top-k", { type: "number", default: 5, alias: "k" })
              .option("workspace", { type: "string", alias: "w" }),
          (argv) => void memorySearch(argv as Parameters<typeof memorySearch>[0]),
        )
        .demandCommand(1, "Specify a subcommand: search"),
    () => {},
  )

  // ── config ─────────────────────────────────────────────────────────────────
  .command(
    "config <subcommand>",
    "Manage CLI configuration",
    (yargs) =>
      yargs
        .command(
          "get <key>",
          "Get a config value",
          (y) => y.positional("key", { type: "string", demandOption: true }),
          (argv) => configGet(argv as Parameters<typeof configGet>[0]),
        )
        .command(
          "set <key> <value>",
          "Set a config value",
          (y) =>
            y
              .positional("key", { type: "string", demandOption: true })
              .positional("value", { type: "string", demandOption: true }),
          (argv) => configSet(argv as Parameters<typeof configSet>[0]),
        )
        .command(
          "list",
          "List all config values",
          () => {},
          (argv) => configList(argv),
        )
        .command(
          "reset",
          "Reset config to empty",
          () => {},
          (argv) => configReset(argv),
        )
        .demandCommand(1, "Specify a subcommand: get | set | list | reset"),
    () => {},
  )

  // ── docker ─────────────────────────────────────────────────────────────────
  .command(
    "docker <subcommand>",
    "Control the local Docker Compose stack",
    (yargs) =>
      yargs
        .command("up", "Start the stack", () => {}, dockerUp)
        .command("down", "Stop the stack", () => {}, dockerDown)
        .command("rebuild", "Rebuild images and restart", () => {}, dockerRebuild)
        .command("logs", "Follow compose logs", () => {}, dockerLogs)
        .command("status", "Show container status", () => {}, dockerStatus)
        .demandCommand(1, "Specify a subcommand: up | down | rebuild | logs | status"),
    () => {},
  )

  .demandCommand(1, "Run agentflow --help for usage")
  .help()
  .parse();
