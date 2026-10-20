import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }]; // required to make Konva & react-konva work

    return config;
  },
  devIndicators: {
    appIsrStatus: false, // defaults to true
    buildActivity: false, // defaults to true
  },
};

export default nextConfig;
