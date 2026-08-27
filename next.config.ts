// Next.js configuration
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
    // 30-day CDN/browser cache for optimized images — avatars/attachments are
    // immutable-ish (re-uploads change the URL), so this is safe to cache hard.
    minimumCacheTTL: 2592000,
  },
  // Tree-shakes these libraries to only the modules actually imported, instead
  // of bundling the whole package — cuts client JS for icon-heavy and
  // chart-heavy pages (dashboard, sidebar, calendar, kanban drag-and-drop).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "react-big-calendar",
      "@dnd-kit/core",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Microphone is needed for both voice-note recording (on our own
          // origin) and the Daily.co call iframe — a blanket microphone=()
          // here doesn't just fail to prompt for permission, it prevents
          // the browser from ever asking at all (and blocks delegating the
          // permission into the call iframe), which is exactly the "access
          // denied, no prompt ever appeared" symptom.
          { key: "Permissions-Policy", value: 'camera=(), microphone=(self "https://taskco.daily.co"), geolocation=()' },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co",
              // Voice notes and video attachments are <audio>/<video> tags
              // pointing at Supabase storage — same missing-directive gap as
              // frame-src had, media-src falls back to default-src 'self'
              // without this and silently blocks them from playing.
              "media-src 'self' blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              // The in-app document viewer embeds PDFs directly from Supabase
              // storage and routes Word/Excel through Microsoft's viewer —
              // both are different origins, and with no frame-src set this
              // fell back to default-src 'self', silently blocking every
              // embed ("This content is blocked"). Daily.co's call room is
              // the same story — it's an iframe to a different origin too.
              "frame-src 'self' https://*.supabase.co https://view.officeapps.live.com https://*.daily.co",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
