import { describe, expect, it } from "vitest";
import {
  constellationRaDeg,
  distanceKm,
  explain,
  makeGeoProblem,
  midnightLstDeg,
  pointsFor,
  SEASON_CARD,
} from "@/game/geo/problem";
import { isLand } from "@/game/geo/world";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";

// SkyGuessr: 문제는 땅 위, 고른 하늘 때(저녁·한밤·새벽)에 맞고, 점수는 거리로 줄어든다.

const sunAlt = (p: ReturnType<typeof makeGeoProblem>) => {
  const jd = julianDay(p.date);

  return altAzOf(sunVector(jd), jd, p.observer).altDeg;
};

describe("육지 판정", () => {
  it.each([
    [37.57, 126.98, true], // 서울
    [48.86, 2.35, true], // 파리
    [-33.87, 151.21, true], // 시드니
    [30, -40, false], // 대서양
    [0, -150, false], // 태평양
  ])("(%f, %f) 육지 %s", (lat, lon, land) => {
    expect(isLand(lat, lon)).toBe(land);
  });
});

describe("문제 만들기", () => {
  const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 1);

  it.each(["easy", "normal", "hard"] as const)(
    "%s: 땅 위에서, 하늘 때에 맞는 순간",
    (difficulty) => {
      for (const seed of SEEDS) {
        const p = makeGeoProblem(seed, difficulty);
        const alt = sunAlt(p);

        expect(isLand(p.observer.latDeg, p.observer.lonDeg)).toBe(true);

        if (p.skyTime === "night") {
          expect(alt).toBeLessThan(-17.5);
        } else {
          expect(alt).toBeLessThan(-5.5);
          expect(alt).toBeGreaterThan(-11.5);
        }
      }
    },
  );

  it("같은 시드면 같은 문제", () => {
    expect(makeGeoProblem(42, "normal")).toEqual(makeGeoProblem(42, "normal"));
  });
});

describe("점수", () => {
  it("서울-도쿄 약 1,160km, 거리가 멀수록 점수가 준다", () => {
    const seoul = { latDeg: 37.57, lonDeg: 126.98 };
    const tokyo = { latDeg: 35.68, lonDeg: 139.69 };
    const d = distanceKm(seoul, tokyo);

    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
    expect(pointsFor(0, 0)).toBe(5000);
    expect(pointsFor(d, 0)).toBeLessThan(pointsFor(100, 0));
    expect(pointsFor(0, 0.3)).toBe(3500);
  });
});

describe("풀이", () => {
  it.each(SEASON_CARD)(
    "계절 별자리 카드 $month월 $label: 그 달 15일 자정에 하늘 한가운데(±1.5시간)",
    ({ month, label }) => {
      const gap = Math.abs(
        ((constellationRaDeg(label) - midnightLstDeg(month) + 540) % 360) - 180,
      );

      expect(gap / 15).toBeLessThan(1.5);
    },
  );

  it("카드의 별자리는 달마다 다르다", () => {
    expect(new Set(SEASON_CARD.map((c) => c.label)).size).toBe(12);
  });

  it("현지 시각 - UTC = 경도 / 15", () => {
    const p = makeGeoProblem(7, "easy");
    const e = explain(p);
    const toMin = (c: string) =>
      Number(c.slice(0, 2)) * 60 + Number(c.slice(3));
    const diff =
      ((((toMin(e.localClock) - toMin(e.utcClock)) / 60) % 24) + 24) % 24;

    expect(Math.abs(diff - ((e.hourOffset + 24) % 24))).toBeLessThan(0.05);
  });
});
