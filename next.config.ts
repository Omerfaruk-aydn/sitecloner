import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['lenis'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // download-assets.js tarafından otomatik güncellenir
      { protocol: 'https', hostname: 'www.nusr-et.com.tr' },
    ],
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
};

export default config;
