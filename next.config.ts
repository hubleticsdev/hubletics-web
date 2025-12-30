import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google avatars
      },
      {
        protocol: 'https',
        hostname: 'utfs.io', // UploadThing
      },
    ],
  },
  serverExternalPackages: [
    'ably',
    'keyv',
    'cacheable-request',
    'got',
    '@keyv/redis',
    '@keyv/mongo',
    '@keyv/sqlite',
    '@keyv/postgres',
    '@keyv/mysql',
    '@keyv/etcd',
    '@keyv/offline',
    '@keyv/tiered',
  ],
};

export default nextConfig;
