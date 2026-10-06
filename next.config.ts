import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default config;
