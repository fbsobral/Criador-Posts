import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // nunca reaproveitar no navegador o resultado de páginas dinâmicas: os dados mudam por marca e por usuário
  experimental: { staleTimes: { dynamic: 0, static: 0 } },
  outputFileTracingIncludes: { '/editor': ['./private/**'] },
};

export default nextConfig;
