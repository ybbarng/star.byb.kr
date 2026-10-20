import { describe, expect, it } from "vitest";
import { STARS } from "@/game/sky/catalog";
import {
  ageStars,
  bestMonthOf,
  departure,
  distanceOf,
  EVENTS,
  durationLabel,
  newBadges,
  solarLightSeconds,
} from "@/game/timeCapsule/capsule";

// 빛의 타임캡슐: 잘 알려진 별 거리, 출발 연도·사건, 내 나이 별.
const hrOf = (name: string) => STARS.find((s) => s.name === name)!.hr;

describe("별까지 거리", () => {
  it.each([
    ["Sirius", 8.6],
    ["Vega", 25],
    ["Altair", 16.7],
    ["Arcturus", 36.7],
  ])("%s: 약 %f광년 (15% 안)", (name, ly) => {
    const d = distanceOf(hrOf(name as string))!;

    expect(d.reliable).toBe(true);
    expect(
      Math.abs(d.lightYears - (ly as number)) / (ly as number),
    ).toBeLessThan(0.15);
  });
});

describe("빛이 출발한 해", () => {
  it("사건 표는 연도 순이다", () => {
    for (let i = 1; i < EVENTS.length; i++) {
      expect(EVENTS[i].year).toBeGreaterThan(EVENTS[i - 1].year);
    }
  });

  it("2026년에 본 580광년 별의 빛은 1446년 무렵 출발 — 훈민정음 반포", () => {
    const d = departure(580, 2026);

    expect(d.year).toBe(1446);
    expect(d.event.text).toContain("훈민정음");
  });
});

describe("내 나이 별", () => {
  it("25살이면 직녀성(약 25광년)이 나온다", () => {
    expect(ageStars(25).map((s) => s.name)).toContain("Vega");
  });

  it("시리우스(적경 6.75시)는 1~2월 저녁에 잘 보인다", () => {
    const sirius = STARS.find((s) => s.name === "Sirius")!;

    expect([1, 2]).toContain(bestMonthOf(sirius.vector));
  });
});

describe("별빛 도감 업적", () => {
  it("2026년에 시리우스(8.6광년)를 처음 누르면 이웃 별만 딴다", () => {
    const d = distanceOf(hrOf("Sirius"))!;
    const trip = {
      lightYears: d.lightYears,
      year: departure(d.lightYears, 2026).year,
      collected: 1,
    };

    expect(newBadges(trip, new Set()).map((b) => b.id)).toEqual(["neighbor"]);
    expect(newBadges(trip, new Set(["neighbor"]))).toEqual([]);
  });

  it("580광년 별은 조선의 빛, 열 번째 별이면 수집가도 딴다", () => {
    const ids = newBadges(
      { lightYears: 580, year: 1446, collected: 10 },
      new Set(),
    ).map((b) => b.id);

    expect(ids).toEqual(["joseon", "collector"]);
  });
});

describe("해·달·행성의 빛", () => {
  const date = new Date(Date.UTC(2026, 9, 20, 12));

  it("달빛은 약 1.3초 전에 출발했다", () => {
    expect(solarLightSeconds("달", date)).toBeGreaterThan(1.2);
    expect(solarLightSeconds("달", date)).toBeLessThan(1.4);
  });

  it("토성 빛은 1시간 남짓 (지구와 거리 8~11AU)", () => {
    const s = solarLightSeconds("토성", date)!;

    expect(s / 60).toBeGreaterThan(65);
    expect(s / 60).toBeLessThan(95);
    expect(durationLabel(s)).toMatch(/^\d+분 \d+초$/);
  });
});
