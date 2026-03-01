"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/agents", label: "Agents", icon: "⬤" },
  { href: "/logs", label: "Logs", icon: "📋" },
  { href: "/memory", label: "Memory", icon: "🧠" },
  { href: "/approvals", label: "Approvals", icon: "✓" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "14rem",
        background: "var(--card)",
        borderRight: "1px solid var(--card-border)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
        gap: "0.25rem",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "var(--accent)",
          marginBottom: "1.5rem",
          paddingLeft: "0.5rem",
        }}
      >
        AgentFlow
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.625rem 0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: active ? 600 : 400,
              textDecoration: "none",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--muted)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <span style={{ fontSize: "1rem" }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
