import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@novacal/shared",
    "@novacal/db",
    "@novacal/auth",
    "@novacal/ui",
  ],
  experimental: {
    optimizePackageImports: [
      "@novacal/ui",
      "lucide-react",
      "framer-motion",
    ],
  },
};

export default nextConfig;
