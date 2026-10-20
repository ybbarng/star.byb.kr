import type { Point2D } from "@/scripts/hash/types";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectHorizon } from "@/search/utils/horizonDetect";
import { rankForSolving } from "@/search/utils/selectStars";
import { detectLikeApp } from "@/test/real/detectImage";

// 지평선 자동 찾기 회귀. 사람이 사진에 눈금을 대고 읽은 지평선(사진 왼쪽 10%·오른쪽 90% 지점의 높이,
// 사진 높이 대비)과 3% 안이어야 한다 (journey 26장). 아직 못 맞히는 사진은 KNOWN_MISSES에 적고
// 이유를 남긴다 — 나아지면 옮긴다.
const LABELED: Record<string, [number, number]> = {
  "20190617-jarrod-saipan.jpg": [0.607, 0.607], // 바다 수평선
  "20230904-nike-jeungseun-01.png": [0.94, 0.94], // 맨 아래 먼 땅
  "20230904-nike-jeungseun-02.png": [0.9, 0.89], // 산 능선
  "20250117-carl-aurora-02.jpg": [0.69, 0.69], // 먼 산
  "20250117-carl-aurora-04.jpg": [0.78, 0.79], // 집 뒤 산
};

// 아직 3% 밖인 사진 (정답 라벨, 지금 고른 경계)
export const KNOWN_MISSES: Record<string, string> = {
  "20220607-berry-seoul.jpg": "0.79 먼 능선 — 정자 지붕 쪽 경계와 섞인다 (5%)",
  "20231012-nike-aust-01.jpg": "0.72→0.78 언덕 — 비탈을 따라간다 (5%)",
  "20231012-nike-aust-02.jpg": "0.85 들판 — 덤불 윗선 (6%)",
  "20250117-carl-aurora-01.jpg": "0.82 눈밭 너머 — 집·숲 경계 (13%)",
};

// 하늘만 있는 사진: 지평선이 없다고 해야 한다
const SKY_ONLY = ["big-dipper.jpg", "cafe-orion.jpg", "google-unknown.jpg"];

const samplesDir = resolve(process.cwd(), "public/samples");

const detectFile = async (file: string) => {
  const path = resolve(samplesDir, file);
  const { data, info } = await sharp(path)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { stars, width, height } = await detectLikeApp(path);
  const top = rankForSolving(stars, width, height)
    .slice(0, 60)
    .map((s): Point2D => [s.x, s.y]);

  return {
    horizon: detectHorizon(data, info.width, info.height, info.channels, top),
    height,
  };
};

describe.skipIf(!existsSync(samplesDir))("지평선 자동 찾기", () => {
  it.each(Object.entries(LABELED))(
    "%s: 사람이 그은 지평선과 3% 안",
    async (file, [left, right]) => {
      const { horizon, height } = await detectFile(file);

      expect(horizon).not.toBeNull();

      const [[, y0], [, y1]] = horizon!.line;
      const yAt = (fx: number) => (y0 + (y1 - y0) * fx) / height;

      expect(Math.abs(yAt(0.1) - left)).toBeLessThan(0.03);
      expect(Math.abs(yAt(0.9) - right)).toBeLessThan(0.03);
    },
    30000,
  );

  it.each(SKY_ONLY)(
    "%s: 하늘만 있으면 지평선이 없다",
    async (file) => {
      expect((await detectFile(file)).horizon).toBeNull();
    },
    30000,
  );
});
