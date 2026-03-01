/**
 * AgentFlow Web — Approval Card Component
 *
 * Displays a HITL approval request with:
 *   - Tool name + risk-level badge
 *   - Tool call parameters
 *   - Justification input
 *   - Approve / Reject actions
 */

"use client";

import { useState } from "react";
import type { ApprovalItem } from "../app/approvals/page";

interface ApprovalCardProps {
  approval: ApprovalItem;
  onDecide: (
    approval: ApprovalItem,
    decision: "approved" | "rejected",
    note?: string,
  ) => Promise<void>;
}

const HIGH_RISK_TOOLS = ["run_shell_request", "execute_python_script"];

export function ApprovalCard({ approval, onDecide }: ApprovalCardProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isHighRisk = HIGH_RISK_TOOLS.includes(approval.toolName);
  const expiresIn = Math.max(
    0,
    Math.round((new Date(approval.expiresAt).getTime() - Date.now()) / 60_000),
  );

  const decide = async (decision: "approved" | "rejected") => {
    setSubmitting(true);
    try {
      await onDecide(approval, decision, note || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: `1px solid ${isHighRisk ? "var(--danger)" : "var(--card-border)"}`,
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span
          style={{
            fontSize: "0.7rem",
            padding: "0.25rem 0.5rem",
            borderRadius: "9999px",
            background: isHighRisk ? "var(--danger)" : "var(--warning)",
            color: "#fff",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {isHighRisk ? "HIGH RISK" : "REVIEW"}
        </span>
        <span style={{ fontSize: "1rem", fontWeight: 600, fontFamily: "monospace" }}>
          {approval.toolName}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: expiresIn < 5 ? "var(--danger)" : "var(--muted)" }}>
          Expires in {expiresIn}m
        </span>
      </div>

      {/* Tool parameters */}
      <pre
        style={{
          background: "#0d1117",
          borderRadius: "0.5rem",
          padding: "0.875rem",
          fontSize: "0.78rem",
          fontFamily: "monospace",
          overflow: "auto",
          maxHeight: "12rem",
          marginBottom: "1rem",
          lineHeight: "1.5",
        }}
      >
        {JSON.stringify(approval.input, null, 2)}
      </pre>

      {/* Metadata */}
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem" }}>
        <span>Agent: <strong>{approval.requestedBy}</strong></span>
        <span>Run: <code>{approval.runId.slice(0, 8)}…</code></span>
      </div>

      {/* Note input */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        placeholder="Justification / note (optional)"
        rows={2}
        style={{
          width: "100%",
          background: "#0d1117",
          border: "1px solid var(--card-border)",
          color: "var(--foreground)",
          borderRadius: "0.5rem",
          padding: "0.625rem 0.875rem",
          fontSize: "0.8rem",
          resize: "vertical",
          marginBottom: "1rem",
          boxSizing: "border-box",
        }}
      />

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={() => void decide("approved")}
          disabled={submitting}
          style={{
            background: "var(--success)",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          Approve
        </button>
        <button
          onClick={() => void decide("rejected")}
          disabled={submitting}
          style={{
            background: "transparent",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "0.5rem",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
