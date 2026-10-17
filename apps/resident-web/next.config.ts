import type { NextConfig } from "next";

function supabaseHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "*.supabase.co"; // build-time fallback if the env var is missing/malformed
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.BARANGAYAN_PREVIEW_DIST_DIR ?? '.next',
  redirects() {
    return [{ source: '/onboarding', destination: '/home', permanent: true }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHostname(), pathname: "/storage/v1/object/**" },
    ],
  },
};

export default nextConfig;
