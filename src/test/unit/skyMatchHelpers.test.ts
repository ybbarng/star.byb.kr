import { describe, expect, it } from "vitest";
import { makeSkyScene } from "@/game/sky/scene";
import {
  answerDials,
  dialDate,
  matchedFlags,
  SOLVED_RATIO,
  targetStars,
} from "@/game/skyMatch/match";
import {
  computerSolve,
  hintFor,
  skyClues,
  skyError,
  storyClues,
} from "@/game/skyMatch/solveSteps";
import { horizonCameraTP } from "@/search/horizonSolve";
import { contextStars, loadCatalog } from "@/test/synthetic/loadCatalog";

// 하늘 맞추기 도우미: 방향 힌트가 정답 쪽을 가리키는지, 컴퓨터 풀이(지평선 → 천정 → 위도·시각)가 정답 하늘을 만드는지.

const stars = contextStars(loadCatalog()).map((s) => ({
  vector: s.vector,
  mag: s.mag,
}));
const SEEDS = [3, 11, 27, 58, 91];

describe("방향 힌트", () => {
  const scene = makeSkyScene(11, "easy");
  const a = answerDials(scene);

  it("정답 다이얼이면 어긋남이 0에 가깝다", () => {
    const e = skyError(scene, a);

    expect(Math.abs(e.latDeg)).toBeLessThan(0.01);
    expect(Math.abs(e.turnDeg)).toBeLessThan(0.5);
  });

  it("위도만 남쪽으로 20° 틀리면 위도를 북쪽으로 옮기라고 한다", () => {
    const h = hintFor(scene, { ...a, latDeg: a.latDeg - 20 }, 3, null);

    expect(h.dial).toBe("lat");
    expect(h.texts.join()).toContain("북쪽");
    expect(h.arrows).toBe(true);
  });

  it("시각만 2시간 이르면 늦게 돌리라고 하고, 4단계 구간이 정답 시각을 품는다", () => {
    const dials = { ...a, minutes: a.minutes - 120 };

    expect(hintFor(scene, dials, 3, null).texts.join()).toContain("늦게");

    const t = hintFor(scene, dials, 4, null).target!;
    const gap = Math.abs(((t.center - a.minutes + 720) % 1440) - 720);

    expect(gap).toBeLessThan(5);
  });

  it("잠긴 다이얼은 힌트로 고르지 않는다", () => {
    const dials = { ...a, latDeg: a.latDeg - 30 };

    expect(hintFor(scene, dials, 3, "lat").dial).toBe("time");
  });
});

describe("컴퓨터는 이렇게 푼다", () => {
  it.each(SEEDS)(
    "문제 %i: 천정의 적위가 위도, 구한 시각으로 정답 하늘이 된다",
    (seed) => {
      const scene = makeSkyScene(seed, "easy");
      const a = answerDials(scene);
      // 정답과 다른 날짜에서도 같은 하늘이 되는 시각을 찾는다
      const day = (a.dayOfYear + 100) % 365;
      const solve = computerSolve(scene, day, []);

      expect(Math.abs(solve.latDeg - scene.observer.latDeg)).toBeLessThan(0.5);

      const targets = targetStars(scene, stars);
      const TP = horizonCameraTP(
        dialDate(scene, day, solve.minutes),
        { latDeg: Math.round(solve.latDeg), lonDeg: scene.observer.lonDeg },
        scene.view,
        scene.width,
        scene.height,
      );
      const flags = matchedFlags(targets, TP, scene);

      expect(
        flags.filter(Boolean).length / flags.length,
      ).toBeGreaterThanOrEqual(SOLVED_RATIO);
    },
  );
});

describe("이야기·하늘 단서", () => {
  const at = (latDeg: number, iso: string, lonDeg = 0) => ({
    ...makeSkyScene(5, "easy"),
    observer: { latDeg, lonDeg },
    date: new Date(iso),
  });

  it("적도 근처는 일 년 내내 덥고, 남반구면 그렇게 말한다", () => {
    expect(storyClues(at(5, "2026-01-10T22:00:00Z"), null)[0]).toContain(
      "덥고",
    );
    expect(storyClues(at(-33, "2026-01-10T22:00:00Z"), null)[0]).toContain(
      "남반구",
    );
  });

  it("남반구의 1월은 여름, 22시는 자정이 다가오는 밤", () => {
    expect(storyClues(at(-33, "2026-01-10T22:00:00Z"), null)[1]).toBe(
      "남반구의 여름, 자정이 다가오는 밤이에요.",
    );
  });

  it("잠긴 다이얼에 대한 단서는 내지 않는다", () => {
    const scene = at(40, "2026-07-01T01:00:00Z");

    expect(storyClues(scene, "lat")).toHaveLength(1);
    expect(storyClues(scene, "time")).toHaveLength(1);
    expect(skyClues(scene, "time")[0]).toContain("40°");
  });
});
