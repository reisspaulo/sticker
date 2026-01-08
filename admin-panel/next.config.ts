import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ludlztjdvwsrwlsczoje.supabase.co',
      },
    ],
  },
};

export default nextConfig;
