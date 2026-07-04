import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Tell Next.js server to keep these external
  serverExternalPackages: ["sqlite3", "sqlite"],

  // 2. Tell Webpack to completely ignore these Node modules on the frontend
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
      };
    }
    return config;
  },

  // 3. Silence Turbopack webpack custom config warning
  turbopack: {},
};

export default nextConfig;
