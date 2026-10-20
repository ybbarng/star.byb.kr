import { describe, expect, it } from "vitest";
import { chartProjection } from "@/game/birthday/drawChart";
import {
  birthdaySky,
  toEcliptic,
  ZODIAC,
  zodiacAt,
  zodiacWidthDeg,
} from "@/game/birthday/zodiac";
import { constellationParts, uniqueStars } from "@/game/sky/catalog";

// 생일 별자리: 경계표가 실제 별자리 별 위치와 맞는지, 해가 지나는 날짜가 알려진 값과 맞는지.
describe("황도 별자리 경계", () => {
  it("13개 폭의 합이 360°", () => {
    const total = ZODIAC.reduce((s, z) => s + zodiacWidthDeg(z), 0);

    expect(total).toBeCloseTo(360, 6);
  });

  // 별자리선 별들 중 황도 바로 근처(황위 ±4°)의 별은 그 별자리 경계 안에 있어야 한다.
  // 경계표를 기억에 의존해 적었으므로, 실제 별 위치로 교차 확인한다. 경계선은 황도에 비스듬해서
  // 황도에서 먼 별은 황경만으로 판정할 수 없다 (안타레스는 전갈자리지만 황경으로는 뱀주인자리 구간).
  it.each(ZODIAC.map((z) => z.label))(
    "%s: 황도 가까운 별자리 별들이 경계 안에 있다",
    (label) => {
      const near = uniqueStars(constellationParts(label))
        .map(toEcliptic)
        .filter((e) => Math.abs(e.latDeg) < 4);
      const inside = near.filter((e) => zodiacAt(e.lonDeg).label === label);

      // 뱀주인자리는 별자리선의 별이 모두 황도에서 멀다 — 아래 날짜 테스트(12월 5일)가 확인한다
      if (near.length === 0) {
        return;
      }

      // 경계는 별자리선의 별보다 넓게 그어져 있지만, 별자리 끝의 별은 이웃과 섞일 수 있다
      expect(inside.length / near.length).toBeGreaterThanOrEqual(0.6);
    },
  );
});

describe("생일의 해", () => {
  // 해가 별자리에 머무는 기간 (IAU 경계 기준으로 널리 알려진 날짜)
  it.each([
    [2026, 3, 1, "물병자리"],
    [2026, 3, 20, "물고기자리"],
    [2026, 5, 1, "양자리"],
    [2026, 8, 1, "게자리"],
    [2026, 10, 1, "처녀자리"],
    [2026, 11, 25, "전갈자리"],
    [2026, 12, 5, "뱀주인자리"],
    [2026, 12, 25, "궁수자리"],
  ])("%i-%i-%i: 해는 %s에 있다", (y, m, d, label) => {
    expect(birthdaySky(y, m, d).constellation.label).toBe(label);
  });

  it("점성술 별자리는 춘분점부터 30°씩: 3월 25일은 양자리, 4월 25일은 황소자리", () => {
    expect(birthdaySky(2026, 3, 25).sign).toBe("양자리");
    expect(birthdaySky(2026, 4, 25).sign).toBe("황소자리");
  });

  it("지금은 두 기준이 한 별자리쯤(약 30°) 어긋나 있다", () => {
    expect(birthdaySky(2026, 1, 1).precessionDeg).toBeGreaterThan(28);
    expect(birthdaySky(2026, 1, 1).precessionDeg).toBeLessThan(32);
  });
});

describe("띠 모양 천문도 투영", () => {
  it("가운데 황경은 화면 가운데, 동쪽(황경이 큰 쪽)은 왼쪽", () => {
    const P = chartProjection(1400, 600, 120);

    expect(P.x(P.dLon(120))).toBeCloseTo(700);
    expect(P.y(0)).toBeCloseTo(300);
    expect(P.x(P.dLon(130))).toBeLessThan(700);
    // 한 바퀴 경계를 넘어도 가까운 쪽으로 잰다
    expect(P.dLon(-170 + 360 * 2)).toBeCloseTo(-290 + 360);
  });

  it("높이 600이면 황위 ±38°가 들어오고, 아주 넓은 화면은 황도 한 바퀴로 꽉 찬다", () => {
    const P = chartProjection(1400, 600, 0);

    expect(P.y(38)).toBeCloseTo(0, 0);
    expect(chartProjection(5000, 600, 0).spanDeg).toBeCloseTo(360);
  });
});
