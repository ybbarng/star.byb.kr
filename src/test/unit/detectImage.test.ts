import { describe, expect, it } from "vitest";
import { detectCoarseStars, shrinkGray } from "@/search/detectImage";

describe("줄인 사진 검출 (journey 54장)", () => {
  it("shrinkGray는 k×k 칸 평균으로 줄이고 남는 가장자리는 버린다", () => {
    // 5×4 사진을 2배로 줄이면 2×2 (마지막 열은 버린다)
    const gray = Uint8Array.from([
      0, 2, 10, 20, 99, 4, 6, 30, 40, 99, 100, 100, 1, 1, 99, 100, 100, 3, 3,
      99,
    ]);
    const out = shrinkGray(gray, 5, 4, 2);

    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect([...out.gray]).toEqual([3, 25, 100, 2]);
  });

  it("빛무리가 넓게 퍼진 밝은 별을 원래 사진 좌표로 찾는다", () => {
    // 1920×1280 어두운 하늘에 σ 20px로 퍼진 밝은 별 하나 (흐림 σ8보다 넓다)
    const W = 1920;
    const H = 1280;
    const rgba = new Uint8ClampedArray(W * H * 4);
    const [sx, sy] = [700, 500];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r2 = (x - sx) ** 2 + (y - sy) ** 2;
        const v = 10 + 230 * Math.exp(-r2 / (2 * 20 * 20));
        const k = (y * W + x) * 4;
        rgba[k] = rgba[k + 1] = rgba[k + 2] = v;
        rgba[k + 3] = 255;
      }
    }

    const stars = detectCoarseStars(rgba, W, H);
    const brightest = stars.reduce((a, b) =>
      b.brightness > a.brightness ? b : a,
    );

    expect(Math.hypot(brightest.cx - sx, brightest.cy - sy)).toBeLessThan(6);
  });

  it("이미 작은 사진(긴 변이 COARSE_LONG_SIDE의 1.5배 미만)은 줄이지 않는다", () => {
    expect(
      detectCoarseStars(new Uint8ClampedArray(600 * 400 * 4), 600, 400),
    ).toEqual([]);
  });
});
