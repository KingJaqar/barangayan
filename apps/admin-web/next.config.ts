import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.BARANGAYAN_PREVIEW_DIST_DIR ?? '.next',
  /* config options here */
};

export default nextConfig;
