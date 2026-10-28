import { describe, expect, it } from "vitest";
import { ringContrast } from "@/search/detectCore";
import { STARLIKE_RING_CONTRAST } from "@/search/utils/selectStars";

// 100×100 회색조 영상에 배경과 점(별)을 그린다
const W = 100;
const H = 100;

const makeImage = (background: (x: number, y: number) => number) => {
  const gray = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      gray[y * W + x] = background(x, y);
    }
  }

  // (50, 50)에 가우시안 별 (정점 +150)
  for (let y = 45; y <= 55; y++) {
    for (let x = 45; x <= 55; x++) {
      const r2 = (x - 50) ** 2 + (y - 50) ** 2;
      gray[y * W + x] = Math.min(
        255,
        gray[y * W + x] + Math.round(150 * Math.exp(-r2 / 2)),
      );
    }
  }

  return gray;
};

const star = { cx: 50, cy: 50, radius: 2 };

describe("ringContrast", () => {
  it("고른 하늘 위의 별은 작다", () => {
    const gray = makeImage(() => 30);

    expect(ringContrast(gray, W, H, star)).toBeLessThan(0.05);
  });

  it("완만한 하늘 밝기 변화(오로라·광해) 위의 별도 작다", () => {
    const gray = makeImage((x) => 30 + x * 0.3);

    expect(ringContrast(gray, W, H, star)).toBeLessThan(STARLIKE_RING_CONTRAST);
  });

  it("밝기 경계선(지붕·능선) 위의 점은 크다", () => {
    const gray = makeImage((_, y) => (y < 50 ? 30 : 120));

    expect(ringContrast(gray, W, H, star)).toBeGreaterThan(0.3);
  });

  // 가는 선은 45° 부채꼴 평균에 묽게 섞여 경계선보다 약하게 잡힌다(0.18). 그래도 기준은 넘는다.
  it("밝은 선(나무 줄기·전선) 위의 점은 별답지 않다고 본다", () => {
    const gray = makeImage((x) => (Math.abs(x - 50) <= 1 ? 140 : 30));

    expect(ringContrast(gray, W, H, star)).toBeGreaterThan(
      STARLIKE_RING_CONTRAST,
    );
  });
});
