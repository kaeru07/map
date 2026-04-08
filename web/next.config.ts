import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/packets",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
