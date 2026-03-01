/**
 * AgentFlow CLI — HTTP API Client
 *
 * Thin ky wrapper that reads gateway config from ~/.agentflow/config.json
 * (or environment variables) and returns a pre-configured client.
 */

import ky from "ky";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliConfig {
  apiUrl: string;
  token?: string;
}

function loadConfig(): CliConfig {
  const envUrl = process.env["AGENTFLOW_API_URL"];
  const envToken = process.env["AGENTFLOW_TOKEN"];

  if (envUrl) {
    return { apiUrl: envUrl, ...(envToken !== undefined ? { token: envToken } : {}) };
  }

  const configPath = join(homedir(), ".agentflow", "config.json");
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      return JSON.parse(raw) as CliConfig;
    } catch {
      // fall through to defaults
    }
  }

  return { apiUrl: "http://localhost:3001" };
}

export function getApiClient() {
  const config = loadConfig();

  return ky.create({
    prefixUrl: config.apiUrl,
    timeout: 30_000,
    retry: { limit: 1 },
    hooks: {
      beforeRequest: [
        (request) => {
          if (config.token) {
            request.headers.set("Authorization", `Bearer ${config.token}`);
          }
        },
      ],
    },
    parseJson: (text) => JSON.parse(text) as unknown,
  });
}

export function getConfig(): CliConfig {
  return loadConfig();
}
