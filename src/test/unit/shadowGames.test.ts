import { describe, expect, it } from "vitest";
import {
  circumferenceKm,
  CITY_PAIRS,
  EARTH_MERIDIAN_KM,
  noonShadowAngleDeg,
  northSouthKm,
} from "@/game/eratosthenes/eratosthenes";
import {
  explainShadow,
  makeShadowProblem,
  scoreShadow,
  SHADOW_SETTINGS,
} from "@/game/shadow/problem";
import {
  altitudeFromShadow,
  dayDate,
  dayLight,
  dayOf,
  noonAltitudeDeg,
  shadowCurve,
  shadowOf,
  sunAt,
  sunDeclinationDeg,
  twinDay,
} from "@/game/shadow/shadow";

// 그림자 시계·에라토스테네스: 그림자 계산이 교과서 공식과 맞는지, 문제가 읽기 좋은 범위인지, 점수와 풀이 설명.

const D = Math.PI / 180;

// 교과서 공식: sin(고도) = sin φ sin δ + cos φ cos δ cos H
const altitudeByFormula = (lat: number, dec: number, hours: number) =>
  Math.asin(
    Math.sin(lat * D) * Math.sin(dec * D) +
      Math.cos(lat * D) * Math.cos(dec * D) * Math.cos((hours - 12) * 15 * D),
  ) / D;

describe("해 위치와 그림자", () => {
  it("하지·동지·춘분의 적위", () => {
    expect(sunDeclinationDeg(dayDate(dayOf(6, 21)))).toBeCloseTo(23.44, 1);
    expect(sunDeclinationDeg(dayDate(dayOf(12, 21)))).toBeCloseTo(-23.44, 1);
    expect(Math.abs(sunDeclinationDeg(dayDate(dayOf(3, 20))))).toBeLessThan(
      0.5,
    );
  });

  it.each([
    [37.5, dayOf(6, 21), 9.5],
    [-33.9, dayOf(1, 10), 15],
    [60, dayOf(3, 20), 12],
    [0, dayOf(9, 1), 7.25],
  ])("위도 %f, %i번째 날, %f시: 공식과 0.1° 안", (lat, day, hours) => {
    // 경도 0에서는 해시계 시각 ≈ UTC (균시차 몇 분만큼 다르다)
    const dec = sunDeclinationDeg(dayDate(day, hours));
    const sun = sunAt(lat, day, hours);

    expect(
      Math.abs(sun.altDeg - altitudeByFormula(lat, dec, hours)),
    ).toBeLessThan(0.1);
  });

  it("해시계 12시에는 해가 정남(남반구는 정북), 높이 90° − |위도 − 적위|", () => {
    const day = dayOf(10, 5);
    const dec = sunDeclinationDeg(dayDate(day));
    const seoul = sunAt(37.5, day, 12);
    const sydney = sunAt(-33.9, day, 12);

    expect(Math.abs(seoul.azDeg - 180)).toBeLessThan(0.5);
    expect(Math.min(sydney.azDeg, 360 - sydney.azDeg)).toBeLessThan(0.5);
    expect(seoul.altDeg).toBeCloseTo(noonAltitudeDeg(37.5, dec), 1);
  });

  it("그림자는 해의 반대쪽, 길이는 1/tan(높이), 길이로 높이를 되찾는다", () => {
    const s = shadowOf({ altDeg: 45, azDeg: 135 })!;

    expect(s.length).toBeCloseTo(1, 6);
    expect(s.azDeg).toBeCloseTo(315, 6);
    expect(s.x).toBeLessThan(0); // 서쪽
    expect(s.y).toBeGreaterThan(0); // 북쪽
    expect(
      altitudeFromShadow(shadowOf({ altDeg: 30, azDeg: 180 })!.length),
    ).toBeCloseTo(30, 6);
    expect(shadowOf({ altDeg: -1, azDeg: 90 })).toBeNull();
  });

  it("낮 길이: 춘분은 어디나 12시간, 서울 하지는 14시간 넘게", () => {
    expect(dayLight(37.5, 0).hours).toBeCloseTo(12, 6);
    expect(dayLight(37.5, 23.44).hours).toBeGreaterThan(14);
    expect(dayLight(70, 23.44).hours).toBe(24);
  });

  it("그림자 끝 곡선: 북반구에서 오전엔 서쪽, 오후엔 동쪽, 정오에 가장 짧다", () => {
    const curve = shadowCurve(37.5, dayOf(6, 21), 1);
    const noon = curve.find((p) => Math.abs(p.hours - 12) < 1e-9)!;

    expect(curve.find((p) => p.hours === 9)!.shadow.x).toBeLessThan(0);
    expect(curve.find((p) => p.hours === 15)!.shadow.x).toBeGreaterThan(0);
    expect(Math.min(...curve.map((p) => p.shadow.length))).toBeCloseTo(
      noon.shadow.length,
      6,
    );
  });

  it("봄·가을의 짝 날짜는 적위가 같다", () => {
    const twin = twinDay(dayOf(4, 16))!;

    expect(twin).not.toBeNull();
    expect(
      Math.abs(
        sunDeclinationDeg(dayDate(twin)) -
          sunDeclinationDeg(dayDate(dayOf(4, 16))),
      ),
    ).toBeLessThan(0.4);
    expect(twinDay(dayOf(6, 21))).toBeNull();
  });
});

