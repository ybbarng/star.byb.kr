import { describe, expect, it } from "vitest";
import { buildGridIndex2D, nearestInGrid } from "@/search/utils/gridIndex2D";
import { createRng } from "@/test/synthetic/rng";

// 전수 검색으로 구한 k-최근접 거리(오름차순)
const bruteForceDists = (
  xs: Float64Array,
  ys: Float64Array,
  qx: number,
  qy: number,
  k: number,
): number[] =>
  Array.from(xs, (x, i) => (x - qx) ** 2 + (ys[i] - qy) ** 2)
    .sort((a, b) => a - b)
    .slice(0, k);

const randomPoints = (count: number, seed: number) => {
  const rng = createRng(seed);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    // 삼각형 형태 키처럼 [0,1] 안에 고르지 않게 몰린 분포
    xs[i] = rng() ** 2;
    ys[i] = 0.5 + 0.5 * rng();
  }

  return { xs, ys, rng };
};

describe("gridIndex2D", () => {
  it("k-최근접이 전수 검색과 같다 (범위 안·밖 질의 모두)", () => {
    const { xs, ys, rng } = randomPoints(5000, 1);
    const index = buildGridIndex2D(xs, ys);

    for (let q = 0; q < 200; q++) {
      // 일부 질의는 점 범위 바깥에서 한다
      const qx = rng() * 1.4 - 0.2;
      const qy = rng() * 1.4 - 0.2;
      const ids = nearestInGrid(index, qx, qy, 8);
      const got = ids.map((i) => (xs[i] - qx) ** 2 + (ys[i] - qy) ** 2);

      expect(got).toEqual(bruteForceDists(xs, ys, qx, qy, 8));
    }
  });

  it("점이 k개보다 적으면 있는 만큼 돌려준다", () => {
    const xs = new Float64Array([0.1, 0.2, 0.3]);
    const ys = new Float64Array([0.1, 0.2, 0.3]);
    const index = buildGridIndex2D(xs, ys);

    expect(nearestInGrid(index, 0, 0, 8)).toEqual([0, 1, 2]);
  });
});
