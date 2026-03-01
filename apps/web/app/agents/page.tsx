/**
 * AgentFlow Web — Agents List
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../lib/api-client";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  idle: "var(--muted)",
  planning: "var(--warning)",
  executing: "var(--accent)",
  completed: "var(--success)",
  failed: "var(--danger)",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ items: Agent[] }>("api/v1/agents")
      .then((data) => setAgents(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load agents"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Agents</h1>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--danger)" }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(20rem, 1fr))" }}>
          {agents.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No agents created yet.</p>
          )}
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "0.75rem",
                  padding: "1.25rem",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{agent.name}</span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                      background: STATUS_COLOR[agent.status] ?? "var(--muted)",
                      color: "#fff",
                    }}
                  >
                    {agent.status}
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                  {agent.description || "No description"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {agent.llmProvider} / {agent.llmModel}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