describe("그림자 시계 문제", () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

  it.each(["intro", "easy", "normal"] as const)(
    "%s: 그림자가 읽기 좋은 범위",
    (difficulty) => {
      for (const seed of SEEDS) {
        const p = makeShadowProblem(seed, difficulty);

        expect(p.noonSun.altDeg).toBeGreaterThanOrEqual(15);
        expect(p.noonSun.altDeg).toBeLessThanOrEqual(86);
        expect(p.sun.altDeg).toBeGreaterThanOrEqual(14);
        expect(Math.abs(p.solarHours - 12)).toBeGreaterThanOrEqual(0.5);
        expect(p.shadow.length).toBeLessThan(4.1);
        // 정오 그림자가 지금 그림자보다 짧다
        expect(p.noonShadow.length).toBeLessThan(p.shadow.length);
      }
    },
  );

  it("같은 시드는 같은 문제", () => {
    expect(makeShadowProblem(42, "easy")).toEqual(
      makeShadowProblem(42, "easy"),
    );
  });

  it("정답은 만점, 멀수록 점수가 준다, 힌트는 깎는다", () => {
    const p = makeShadowProblem(7, "easy");
    const exact = { latDeg: p.latDeg, day: p.day, solarHours: p.solarHours };

    expect(scoreShadow(p, exact).total).toBe(1000);
    expect(
      scoreShadow(p, { ...exact, latDeg: p.latDeg + 10 }).total,
    ).toBeLessThan(900);
    expect(scoreShadow(p, exact, 0.25).total).toBe(750);
  });

  it("입문은 날짜를 알려 주니 계절 점수는 늘 만점", () => {
    const p = makeShadowProblem(11, "intro");

    expect(SHADOW_SETTINGS.intro.dateGiven).toBe(true);
    expect(
      scoreShadow(p, {
        latDeg: p.latDeg,
        day: (p.day + 180) % 365,
        solarHours: p.solarHours,
      }).season,
    ).toBe(300);
  });

  it("풀이 설명: 정오 그림자로 구한 |위도 − 적위|와 그림자 방향", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const p = makeShadowProblem(seed, "normal");
      const ex = explainShadow(p);

      expect(ex.zenithGapDeg).toBeCloseTo(Math.abs(p.latDeg - p.decDeg), 0);
      expect(ex.noonPointsNorth).toBe(p.latDeg > p.decDeg);

      // 북반구 오전엔 그림자가 정오 그림자보다 왼쪽(반시계)에 있다
      if (p.latDeg > p.decDeg) {
        expect(ex.turnDeg < 0).toBe(ex.morning);
      } else {
        expect(ex.turnDeg > 0).toBe(ex.morning);
      }
    }
  });
});

describe("에라토스테네스", () => {
  it("하지 정오 시에네는 그림자가 거의 없고, 알렉산드리아는 약 7°", () => {
    const [egypt] = CITY_PAIRS;
    const day = dayOf(6, 21);

    expect(Math.abs(noonShadowAngleDeg(egypt.b, day))).toBeLessThan(1);
    expect(noonShadowAngleDeg(egypt.a, day)).toBeCloseTo(7.8, 0);
  });

  it("기원전 240년의 해(자전축 23.72°)로 재면 알렉산드리아 약 7.5°, 시에네 약 0.4°", () => {
    const [egypt] = CITY_PAIRS;
    const day = dayOf(6, 21);
    const then = egypt.obliquityDeg;

    expect(then).toBeCloseTo(23.72, 2);
    expect(noonShadowAngleDeg(egypt.a, day, then)).toBeCloseTo(7.48, 1);
    expect(noonShadowAngleDeg(egypt.b, day, then)).toBeCloseTo(0.37, 1);
    // 두 각의 차이(위도 차이)는 기울기와 상관없다
    expect(
      noonShadowAngleDeg(egypt.a, day, then) -
        noonShadowAngleDeg(egypt.b, day, then),
    ).toBeCloseTo(egypt.a.latDeg - egypt.b.latDeg, 5);
    // 기울기가 같으면 지금 해와 같다
    expect(noonShadowAngleDeg(egypt.a, 100, 23.436)).toBeCloseTo(
      noonShadowAngleDeg(egypt.a, 100),
      6,
    );
  });

  it("날짜를 바꿔도 각도 차이는 위도 차이 그대로 (같은 경도에 가까운 두 도시)", () => {
    const korea = CITY_PAIRS.find((p) => p.id === "korea")!;
    const diffs = [dayOf(3, 20), dayOf(6, 21), dayOf(12, 21)].map(
      (d) => noonShadowAngleDeg(korea.a, d) - noonShadowAngleDeg(korea.b, d),
    );

    for (const d of diffs) {
      expect(d).toBeCloseTo(korea.a.latDeg - korea.b.latDeg, 1);
    }
  });

  it("각도 차이와 남북 거리로 구한 둘레가 실제 둘레", () => {
    for (const pair of CITY_PAIRS) {
      const diff = Math.abs(
        noonShadowAngleDeg(pair.a, 100) - noonShadowAngleDeg(pair.b, 100),
      );

      expect(
        Math.abs(
          circumferenceKm(diff, northSouthKm(pair.a, pair.b)) -
            EARTH_MERIDIAN_KM,
        ) / EARTH_MERIDIAN_KM,
      ).toBeLessThan(0.01);
    }

    expect(circumferenceKm(0, 500)).toBe(Infinity);
  });
});
