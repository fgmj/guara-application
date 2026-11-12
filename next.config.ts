import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor enxuto em .next/standalone para a imagem Docker
  output: "standalone",
  // importação da planilha (.xlsx) por server action
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
