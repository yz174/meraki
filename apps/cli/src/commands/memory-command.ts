/**
 * AgentFlow CLI — Memory Command
 *
 * Usage: agentflow memory search "<query>" [--top-k 5] [--workspace <id>]
 */

import chalk from "chalk";
import Table from "cli-table3";
import type { ArgumentsCamelCase } from "yargs";
import { getApiClient } from "../api.js";

interface MemoryChunk {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export async function memorySearch(
  args: ArgumentsCamelCase<{ query: string; topK: number; workspace?: string }>,
): Promise<void> {
  const api = getApiClient();
  const { query, topK, workspace } = args;

  if (!query || query.trim() === "") {
    console.error(chalk.red("Error: query must not be empty"));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.dim(`Searching memory: "${query}" (top-${topK})…`));

  try {
    const result = await api
      .post("api/v1/memory/search", {
        json: { query, topK: topK ?? 5, workspaceId: workspace },
      })
      .json<{ results: MemoryChunk[] }>();

    if (result.results.length === 0) {
      console.log(chalk.dim("No results found."));
      return;
    }

    const table = new Table({
      head: [
        chalk.bold("Score"),
        chalk.bold("Content"),
        chalk.bold("ID"),
      ],
      colWidths: [8, 72, 12],
      wordWrap: true,
      style: { head: [], border: [] },
    });

    for (const chunk of result.results) {
      table.push([
        chalk.cyan(chunk.score.toFixed(4)),
        chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "…" : ""),
        chalk.dim(chunk.id.slice(0, 10)),
      ]);
    }

    console.log(table.toString());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red("Error:"), msg);
    process.exitCode = 1;
  }
}
