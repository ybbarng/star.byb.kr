import { describe, expect, it } from "vitest";
import {
  isHit,
  makeFindScene,
  targetPoints,
} from "@/game/findConstellation/scene";
import { FIND_TARGETS } from "@/game/findConstellation/targets";
import { constellationParts } from "@/game/sky/catalog";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";

// 숨은그림찾기: 낼 별자리마다 별자리 전체가 사진 안에 들어오는 밤하늘을 만들 수 있어야 한다.
describe("별자리 숨은그림찾기 문제", () => {
  it.each(FIND_TARGETS.map((t) => t.label))(
    "%s: 별자리 데이터에 있다",
    (label) => {
      expect(constellationParts(label).length).toBeGreaterThan(0);
    },
  );

  it.each(FIND_TARGETS.map((t) => t.label))(
    "%s: 밤이고 별자리 전체가 사진 안에 있는 문제를 만든다",
    (label) => {
      for (const seed of [1, 2, 3]) {
        const scene = makeFindScene(label, seed, "normal")!;

        expect(scene).not.toBeNull();

        const jd = julianDay(scene.date);
        expect(altAzOf(sunVector(jd), jd, scene.observer).altDeg).toBeLessThan(
          -15,
        );

        for (const [x, y] of targetPoints(scene)) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(scene.width);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(scene.height);
        }
      }
    },
  );

  it("별자리 위를 누르면 찾은 것, 먼 곳을 누르면 아니다", () => {
    const scene = makeFindScene("오리온자리", 5, "easy")!;
    const [x, y] = targetPoints(scene)[0];

    expect(isHit(scene, x, y)).toBe(true);
    expect(isHit(scene, x + 2000, y)).toBe(false);
  });
});
