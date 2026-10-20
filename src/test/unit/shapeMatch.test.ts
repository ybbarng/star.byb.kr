import type { Point2D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { matchShape, TEMPLATES } from "@/game/drawConstellation/shapeMatch";
import { createRng, gaussian } from "@/utils/rng";

// 점 찍어 별자리 찾기: 별자리 모양을 아무렇게나 옮기고 돌리고 키우고 조금 흔들어 찍어도 그 별자리가 1위.
const drawLike = (label: string, seed: number, jitter: number): Point2D[] => {
  const t = TEMPLATES.find((x) => x.label === label)!;
  const rng = createRng(seed);
  const angle = rng() * Math.PI * 2;
  const pts = t.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const size = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const k = 400 / size;

  return pts.map(([x, y]) => [
    400 +
      k * (x * Math.cos(angle) - y * Math.sin(angle)) +
      gaussian(rng) * jitter,
    300 +
      k * (x * Math.sin(angle) + y * Math.cos(angle)) +
      gaussian(rng) * jitter,
  ]);
};

describe("모양으로 별자리 찾기", () => {
  it.each([
    "오리온자리",
    "카시오페이아자리",
    "백조자리",
    "사자자리",
    "전갈자리",
    "페가수스자리",
    "거문고자리",
  ])("%s: 옮기고 돌리고 흔들어 찍어도 1위", (label) => {
    for (const seed of [1, 2, 3]) {
      expect(matchShape(drawLike(label, seed, 4))[0].label).toBe(label);
    }
  });

  it("점이 3개보다 적으면 아직 고르지 않는다", () => {
    expect(
      matchShape([
        [0, 0],
        [10, 10],
      ]),
    ).toEqual([]);
  });
});
