import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/core", "@repo/db", "@repo/ui-web"],
};

export default nextConfig;
