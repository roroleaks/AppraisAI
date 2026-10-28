import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'docx', 'fast-xml-parser'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
