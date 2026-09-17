import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wallet SDK dependencies with optional dynamic imports (e.g. @x402/*) that
  // we never use. Loading them at runtime on the server, instead of bundling,
  // keeps the build from failing on those missing optional packages.
  serverExternalPackages: ["@base-org/account", "@coinbase/cdp-sdk"],
};

export default nextConfig;
