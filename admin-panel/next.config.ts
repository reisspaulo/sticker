import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'YOUR_SUPABASE_PROJECT_ID.supabase.co',
      },
    ],
  },
};

export default nextConfig;
