/**
 * AgentFlow Web — API Client
 *
 * ky HTTP client pre-configured with:
 *   - Base URL from NEXT_PUBLIC_API_URL
 *   - Authorization header injection from session storage
 *   - JSON error parsing
 */

import ky from "ky";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("agentflow_token");
}

export const api = ky.create({
  prefixUrl: API_BASE,
  timeout: 30_000,
  retry: { limit: 1 },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAuthToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
  parseJson: (text) => JSON.parse(text) as unknown,
});

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  return api.get(path).json<T>();
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  return api.post(path, { json: data }).json<T>();
}

export async function apiPatch<T>(path: string, data: unknown): Promise<T> {
  return api.patch(path, { json: data }).json<T>();
}

export async function apiDelete(path: string): Promise<void> {
  await api.delete(path);
}
