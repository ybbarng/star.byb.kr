import { describe, expect, it } from "vitest";
import { buildKdTree4, nearestK } from "@/search/utils/kdTree4";
import { createRng } from "@/test/synthetic/rng";

// 4차원 KD-tree: 무작위 점에서 전수 비교와 같은 최근접 k개를 찾는다.
describe("kdTree4", () => {
  const rng = createRng(3);
  const n = 5000;
  const coords = new Float64Array(n * 4).map(() => rng());
  const tree = buildKdTree4(coords);

  const brute = (q: number[], k: number) =>
    Array.from({ length: n }, (_, i) => ({
      index: i,
      distance: [0, 1, 2, 3].reduce(
        (s, a) => s + (q[a] - coords[i * 4 + a]) ** 2,
        0,
      ),
    }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);

  it.each([1, 3, 8])("최근접 %i개가 전수 비교와 같다", (k) => {
    for (let t = 0; t < 200; t++) {
      const q = [rng(), rng(), rng(), rng()];

      expect(nearestK(tree, q, k).map((r) => r.index)).toEqual(
        brute(q, k).map((r) => r.index),
      );
    }
  });

  it("점보다 많이 달라고 하면 있는 만큼", () => {
    const small = buildKdTree4(new Float64Array([0, 0, 0, 0, 1, 1, 1, 1]));

    expect(
      nearestK(small, [0.9, 0.9, 0.9, 0.9], 5).map((r) => r.index),
    ).toEqual([1, 0]);
  });
});
