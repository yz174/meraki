/**
 * AgentFlow CLI — Agent Commands
 *
 * Subcommands:
 *   agent list                          — list all agents
 *   agent status <id>                   — show agent status
 *   agent chat [--session <id>]         — interactive REPL chat session
 *   agent run <agentId> --task <text>   — start a run
 */

import chalk from "chalk";
import type { ArgumentsCamelCase } from "yargs";
import { getApiClient } from "../api.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  description: string;
}

interface Run {
  id: string;
  status: string;
  output?: { answer?: string };
  error?: string;
  durationMs?: number;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function listAgents(_args: ArgumentsCamelCase): Promise<void> {
  const api = getApiClient();
  try {
    const data = await api.get("api/v1/agents").json<{ items: Agent[] }>();
    if (data.items.length === 0) {
      console.log(chalk.dim("No agents found."));
      return;
    }
    for (const agent of data.items) {
      const statusColor =
        agent.status === "idle" ? chalk.dim :
        agent.status === "executing" ? chalk.blue :
        agent.status === "completed" ? chalk.green :
        agent.status === "failed" ? chalk.red :
        chalk.yellow;

      console.log(
        `${chalk.bold(agent.name.padEnd(24))}  ${statusColor(agent.status.padEnd(12))}  ${chalk.dim(agent.id.slice(0, 8))}  ${chalk.dim(agent.llmProvider + "/" + agent.llmModel)}`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("Error:"), msg);
    process.exitCode = 1;
  }
}

export async function agentStatus(args: ArgumentsCamelCase<{ id: string }>): Promise<void> {
  const api = getApiClient();
  try {
    const agent = await api.get(`api/v1/agents/${args.id}`).json<Agent>();
    console.log(chalk.bold("Name:       "), agent.name);
    console.log(chalk.bold("Status:     "), agent.status);
    console.log(chalk.bold("Provider:   "), `${agent.llmProvider}/${agent.llmModel}`);
    console.log(chalk.bold("Description:"), chalk.dim(agent.description || "(none)"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("Error:"), msg);
    process.exitCode = 1;
  }
}

export async function agentRun(
  args: ArgumentsCamelCase<{ agentId: string; task: string; workspace: string }>,
): Promise<void> {
  const api = getApiClient();
  const agentId = args.agentId;
  const task = args.task;
  const workspaceId = args.workspace;

  console.log(chalk.dim(`Enqueuing run for agent ${agentId}…`));

  try {
    const result = await api
      .post(`api/v1/workspaces/${workspaceId}/agents/${agentId}/runs`, {
        json: { task },
      })
      .json<{ runId: string; status: string }>();

    console.log(chalk.green("✓"), "Run enqueued");
    console.log(chalk.bold("Run ID:"), result.runId);
    console.log(chalk.dim("Poll with:"), `agentflow agent status-run ${result.runId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("Error:"), msg);
    process.exitCode = 1;
  }
}

export async function agentChat(
  args: ArgumentsCamelCase<{ agentId: string; workspace: string; session?: string }>,
): Promise<void> {
  const { createInterface } = await import("node:readline");
  const agentId = args.agentId;
  const workspaceId = args.workspace;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.bold("AgentFlow Chat"));
  console.log(chalk.dim(`Agent: ${agentId} | Type 'exit' to quit\n`));

  const askQuestion = (): void => {
    rl.question(chalk.blue("You > "), (task) => {
      if (task.trim().toLowerCase() === "exit") {
        console.log(chalk.dim("Goodbye."));
        rl.close();
        return;
      }

      const api = getApiClient();
      api
        .post(`api/v1/workspaces/${workspaceId}/agents/${agentId}/runs`, {
          json: { task },
        })
        .json<{ runId: string }>()
        .then((result) => {
          // Poll for completion
          return pollRun(result.runId);
        })
        .then((run: Run) => {
          if (run.output?.answer) {
            console.log(chalk.green("Agent >"), run.output.answer);
          } else if (run.error) {
            console.log(chalk.red("Error >"), run.error);
          }
          console.log();
          askQuestion();
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red("Error:"), msg);
          askQuestion();
        });
    });
  };

  askQuestion();
}

async function pollRun(runId: string): Promise<Run> {
  const api = getApiClient();
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    const run = await api.get(`api/v1/runs/${runId}`).json<Run>();
    if (run.status === "completed" || run.status === "failed") {
      return run;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Run timed out after 120s");
}
