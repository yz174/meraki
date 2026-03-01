/**
 * AgentFlow Web — Terminal Component
 *
 * Renders a read-only xterm.js terminal for streaming shell output.
 * Handles auto-resize via the FitAddon.
 */

"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  output: string[];
}

export function Terminal({ output }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{
    terminal: import("@xterm/xterm").Terminal;
    fitAddon: import("@xterm/addon-fit").FitAddon;
  } | null>(null);

  // Initialize xterm on mount (dynamic import for SSR safety)
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let disposed = false;

    void (async () => {
      const [{ Terminal: XTerminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);

      if (disposed || !containerRef.current) return;

      const terminal = new XTerminal({
        rows: 16,
        theme: {
          background: "#0d1117",
          foreground: "#e5e7eb",
          cursor: "#6366f1",
          selectionBackground: "#374151",
        },
        fontFamily: "monospace",
        fontSize: 12,
        cursorBlink: false,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      termRef.current = { terminal, fitAddon };
    })();

    return () => {
      disposed = true;
      if (termRef.current) {
        termRef.current.terminal.dispose();
        termRef.current = null;
      }
    };
  }, []);

  // Write new output lines when output prop changes
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.terminal.clear();
    for (const line of output) {
      termRef.current.terminal.writeln(line);
    }
    termRef.current.fitAddon.fit();
  }, [output]);

  return (
    <div
      ref={containerRef}
      style={{
        background: "#0d1117",
        borderRadius: "0.75rem",
        border: "1px solid var(--card-border)",
        padding: "0.5rem",
        height: "22rem",
        overflow: "hidden",
      }}
    />
  );
}
