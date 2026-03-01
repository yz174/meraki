/**
 * AgentFlow Web — HITL Approvals
 *
 * Displays pending approval requests (SSE-pushed).
 * Operator can approve, reject, or modify tool call input.
 */

"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../lib/api-client";
import { SseClient } from "../../lib/sse-client";
import type { SseEvent } from "../../lib/sse-client";
import { ApprovalCard } from "../../components/approval-card";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export interface ApprovalItem {
  id: string;
  toolCallId: string;
  runId: string;
  workspaceId: string;
  toolName: string;
  input: Record<string, unknown>;
  requestedBy: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial list
  useEffect(() => {
    apiGet<{ items: ApprovalItem[] }>("api/v1/approvals?status=pending")
      .then((data) => setApprovals(data.items))
      .catch(() => { /* show empty */ })
      .finally(() => setLoading(false));
  }, []);

  // Subscribe to SSE for new approvals
  useEffect(() => {
    const client = new SseClient({
      url: `${API_BASE}/api/v1/logs/stream`,
      onEvent: (event: SseEvent) => {
        if (event.type === "approval_required") {
          const approval = event.data as ApprovalItem;
          setApprovals((prev) => [approval, ...prev]);
        }
      },
    });
    client.connect();
    return () => client.close();
  }, []);

  const handleDecide = async (
    approval: ApprovalItem,
    decision: "approved" | "rejected",
    note?: string,
  ) => {
    await apiPost(`api/v1/workspaces/${approval.workspaceId}/approvals/${approval.id}/decide`, {
      decision,
      note,
    });
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Pending Approvals
        {approvals.length > 0 && (
          <span
            style={{
              marginLeft: "0.75rem",
              fontSize: "0.9rem",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              background: "var(--warning)",
              color: "#000",
              fontWeight: 600,
            }}
          >
            {approvals.length}
          </span>
        )}
      </h1>

      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      {!loading && approvals.length === 0 && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: "0.75rem",
            padding: "2rem",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          No pending approvals. Agents are running within policy.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            onDecide={handleDecide}
          />
        ))}
      </div>
    </div>
  );
}
