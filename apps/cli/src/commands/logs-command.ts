/**
 * AgentFlow CLI — Logs Command
 *
 * Usage: agentflow logs [--level error|warn|info|debug] [--session <runId>]
 *
 * Streams log events from the gateway SSE endpoint.
 */

import chalk from "chalk";
import type { ArgumentsCamelCase } from "yargs";
import { getConfig } from "../api.js";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogLine {
  level: LogLevel;
  message: string;
  timestamp: string;
  runId?: string;
  [key: string]: unknown;
}

const LEVEL_COLOR: Record<LogLevel, (s: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  debug: chalk.dim,
};

function levelPriority(l: LogLevel): number {
  return { error: 0, warn: 1, info: 2, debug: 3 }[l];
}

export async function logsCommand(
  args: ArgumentsCamelCase<{ level?: LogLevel; session?: string; follow: boolean }>,
): Promise<void> {
  const config = getConfig();
  const baseUrl = config.apiUrl ?? "http://localhost:3001";

  const params = new URLSearchParams();
  if (args.session) params.set("runId", args.session);

  const url = `${baseUrl}/api/v1/logs/stream?${params.toString()}`;
  const minPriority = levelPriority(args.level ?? "info");

  console.log(chalk.dim(`Connecting to ${url} …`));
  console.log(chalk.dim("Press Ctrl+C to stop\n"));

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };

  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) });

    if (!response.ok || !response.body) {
      console.error(chalk.red(`Error: HTTP ${response.status}`));
      process.exitCode = 1;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      const last = lines.pop();
      buffer = last ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const log = JSON.parse(payload) as LogLine;
          const logPriority = levelPriority(log.level ?? "info");
          if (logPriority > minPriority) continue;

          const colorFn = LEVEL_COLOR[log.level] ?? chalk.white;
          const ts = new Date(log.timestamp).toISOString().slice(11, 23);
          const runTag = log.runId ? chalk.dim(` [${String(log.runId).slice(0, 8)}]`) : "";

          console.log(
            `${chalk.dim(ts)} ${colorFn(log.level.toUpperCase().padEnd(5))}${runTag} ${log.message}`,
          );
        } catch {
          // not JSON — print raw
          console.log(chalk.dim(trimmed));
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("Stream error:"), msg);
    process.exitCode = 1;
  }
}
