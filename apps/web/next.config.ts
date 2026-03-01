import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Ensure Next.js works with the monorepo
  transpilePackages: ["@agentflow/shared"],
  // Fix workspace root detection warning
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {},
};

export default nextConfig;
