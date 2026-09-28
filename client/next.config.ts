import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiServerUrl = process.env.API_SERVER_URL;
    if (!apiServerUrl) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiServerUrl.replace(/\/$/, "")}/api/v1/:path*` }];
  },
};

export default nextConfig;
