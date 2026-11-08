import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: { '/*': ['../.local/**', '../keys/**', '../.env*'] },
  distDir: '../.next',
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  typescript: { tsconfigPath: '../tsconfig.json' },
  agentRules: false,
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client', 'sharp'],
  // Standalone tracing otherwise misses Sharp's adjacent DLL/shared-library dependencies.
  outputFileTracingIncludes: {
    '/*': ['../node_modules/.pnpm/@img+*/node_modules/@img/*/lib/**/*'],
  },
  experimental: { proxyClientMaxBodySize: '110mb' },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      { source: '/api/admin/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/preview/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
