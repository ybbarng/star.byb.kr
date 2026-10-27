import type { Difficulty } from "@/game/sky/scene";
import { describe, expect, it } from "vitest";
import { orderTargets, pushRecent } from "@/game/findConstellation/recent";
import {
  isHit,
  LANDSCAPE,
  makeFindScene,
  makeFindSceneRetry,
  PORTRAIT,
  targetPoints,
} from "@/game/findConstellation/scene";
import { findTargets } from "@/game/findConstellation/targets";
import {
  CONSTELLATIONS,
  constellationParts,
  projectLines,
  uniqueStars,
} from "@/game/sky/catalog";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
const labelsOf = (d: Difficulty) => findTargets(d).map((t) => t.label);

describe("난이도별 낼 별자리 목록", () => {
  it.each(DIFFICULTIES)(
    "%s: 이름이 모두 별자리 데이터에 있고 겹치지 않는다",
    (d) => {
      const labels = labelsOf(d);

      for (const label of labels) {
        expect(constellationParts(label).length, label).toBeGreaterThan(0);
      }

      expect(new Set(labels).size).toBe(labels.length);
    },
  );

  it("쉬움 ⊂ 보통 ⊂ 어려움이고, 어려움은 88개 별자리 전부다", () => {
    const easy = labelsOf("easy");
    const normal = labelsOf("normal");
    const hard = labelsOf("hard");

    expect(normal.length).toBeGreaterThan(easy.length);
    expect(hard.length).toBeGreaterThan(normal.length);
    expect(easy.every((l) => normal.includes(l))).toBe(true);
    expect(normal.every((l) => hard.includes(l))).toBe(true);

    const all = new Set(CONSTELLATIONS.map((c) => c.label));
    expect(all.size).toBe(88);
    expect(new Set(hard)).toEqual(all);
  });
});

// 숨은그림찾기: 낼 별자리마다 별자리 전체가 사진 안에 들어오는 밤하늘을 만들 수 있어야 한다.
describe("별자리 숨은그림찾기 문제", () => {
  // 넓은 화면은 가로로 긴 하늘, 휴대폰은 세로로 긴 하늘
  const cases = (["가로", "세로"] as const).flatMap((shape) =>
    DIFFICULTIES.flatMap((d) =>
      labelsOf(d).map((label) => [shape, d, label] as const),
    ),
  );

  it.each(cases)(
    "%s %s %s: 밤이고 별자리선 전체가 사진 안에 있는 문제를 만든다",
    (shape, difficulty, label) => {
      const size = shape === "가로" ? LANDSCAPE : PORTRAIT;

      for (const seed of [1, 2]) {
        const scene = makeFindSceneRetry(label, seed, difficulty, size)!;

        expect(scene).not.toBeNull();

        const jd = julianDay(scene.date);
        expect(altAzOf(sunVector(jd), jd, scene.observer).altDeg).toBeLessThan(
          -15,
        );

        // 별자리 별이 하나도 빠짐없이 사진 안에, 선도 끊기지 않고 그려진다
        const points = targetPoints(scene);
        expect(points).toHaveLength(uniqueStars(scene.target).length);

        for (const [x, y] of points) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(scene.width);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(scene.height);
        }

        const lines = projectLines(scene.TP, scene.target);
        expect(lines.reduce((n, l) => n + l.length, 0)).toBe(
          scene.target.reduce((n, c) => n + c.stars.length, 0),
        );
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

describe("최근에 낸 별자리를 덜 내기", () => {
  const pool = findTargets("easy");

  it("최근에 안 낸 것을 먼저, 낸 것은 오래전에 낸 것부터 뒤에 둔다", () => {
    // 맨 앞이 가장 최근
    const recent = ["오리온자리", "큰곰자리", "전갈자리"];
    const order = orderTargets(pool, recent, createRng(7)).map((t) => t.label);

    expect(order).toHaveLength(pool.length);
    expect(new Set(order).size).toBe(pool.length);
    expect(
      order.slice(0, pool.length - 3).some((l) => recent.includes(l)),
    ).toBe(false);
    expect(order.slice(-3)).toEqual(["전갈자리", "큰곰자리", "오리온자리"]);
  });

  it("기억이 없으면 무작위 순서이고 시드마다 다르다", () => {
    const a = orderTargets(pool, [], createRng(1)).map((t) => t.label);
    const b = orderTargets(pool, [], createRng(2)).map((t) => t.label);

    expect(a).not.toEqual(b);
  });

  it("몇 판을 이어 해도 별자리를 다 낼 때까지 같은 것이 다시 나오지 않는다", () => {
    let recent: string[] = [];
    const seen: string[] = [];

    for (let game = 0; game < 3; game++) {
      const order = orderTargets(pool, recent, createRng(100 + game));

      for (const t of order.slice(0, 5)) {
        seen.push(t.label);
        recent = pushRecent(recent, t.label, pool.length);
      }
    }

    expect(new Set(seen).size).toBe(15);
  });

  it("기억은 낼 수 있는 별자리 수까지만, 같은 이름은 한 번만", () => {
    expect(pushRecent(["a", "b", "c"], "b", 3)).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
});
