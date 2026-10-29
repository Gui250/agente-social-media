import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Read with fs at runtime by the agent (skills) and the slide-text overlay (fonts).
  outputFileTracingIncludes: {
    "/api/chat": ["./skills/**/*", "./assets/fonts/**/*"],
    "/api/chat/approvals": ["./skills/**/*", "./assets/fonts/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
