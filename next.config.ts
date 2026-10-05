import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone con un server.js mínimo para la imagen Docker.
  output: "standalone",
};

export default nextConfig;
