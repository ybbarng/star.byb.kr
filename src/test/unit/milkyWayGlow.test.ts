import { describe, expect, it } from "vitest";
import { makeGlow } from "@/search/milkyWayGlow";

// 은하수 띠·지도 대조에 쓰는 사진의 흐린 썸네일 (journey 57장)
describe("makeGlow", () => {
  it("가로 칸 수에 맞춰 세로 칸 수를 사진 비율대로 정한다", () => {
    const g = makeGlow(new Uint8Array(300 * 200), 300, 200, 96);

    expect(g.cols).toBe(96);
    expect(g.rows).toBe(64);
    expect(g.data.length).toBe(96 * 64);
  });

  it("고른 밝기는 칸 평균·흐림을 거쳐도 그대로다", () => {
    const g = makeGlow(new Uint8Array(400 * 300).fill(80), 400, 300, 48);

    for (const v of g.data) {
      expect(v).toBeCloseTo(80, 5);
    }
  });

  it("왼쪽 절반이 밝으면 왼쪽 칸이 밝고, 경계는 흐림으로 부드럽게 이어진다", () => {
    const w = 200;
    const h = 100;
    const gray = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w / 2; x++) {
        gray[y * w + x] = 200;
      }
    }

    const g = makeGlow(gray, w, h, 20);
    const row = Array.from(g.data.slice(5 * g.cols, 6 * g.cols));

    expect(row[0]).toBeCloseTo(200, 3);
    expect(row[19]).toBeCloseTo(0, 3);
    // 경계 양옆 칸은 흐림으로 섞인다
    expect(row[9]).toBeGreaterThan(100);
    expect(row[9]).toBeLessThan(200);
    expect(row[10]).toBeGreaterThan(0);
    expect(row[10]).toBeLessThan(100);
  });
});
