import type { NextConfig } from 'next';

/** Cabeçalhos de segurança em todas as respostas. O editor roda num iframe do próprio site (por isso SAMEORIGIN / frame-ancestors 'self'). */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // nunca reaproveitar no navegador o resultado de páginas dinâmicas: os dados mudam por marca e por usuário
  experimental: { staleTimes: { dynamic: 0 } },
  outputFileTracingIncludes: { '/editor': ['./private/**'] },
};

export default nextConfig;
