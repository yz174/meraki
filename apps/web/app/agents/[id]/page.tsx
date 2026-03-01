/**
 * AgentFlow Web — Agent Detail
 *
 * Shows metrics, recent runs, and agent configuration.
 */

"use client";

import { useEffect, useState, use } from "react";
import { apiGet } from "../../../lib/api-client";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  systemPrompt: string;
  allowedTools: string[];
  requireApproval: boolean;
  timeoutMs: number;
  maxToolCalls: number;
  createdAt: string;
}

interface Run {
  id: string;
  status: string;
  triggeredBy: string;
  createdAt: string;
  durationMs: number | null;
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Agent>(`api/v1/agents/${id}`),
      apiGet<{ items: Run[] }>(`api/v1/agents/${id}/runs?limit=10`),
    ])
      .then(([agentData, runsData]) => {
        setAgent(agentData);
        setRuns(runsData.items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Loading…</div>;
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}>Error: {error}</div>;
  if (!agent) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Agent not found</div>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>{agent.name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>{agent.description}</p>

      {/* Config grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Detail label="Provider" value={`${agent.llmProvider} / ${agent.llmModel}`} />
        <Detail label="Status" value={agent.status} />
        <Detail label="Timeout" value={`${agent.timeoutMs}ms`} />
        <Detail label="Max Tool Calls" value={String(agent.maxToolCalls)} />
        <Detail label="Requires Approval" value={agent.requireApproval ? "Yes" : "No"} />
        <Detail label="Allowed Tools" value={agent.allowedTools.join(", ") || "none"} />
      </div>

      {/* Recent runs */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Recent Runs</h2>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {runs.length === 0 && (
          <p style={{ padding: "1rem", color: "var(--muted)", fontSize: "0.875rem" }}>No runs yet.</p>
        )}
        {runs.map((run, i) => (
          <div
            key={run.id}
            style={{
              padding: "0.75rem 1rem",
              borderTop: i > 0 ? "1px solid var(--card-border)" : undefined,
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{run.id.slice(0, 8)}…</span>
            <span>{run.status}</span>
            <span style={{ color: "var(--muted)" }}>
              {run.durationMs !== null ? `${run.durationMs}ms` : "—"}
            </span>
            <span style={{ color: "var(--muted)" }}>{new Date(run.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
      }}
    >
      <p style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ fontSize: "0.875rem", fontWeight: 500, marginTop: "0.25rem" }}>{value}</p>
    </div>
  );
}
