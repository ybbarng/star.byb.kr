import type { Point2D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { describe, expect, it } from "vitest";
import { applyHomography, fitHomography2D } from "@/search/utils/homography";

// 접선평면(라디안 규모) → 사진(px) 원근 변환. 위쪽이 넓어지는 키스톤 보정 모양.
const truth: Mat3 = [
  [1500, 120, 600],
  [-80, 1400, 400],
  [0.15, -0.4, 1],
];

const plane: Point2D[] = [];

for (let i = -3; i <= 3; i++) {
  for (let j = -2; j <= 2; j++) {
    plane.push([i * 0.1, j * 0.1]);
  }
}

describe("fitHomography2D", () => {
  it("대응에서 원근 변환을 그대로 되찾는다", () => {
    const photo = plane.map((p) => applyHomography(truth, p)!);
    const H = fitHomography2D(plane, photo)!;

    for (const p of plane) {
      const a = applyHomography(H, p)!;
      const b = applyHomography(truth, p)!;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);
    }
  });

  it("닮음변환 대응이면 닮음변환이 나온다 (원근 항이 0)", () => {
    const photo = plane.map(
      ([u, v]): Point2D => [800 * u - 300 * v + 500, 300 * u + 800 * v + 350],
    );
    const H = fitHomography2D(plane, photo)!;

    expect(Math.abs(H[2][0])).toBeLessThan(1e-9);
    expect(Math.abs(H[2][1])).toBeLessThan(1e-9);
  });

  it("대응이 4쌍보다 적으면 null", () => {
    expect(fitHomography2D(plane.slice(0, 3), plane.slice(0, 3))).toBeNull();
  });
});
