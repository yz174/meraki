/**
 * AgentFlow Web — Settings
 *
 * Configure egress allowlist and gateway connection.
 */

"use client";

import { useState } from "react";
import { apiPatch } from "../../lib/api-client";

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(
    typeof window !== "undefined"
      ? (sessionStorage.getItem("agentflow_api") ?? "http://localhost:3001")
      : "http://localhost:3001",
  );
  const [saved, setSaved] = useState(false);

  const saveApiUrl = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("agentflow_api", apiUrl);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Settings</h1>

      {/* Gateway connection */}
      <Section title="Gateway Connection">
        <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", color: "var(--muted)" }}>
          API Base URL
        </label>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.currentTarget.value)}
            style={{
              flex: 1,
              background: "#0d1117",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
              borderRadius: "0.5rem",
              padding: "0.625rem 0.875rem",
              fontSize: "0.875rem",
            }}
          />
          <button
            onClick={saveApiUrl}
            style={{
              background: saved ? "var(--success)" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </Section>

      {/* Egress allowlist (informational) */}
      <Section title="Egress Allowlist">
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: "1.6" }}>
          Manage the allowlist of external domains that agent sandboxes are permitted
          to contact. Changes require admin approval and are logged to the audit trail.
          Use the gateway API: <code>PATCH /api/v1/settings/egress-allowlist</code>
        </p>
      </Section>

      {/* Security info */}
      <Section title="Security">
        <ul style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: "1.8", paddingLeft: "1.25rem" }}>
          <li>JWT auth required for all API calls</li>
          <li>Sandbox isolation via Docker + seccomp profiles</li>
          <li>Audit log captures all tool calls and HITL decisions</li>
          <li>RUNNER_INTERNAL_SECRET rotation: weekly</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>{title}</h2>
      {children}
    </div>
  );
}
