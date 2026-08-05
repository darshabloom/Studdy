import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@studdy/design-system',
    '@studdy/domain',
    '@studdy/permissions',
    '@studdy/configuration',
    '@studdy/observability',
    '@studdy/database',
  ],
  typescript: {
    // Type checking runs as a dedicated CI step (pnpm typecheck).
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
