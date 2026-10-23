import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  sassOptions:{
    includePaths: [
      "node_modules",
      "node_modules/@coreui/coreui/scss",
    ],
  },

  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
