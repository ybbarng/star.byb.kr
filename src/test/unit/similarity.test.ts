import type { Point2D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  applySimilarity,
  umeyamaSimilarity2D,
} from "@/search/utils/similarity";
import { createRng, gaussian } from "@/test/synthetic/rng";

// 알려진 닮음변환으로 점들을 변환한다.
const transform = (
  pts: Point2D[],
  s: number,
  thetaDeg: number,
  tx: number,
  ty: number,
): Point2D[] => {
  const th = (thetaDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);

  return pts.map(([x, y]) => [
    s * (cos * x - sin * y) + tx,
    s * (sin * x + cos * y) + ty,
  ]);
};

// 실제 사진의 별 간격(수백 px) 규모
const src: Point2D[] = [
  [100, 100],
  [800, 120],
  [760, 700],
  [300, 950],
  [-150, 400],
];

describe("Umeyama 2D 닮음변환", () => {
  it("정확한 변환을 복원한다 (s=2.5, θ=37°, t=(120,-40))", () => {
    const dst = transform(src, 2.5, 37, 120, -40);
    const sim = umeyamaSimilarity2D(src, dst);

    expect(sim.scale).toBeCloseTo(2.5, 9);
    expect((sim.rotation * 180) / Math.PI).toBeCloseTo(37, 9);
    expect(sim.tx).toBeCloseTo(120, 6);
    expect(sim.ty).toBeCloseTo(-40, 6);
  });

  it("복원한 행렬로 변환하면 목표점과 일치한다", () => {
    const dst = transform(src, 0.7, -110, -15, 60);
    const sim = umeyamaSimilarity2D(src, dst);

    for (let i = 0; i < src.length; i++) {
      const p = applySimilarity(sim.matrix, src[i]);

      expect(p[0]).toBeCloseTo(dst[i][0], 6);
      expect(p[1]).toBeCloseTo(dst[i][1], 6);
    }
  });

  it("이동만 있는 경우 (회전 0, 스케일 1)", () => {
    const dst = transform(src, 1, 0, 50, 30);
    const sim = umeyamaSimilarity2D(src, dst);

    expect(sim.scale).toBeCloseTo(1, 9);
    expect(sim.rotation).toBeCloseTo(0, 9);
    expect(sim.tx).toBeCloseTo(50, 9);
    expect(sim.ty).toBeCloseTo(30, 9);
  });

  it("노이즈가 있어도 최소제곱으로 안정적으로 추정한다", () => {
    const rng = createRng(42);
    const trueS = 1.8;
    const trueTheta = 22;
    const clean = transform(src, trueS, trueTheta, 200, 100);
    // 각 목표점에 표준편차 0.3px 노이즈
    const noisy: Point2D[] = clean.map(([x, y]) => [
      x + gaussian(rng) * 0.3,
      y + gaussian(rng) * 0.3,
    ]);
    const sim = umeyamaSimilarity2D(src, noisy);

    expect(sim.scale).toBeCloseTo(trueS, 1);
    expect((sim.rotation * 180) / Math.PI).toBeCloseTo(trueTheta, 0);
  });
});
