import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // typedRoutes disabled: tab system uses dynamic paths
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
