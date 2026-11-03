import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les pages lisent la DB / les cookies à chaque requête: jamais de rendu statique.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
