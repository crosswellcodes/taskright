import type { NextConfig } from "next";

// Google Analytics 4 Integration:
//   - Set NEXT_PUBLIC_GA_ID in .env.local for development
//   - Set NEXT_PUBLIC_GA_ID in your deployment environment (Vercel, etc.) for production
//   - Get your GA4 Measurement ID at: https://analytics.google.com
//   - Implementation: src/app/layout.tsx (script injection) + src/components/EarlyAccessForm.tsx (event tracking)
//
// Google Search Console:
//   - Set NEXT_PUBLIC_GSC_VERIFICATION in .env.local and deployment environment
//   - Get verification code at: https://search.google.com/search-console

const nextConfig: NextConfig = {
  compress: true,

  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "taskright.com",
      },
    ],
  },

  async headers() {
    return [
      // Security headers applied to all routes
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Cache control for SEO-critical static files
      {
        source: "/robots.txt",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }, // 1 day
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }, // 1 day
        ],
      },
      {
        source: "/og-image.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }, // 1 year
        ],
      },
      {
        source: "/logo.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }, // 1 year
        ],
      },
    ];
  },
};

export default nextConfig;
