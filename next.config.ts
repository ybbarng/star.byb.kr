import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정적 내보내기: 모든 페이지가 정적이고 계산은 브라우저에서 하므로 out/ 을 nginx로 내려주기만 한다 (docs/deployment.md)
  output: "export",
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
