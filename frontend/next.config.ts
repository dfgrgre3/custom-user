import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Prevents Next.js from mis-detecting the workspace root when the
  // backend's own package-lock.json sits one directory up.
  turbopack: {
    root: path.join(__dirname),
  },
  // Skip generating AGENTS.md/CLAUDE.md scaffold files in this folder.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/((?!_next/).*)",
        headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
      },
    ];
  },
};

export default nextConfig;
