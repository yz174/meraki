/**
 * AgentFlow Web — Memory Explorer
 *
 * Search Qdrant memories by semantic query.
 * Displays top-K chunks with source citations.
 */

"use client";

import { useState } from "react";
import { apiPost } from "../../lib/api-client";

interface MemoryChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    sourceType: string;
    agentId: string;
    workspaceId: string;
    filePath?: string;
    symbolName?: string;
    createdAt: string;
  };
}

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await apiPost<{ results: MemoryChunk[] }>(
        "api/v1/memory/search",
        { query, topK: 10 },
      );
      setResults(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Memory Explorer</h1>

      {/* Search bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
          placeholder="Search agent memories…"
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            color: "var(--foreground)",
            borderRadius: "0.5rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
          }}
        />
        <button
          onClick={() => void handleSearch()}
          disabled={searching}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: searching ? "not-allowed" : "pointer",
            opacity: searching ? 0.7 : 1,
          }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>Error: {error}</p>}

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {results.length === 0 && !searching && !error && (
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Enter a query to search agent memories.
          </p>
        )}
        {results.map((chunk) => (
          <div
            key={chunk.id}
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            {/* Source badge */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "9999px",
                  background: "var(--accent)",
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {chunk.metadata.sourceType}
              </span>
              {chunk.metadata.filePath && (
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                  {chunk.metadata.filePath}
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--success)" }}>
                {(chunk.score * 100).toFixed(1)}% match
              </span>
            </div>

            {/* Content */}
            <pre
              style={{
                fontSize: "0.8rem",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--foreground)",
                fontFamily: "monospace",
                margin: 0,
              }}
            >
              {chunk.content.slice(0, 500)}
              {chunk.content.length > 500 && "…"}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
