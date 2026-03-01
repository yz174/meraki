/**
 * AgentFlow CLI — Config Command
 *
 * Usage:
 *   agentflow config get <key>
 *   agentflow config set <key> <value>
 *   agentflow config list
 *   agentflow config reset
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import type { ArgumentsCamelCase } from "yargs";

// ── Config file path ──────────────────────────────────────────────────────────

export const CONFIG_DIR = join(homedir(), ".agentflow");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export type AgentFlowConfig = {
  gatewayUrl?: string;
  token?: string;
  defaultWorkspace?: string;
  logLevel?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readConfig(): AgentFlowConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as AgentFlowConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: AgentFlowConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

const KNOWN_KEYS: ReadonlyArray<keyof AgentFlowConfig> = [
  "gatewayUrl",
  "token",
  "defaultWorkspace",
  "logLevel",
];

// ── Handlers ──────────────────────────────────────────────────────────────────

export function configGet(args: ArgumentsCamelCase<{ key: string }>): void {
  const config = readConfig();
  const key = args.key as keyof AgentFlowConfig;

  if (!KNOWN_KEYS.includes(key)) {
    console.error(chalk.red(`Unknown key: ${key}`));
    console.error(chalk.dim("Known keys:"), KNOWN_KEYS.join(", "));
    process.exitCode = 1;
    return;
  }

  const value = config[key];
  if (value === undefined) {
    console.log(chalk.dim(`${key} is not set`));
  } else {
    console.log(value);
  }
}

export function configSet(args: ArgumentsCamelCase<{ key: string; value: string }>): void {
  const key = args.key as keyof AgentFlowConfig;

  if (!KNOWN_KEYS.includes(key)) {
    console.error(chalk.red(`Unknown key: ${key}`));
    console.error(chalk.dim("Known keys:"), KNOWN_KEYS.join(", "));
    process.exitCode = 1;
    return;
  }

  const config = readConfig();
  (config as Record<string, string>)[key] = args.value;
  writeConfig(config);
  console.log(chalk.green("✓"), `Set ${chalk.bold(key)} = ${chalk.dim(args.value)}`);
}

export function configList(_args: ArgumentsCamelCase): void {
  const config = readConfig();
  if (Object.keys(config).length === 0) {
    console.log(chalk.dim(`No config found at ${CONFIG_PATH}`));
    return;
  }
  console.log(chalk.dim(`Config: ${CONFIG_PATH}\n`));
  for (const key of KNOWN_KEYS) {
    const value = config[key];
    if (value !== undefined) {
      const displayValue = key === "token" ? chalk.dim("****" + String(value).slice(-4)) : chalk.cyan(String(value));
      console.log(`  ${chalk.bold(key.padEnd(20))} ${displayValue}`);
    }
  }
}

export function configReset(_args: ArgumentsCamelCase): void {
  if (existsSync(CONFIG_PATH)) {
    writeConfig({});
    console.log(chalk.green("✓"), "Config reset.");
  } else {
    console.log(chalk.dim("Nothing to reset."));
  }
}
