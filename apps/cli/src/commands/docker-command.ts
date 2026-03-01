/**
 * AgentFlow CLI — Docker Command
 *
 * Usage:
 *   agentflow docker up       — docker compose up -d
 *   agentflow docker down     — docker compose down
 *   agentflow docker rebuild  — docker compose build --no-cache && up
 *   agentflow docker logs     — docker compose logs -f
 *   agentflow docker status   — docker compose ps
 */

import { spawnSync } from "node:child_process";
import chalk from "chalk";
import type { ArgumentsCamelCase } from "yargs";

function runCompose(args: string[]): boolean {
  console.log(chalk.dim(`$ docker compose ${args.join(" ")}`));

  const result = spawnSync("docker", ["compose", ...args], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(chalk.red("Failed to run docker:"), result.error.message);
    return false;
  }

  return result.status === 0;
}

export function dockerUp(_args: ArgumentsCamelCase): void {
  const ok = runCompose(["up", "-d", "--remove-orphans"]);
  if (ok) {
    console.log(chalk.green("\n✓ Stack is up."));
  } else {
    process.exitCode = 1;
  }
}

export function dockerDown(_args: ArgumentsCamelCase): void {
  const ok = runCompose(["down"]);
  if (ok) {
    console.log(chalk.green("\n✓ Stack stopped."));
  } else {
    process.exitCode = 1;
  }
}

export function dockerRebuild(_args: ArgumentsCamelCase): void {
  console.log(chalk.bold("Rebuilding images…\n"));
  const built = runCompose(["build", "--no-cache"]);
  if (!built) {
    process.exitCode = 1;
    return;
  }
  const up = runCompose(["up", "-d", "--remove-orphans"]);
  if (up) {
    console.log(chalk.green("\n✓ Rebuild complete."));
  } else {
    process.exitCode = 1;
  }
}

export function dockerLogs(_args: ArgumentsCamelCase): void {
  console.log(chalk.dim("Following logs… Ctrl+C to stop\n"));
  runCompose(["logs", "-f"]);
}

export function dockerStatus(_args: ArgumentsCamelCase): void {
  runCompose(["ps"]);
}
