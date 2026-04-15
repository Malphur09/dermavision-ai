import type { NextConfig } from "next";

const flaskInternalUrl = process.env.FLASK_INTERNAL_URL ?? "http://127.0.0.1:5328";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: process.env.NODE_ENV === "development"
          ? `${flaskInternalUrl}/api/:path*`
          : "/api/",
      },
    ];
  },
};

export default nextConfig;
