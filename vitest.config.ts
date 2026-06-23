import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// tsconfig의 경로 별칭(@/, @build/, @data/)을 vitest에서도 해석하도록 명시한다.
// (vitest는 기본적으로 tsconfig paths를 모름)
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@build": fileURLToPath(new URL("./build", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/**/*.{test,bench}.ts"],
    testTimeout: 30000,
    // 카탈로그 인덱스(KD-Tree·삼각형) 구축 setup 훅이 무거워 기본 10초를 넘길 수 있다.
    hookTimeout: 60000,
  },
});
