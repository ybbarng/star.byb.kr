import { describe, expect, it } from "vitest";
import {
  introHint,
  introScene,
  introStartDials,
  LESSONS,
  lockedFor,
  minutesToDays,
} from "@/game/skyMatch/intro";
import {
  answerDials,
  dialDate,
  matchedFlags,
  SOLVED_RATIO,
  targetStars,
} from "@/game/skyMatch/match";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { contextStars, loadCatalog } from "@/test/synthetic/loadCatalog";

// 하늘 맞추기 입문: 라운드마다 돌릴 다이얼만 정답에서 떨어져 있고, 그 다이얼을 맞추면 풀리며, 힌트가 정답 쪽을 가리키는지.

const stars = contextStars(loadCatalog()).map((s) => ({
  vector: s.vector,
  mag: s.mag,
}));
const SEEDS = [3, 11, 27];

const ratioOf = (
  scene: ReturnType<typeof introScene>,
  d: { latDeg: number; dayOfYear: number; minutes: number },
) => {
  const date = dialDate(scene, d.dayOfYear, d.minutes);
  const TP = horizonCameraTP(
    date,
    { latDeg: d.latDeg, lonDeg: scene.observer.lonDeg },
    scene.view,
    scene.width,
    scene.height,
  );
  const flags = matchedFlags(targetStars(scene, stars), TP, scene);

  return flags.filter(Boolean).length / Math.max(1, flags.length);
};

describe("입문 라운드", () => {
  it("잠긴 다이얼을 기존 힌트 함수의 말로 바꾼다", () => {
    expect(lockedFor(["lat"])).toBe("time");
    expect(lockedFor(["minutes"])).toBe("lat");
    expect(lockedFor(["day"])).toBe("time");
    expect(lockedFor(["lat", "minutes"])).toBeNull();
    expect(lockedFor(["lat", "day", "minutes"])).toBeNull();
  });

  it("입문 하늘은 북반구 중위도이고, 첫 라운드는 북극이 사진 안에 있다", () => {
    for (const seed of SEEDS) {
      for (let lesson = 0; lesson < LESSONS.length; lesson++) {
        const scene = introScene(seed, lesson);

        expect(scene.observer.latDeg).toBeGreaterThanOrEqual(20);
        expect(scene.observer.latDeg).toBeLessThanOrEqual(55);
      }

      const first = introScene(seed, 0);
      const pole = projectVecToPhoto(first.TP, [0, 0, 1])!;

      expect(pole[0]).toBeGreaterThan(0);
      expect(pole[0]).toBeLessThan(first.width);
      expect(pole[1]).toBeGreaterThan(0);
      expect(pole[1]).toBeLessThan(first.height);
    }
  });

  it("돌릴 다이얼만 정답에서 떨어져 있고, 그것을 맞추면 풀린다", () => {
    for (const seed of SEEDS) {
      LESSONS.forEach((l, lesson) => {
        const scene = introScene(seed, lesson);
        const a = answerDials(scene);
        const start = introStartDials(scene, lesson);

        if (!l.free.includes("lat")) {
          expect(start.latDeg).toBe(Math.round(a.latDeg));
        }

        if (!l.free.includes("day")) {
          expect(start.dayOfYear).toBe(a.dayOfYear);
        }

        if (!l.free.includes("minutes")) {
          expect(start.minutes).toBe(a.minutes);
        }

        expect(ratioOf(scene, start)).toBeLessThan(SOLVED_RATIO);
        expect(
          ratioOf(scene, { ...a, latDeg: Math.round(a.latDeg) }),
        ).toBeGreaterThanOrEqual(SOLVED_RATIO);
      });
    }
  });

  it("힌트는 보는 법 → 하늘 단서 → 가야 할 쪽 → 구간 순서이고, 돌릴 다이얼을 가리킨다", () => {
    for (const seed of SEEDS) {
      LESSONS.forEach((l, lesson) => {
        const scene = introScene(seed, lesson);
        const start = introStartDials(scene, lesson);
        const h1 = introHint(scene, start, lesson, 1);

        expect(h1.texts).toEqual([l.look]);
        expect(introHint(scene, start, lesson, 2).texts.length).toBeGreaterThan(
          0,
        );

        const h3 = introHint(scene, start, lesson, 3);

        expect(h3.arrows).toBe(true);
        expect(l.free).toContain(h3.dial);

        const h4 = introHint(scene, start, lesson, 4);

        expect(h4.target).toBeDefined();
      });
    }
  });

  it("위도·시각을 함께 돌리는 라운드는 위도부터, 위도가 맞으면 시각을 가리킨다", () => {
    const lesson = LESSONS.findIndex((l) => l.title === "기울이고 돌리기");

    for (const seed of SEEDS) {
      const scene = introScene(seed, lesson);
      const a = answerDials(scene);
      const start = introStartDials(scene, lesson);

      expect(introHint(scene, start, lesson, 3).dial).toBe("lat");
      expect(
        introHint(scene, { ...start, latDeg: a.latDeg }, lesson, 3).dial,
      ).toBe("minutes");
    }
  });

  it("날짜 라운드의 구간 힌트는 정답 날짜를 품는다", () => {
    const lesson = LESSONS.findIndex(
      (l) => l.free.length === 1 && l.free[0] === "day",
    );
    const scene = introScene(11, lesson);
    const a = answerDials(scene);
    const start = introStartDials(scene, lesson);
    const h4 = introHint(scene, start, lesson, 4);

    expect(Math.abs(h4.target!.center - a.dayOfYear)).toBeLessThanOrEqual(
      h4.target!.halfWidth,
    );
    expect(introHint(scene, start, lesson, 3).texts[0]).toContain(
      start.dayOfYear < a.dayOfYear ? "뒤로" : "앞으로",
    );
  });

  it("끌기로 얻은 시각 변화를 날짜로 바꾼다 (한 달 ≈ 2시간)", () => {
    expect(minutesToDays(120)).toBeGreaterThanOrEqual(29);
    expect(minutesToDays(120)).toBeLessThanOrEqual(31);
    expect(minutesToDays(-120)).toBeLessThanOrEqual(-29);
    expect(minutesToDays(1440 - 4)).toBe(-1);
  });
});
