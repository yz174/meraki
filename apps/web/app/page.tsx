/**
 * AgentFlow Web — Dashboard
 *
 * Shows:
 *   - Active agent count
 *   - Task success rate (last 24h)
 *   - Recent audit events
 */

import { Suspense } from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        minWidth: "12rem",
      }}
    >
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.5rem" }}>{value}</p>
      {sub && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>{sub}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Dashboard</h1>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <StatCard label="Active Agents" value="—" sub="Connect to gateway" />
        <StatCard label="Tasks (24h)" value="—" sub="—" />
        <StatCard label="Success Rate" value="—" sub="—" />
        <StatCard label="Pending Approvals" value="—" sub="—" />
      </div>

      {/* Recent activity placeholder */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Recent Activity</h2>
        <Suspense fallback={<p style={{ color: "var(--muted)" }}>Loading…</p>}>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Start the gateway server to see live activity.
          </p>
        </Suspense>
      </div>
    </div>
  );
}
