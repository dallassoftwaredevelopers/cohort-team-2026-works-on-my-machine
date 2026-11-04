import path from "node:path";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */

  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],

  sassOptions:{
    loadPaths: [
      path.join(__dirname, "node_modules"),
      path.join(__dirname, "node_modules/@coreui/coreui/scss"),
    ],
  },

  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default withWorkflow(nextConfig);
