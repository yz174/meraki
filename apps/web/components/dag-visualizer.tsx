/**
 * AgentFlow Web — DAG Visualizer
 *
 * Uses @xyflow/react to render a directed acyclic graph of tool call steps
 * in an agent run.
 *
 * Nodes represent steps; edges represent sequential execution order.
 * Node color reflects step status.
 */

"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface RunStep {
  id: string;
  toolName: string;
  status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed" | "skipped";
  stepIndex: number;
  durationMs?: number;
}

const STATUS_BG: Record<string, string> = {
  pending: "#374151",
  approved: "#1d4ed8",
  running: "#7c3aed",
  completed: "#065f46",
  failed: "#991b1b",
  rejected: "#92400e",
  skipped: "#374151",
};

interface DagVisualizerProps {
  steps: RunStep[];
}

export function DagVisualizer({ steps }: DagVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    const gap = 180;
    const nodeList: Node[] = steps.map((step, i) => ({
      id: step.id,
      position: { x: i * gap, y: 0 },
      data: {
        label: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600 }}>{step.toolName}</div>
            <div style={{ fontSize: "0.65rem", opacity: 0.7 }}>{step.status}</div>
            {step.durationMs !== undefined && (
              <div style={{ fontSize: "0.6rem", opacity: 0.6 }}>{step.durationMs}ms</div>
            )}
          </div>
        ),
      },
      style: {
        background: STATUS_BG[step.status] ?? "#374151",
        color: "#fff",
        borderRadius: "0.5rem",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "0.5rem",
        width: 140,
      },
    }));

    const edgeList: Edge[] = steps.slice(0, -1).map((step, i) => ({
      id: `e-${i}`,
      source: step.id,
      target: steps[i + 1]?.id ?? "",
      style: { stroke: "#4b5563" },
    }));

    return { nodes: nodeList, edges: edgeList };
  }, [steps]);

  if (steps.length === 0) {
    return (
      <div
        style={{
          height: "12rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          fontSize: "0.875rem",
          background: "var(--card)",
          borderRadius: "0.75rem",
          border: "1px solid var(--card-border)",
        }}
      >
        No tool calls yet.
      </div>
    );
  }

  return (
    <div
      style={{
        height: "16rem",
        background: "#0d1117",
        borderRadius: "0.75rem",
        border: "1px solid var(--card-border)",
        overflow: "hidden",
      }}
    >
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#2d3148" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
