import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { '/editor': ['./private/**'] },
};

export default nextConfig;
