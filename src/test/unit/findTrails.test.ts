import { describe, expect, it } from "vitest";
import { findTrails } from "@/search/detectCore";

// 별 궤적: 가늘고 긴 덩어리마다 원호의 가운데(노출 중간 순간의 별 자리) 점 하나 (journey 41장)
const W = 400;
const H = 300;

const blank = () => new Float32Array(W * H);

// 중심 (cx, cy), 반지름 r, 각도 a0~a1(도)의 원호를 굵기 2px로 그린다
const drawArc = (
  img: Float32Array,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
) => {
  for (let a = a0; a <= a1; a += 0.05) {
    const t = (a * Math.PI) / 180;

    for (const dr of [0, 1]) {
      const x = Math.round(cx + (r + dr) * Math.cos(t));
      const y = Math.round(cy + (r + dr) * Math.sin(t));
      img[y * W + x] = 100;
    }
  }
};

describe("findTrails", () => {
  it("원호마다 가운데 점 하나를 고른다", () => {
    const img = blank();
    drawArc(img, 200, 400, 200, 250, 290);
    drawArc(img, 200, 400, 300, 255, 285);
    const trails = findTrails(img, W, H, 50);

    expect(trails).toHaveLength(2);

    for (const [r, s] of [
      [200, trails.find((t) => t.cy > 150)!],
      [300, trails.find((t) => t.cy < 150)!],
    ] as const) {
      // 원호의 가운데는 각도 270° 자리 (200, 400 - r)
      expect(Math.hypot(s.cx - 200, s.cy - (400 - r))).toBeLessThan(3);
      expect(s.trail).toBe(true);
    }
  });

  it("둥근 별과 짧은 점은 궤적이 아니다", () => {
    const img = blank();

    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        img[(100 + dy) * W + 100 + dx] = 100;
      }
    }

    // 길이 8px 짧은 선
    for (let x = 200; x < 208; x++) {
      img[150 * W + x] = 100;
    }

    expect(findTrails(img, W, H, 50)).toHaveLength(0);
  });
});
