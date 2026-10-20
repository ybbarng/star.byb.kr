import { describe, expect, it } from "vitest";
import { STARS } from "@/game/sky/catalog";
import {
  ageStars,
  bestMonthOf,
  departure,
  distanceOf,
  EVENTS,
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
