import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    config.externals = [...config.externals, { canvas: "canvas" }]; // required to make Konva & react-konva work

    if (!isServer) {
      config.externals.push({ mathjs: "math" });
    }

    return config;
  },
  devIndicators: {
    appIsrStatus: false, // defaults to true
    buildActivity: false, // defaults to true
  },
};

export default nextConfig;
