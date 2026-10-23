import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  COMETS,
  cometHeliocentric,
  cometPosition,
} from "@/game/wanderers/comets";
import {
  angleDeg,
  DIRECTION_OPTIONS,
  eclipticMotionDeg,
  elongationDeg,
  findOpposition,
  isHit,
  makeWanderGame,
  planetMagnitude,
  projectField,
  ROUNDS,
  scoreRound,
  sunScreenAngleDeg,
  WANDER_SETTINGS,
} from "@/game/wanderers/wanderers";
import { constellationAt } from "@/search/utils/constellationBounds";
import { julianDay } from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";

const D = Math.PI / 180;

const fromRaDec = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

const jdOf = (s: string) => julianDay(new Date(`${s}T00:00:00Z`));
const comet = (id: string) => COMETS.find((c) => c.id === id)!;

// NASA/JPL Horizons에서 2026-10-23에 받은 지구 중심 천체력 (0시 UT, 적경·적위는 J2000 astrometric,
// r: 해까지 거리, Δ: 지구까지 거리, 별자리는 Horizons가 붙인 IAU 별자리). 궤도 요소와 따로 받은 값이다.
const HORIZONS: [string, string, number, number, number, number, string][] = [
  [
    "halley-1986",
    "1985-12-15",
    349.604739822,
    3.896415998,
    1.26931,
    0.82166,
    "물고기자리",
  ],
  [
    "halley-1986",
    "1986-03-15",
    300.218045999,
    -22.457366317,
    0.91713,
    0.93724,
    "궁수자리",
  ],
  [
    "halley-1986",
    "1986-04-11",
    224.697799509,
    -47.214056278,
    1.33199,
    0.41723,
    "이리자리",
  ],
  [
    "halley-1986",
    "1986-05-10",
    159.358898187,
    -12.664090459,
    1.76466,
    1.08181,
    "바다뱀자리",
  ],
  [
    "hyakutake-1996",
    "1996-03-10",
    223.721340532,
    -18.92290524,
    1.34789,
    0.51952,
    "천칭자리",
  ],
  [
    "hyakutake-1996",
    "1996-03-25",
    218.725443128,
    53.963404292,
    1.04818,
    0.1022,
    "목동자리",
  ],
  [
    "hyakutake-1996",
    "1996-04-10",
    45.614652008,
    40.550306539,
    0.69042,
    0.52628,
    "페르세우스자리",
  ],
  [
    "hyakutake-1996",
    "1996-04-28",
    38.660028488,
    26.784480137,
    0.25989,
    1.11199,
    "양자리",
  ],
  [
    "hale-bopp-1997",
    "1997-01-20",
    288.648816057,
    10.436424395,
    1.51415,
    2.23594,
    "독수리자리",
  ],
  [
    "hale-bopp-1997",
    "1997-03-22",
    2.245303089,
    45.550289547,
    0.93205,
    1.31529,
    "안드로메다자리",
  ],
  [
    "hale-bopp-1997",
    "1997-04-10",
    44.986118602,
    39.920484948,
    0.92786,
    1.44199,
    "페르세우스자리",
  ],
  [
    "hale-bopp-1997",
    "1997-05-10",
    76.824919082,
    20.733504949,
    1.14103,
    1.92436,
    "황소자리",
  ],
  [
    "mcnaught-2007",
    "2007-01-08",
    289.283829265,
    -8.39018315,
    0.25664,
    1.05252,
    "독수리자리",
  ],
  [
    "mcnaught-2007",
    "2007-01-20",
    308.673674334,
    -38.293797082,
    0.32569,
    0.87485,
    "현미경자리",
  ],
  [
    "mcnaught-2007",
    "2007-02-05",
    320.453878375,
    -54.723406582,
    0.76061,
    1.21695,
    "인디언자리",
  ],
  [
    "neowise-2020",
    "2020-07-08",
    94.569462121,
    37.305175031,
    0.32434,
    0.99966,
    "마차부자리",
  ],
  [
    "neowise-2020",
    "2020-07-15",
    115.384311813,
    46.656276754,
    0.45185,
    0.78722,
    "살쾡이자리",
  ],
  [
    "neowise-2020",
    "2020-07-23",
    156.760706665,
    44.737777956,
    0.62907,
    0.69185,
    "큰곰자리",
  ],
  [
    "neowise-2020",
    "2020-08-05",
    195.505521552,
    20.725999329,
    0.91141,
    0.88539,
    "머리털자리",
  ],
  [
    "tsuchinshan-atlas-2024",
    "2024-10-02",
    167.8461809,
    -5.587262837,
    0.40841,
    0.72617,
    "사자자리",
  ],
  [
    "tsuchinshan-atlas-2024",
    "2024-10-12",
    208.214625367,
    -1.470729571,
    0.54494,
    0.47344,
    "처녀자리",
  ],
  [
    "tsuchinshan-atlas-2024",
    "2024-10-20",
    246.124941022,
    2.314818019,
    0.69389,
    0.58628,
    "뱀주인자리",
  ],
  [
    "tsuchinshan-atlas-2024",
    "2024-11-05",
    273.77783691,
    3.848220049,
    1.00267,
    1.11716,
    "뱀주인자리",
  ],
];

describe("혜성 위치 (JPL Horizons 천체력과 비교)", () => {
  it.each(HORIZONS)("%s %s", (id, date, ra, dec, r, delta, constellation) => {
    const p = cometPosition(comet(id), jdOf(date));
    // 지구에 0.1au까지 다가온 햐쿠타케는 지구 위치 근사의 오차가 크게 보인다
    const tolerance = delta < 0.2 ? 0.15 : 0.05;

    expect(angleDeg(p.vector, fromRaDec(ra, dec))).toBeLessThan(tolerance);
    expect(Math.abs(p.sunDistanceAu - r)).toBeLessThan(0.001);
    expect(Math.abs(p.distanceAu - delta)).toBeLessThan(0.001);
    expect(constellationAt(p.vector)).toBe(constellation);
  });

  it.each(COMETS.map((c) => [c.id, c.perihelionDate, c.q] as const))(
    "%s: 알려진 근일점 날짜(%s)에 해와 가장 가깝다",
    (id, date, q) => {
      const c = comet(id);
      const r = (jd: number) => Math.hypot(...cometHeliocentric(c, jd));
      const jd = jdOf(date) + 0.5;

      expect(Math.abs(r(jd) - q)).toBeLessThan(0.002);
      expect(r(jd - 3)).toBeGreaterThan(r(jd));
      expect(r(jd + 3)).toBeGreaterThan(r(jd));
    },
  );
});

describe("행성 밝기", () => {
  it.each([
    ["Jupiter", "2022-09-26", -2.9], // 충
    ["Mars", "2020-10-13", -2.6], // 충
    ["Saturn", "2019-07-09", 0.1], // 충, 고리가 크게 열림
    ["Saturn", "2025-09-21", 0.6], // 충, 고리가 거의 옆면
  ] as const)("%s %s ≈ %s등급", (name, date, mag) => {
    expect(Math.abs(planetMagnitude(name, jdOf(date)) - mag)).toBeLessThan(0.3);
  });

  it("금성은 늘 -3.5등급보다 밝고, 천왕성은 5.3~6등급", () => {
    for (let jd = jdOf("2020-01-01"); jd < jdOf("2024-01-01"); jd += 37) {
      if (elongationDeg(planetPosition("Venus", jd).vector, jd) > 15) {
        expect(planetMagnitude("Venus", jd)).toBeLessThan(-3.5);
      }

      const u = planetMagnitude("Uranus", jd);
      expect(u).toBeGreaterThan(5.3);
      expect(u).toBeLessThan(6);
    }
  });
});

describe("역행", () => {
  it("2020년 화성: 9월 9일 무렵 멈춰 거꾸로 가다가 11월 14일 무렵 다시 앞으로", () => {
    const at = (d: string) => planetPosition("Mars", jdOf(d)).vector;

    expect(
      eclipticMotionDeg(at("2020-08-01"), at("2020-08-20")),
    ).toBeGreaterThan(0);
    expect(eclipticMotionDeg(at("2020-09-20"), at("2020-11-05"))).toBeLessThan(
      0,
    );
    expect(
      eclipticMotionDeg(at("2020-11-25"), at("2020-12-15")),
    ).toBeGreaterThan(0);
  });

  it("충 찾기: 2020년 화성 충은 10월 13~14일", () => {
    const opp = findOpposition("Mars", new Date("2020-01-01T12:00:00Z"));

    expect(opp.toISOString().slice(0, 10) >= "2020-10-12").toBe(true);
    expect(opp.toISOString().slice(0, 10) <= "2020-10-15").toBe(true);
  });
});

describe("별 지도 투영", () => {
  const view = {
    center: fromRaDec(100, 20),
    fovDeg: 40,
    width: 800,
    height: 800,
  };

  it("가운데는 가운데로, 북쪽은 위로, 동쪽(적경이 큰 쪽)은 왼쪽으로", () => {
    const c = projectField(view, view.center)!;
    const n = projectField(view, fromRaDec(100, 25))!;
    const e = projectField(view, fromRaDec(105, 20))!;

    expect(c[0]).toBeCloseTo(400, 6);
    expect(c[1]).toBeCloseTo(400, 6);
    expect(n[1]).toBeLessThan(400);
    expect(Math.abs(n[0] - 400)).toBeLessThan(1e-6);
    expect(e[0]).toBeLessThan(400);
  });

  it("시야 가장자리(20°)가 화면 끝에 온다", () => {
    const edge = projectField(view, fromRaDec(100, 40))!;

    expect(edge[1]).toBeCloseTo(0, 3);
  });

  it("뒤쪽 하늘은 그리지 않는다", () => {
    expect(projectField(view, fromRaDec(280, -20))).toBeNull();
  });
});

describe("문제 만들기", () => {
  const difficulties = ["intro", "easy", "normal", "hard"] as const;

  it.each(difficulties)(
    "%s: 다섯 문제, 모든 장의 떠돌이별이 지도 안에",
    (d) => {
      for (const seed of [1, 7, 42]) {
        const game = makeWanderGame(seed, d);

        expect(game).toHaveLength(ROUNDS);

        for (const p of game) {
          expect(p.frames.length).toBeGreaterThanOrEqual(4);

          for (const f of p.frames) {
            const xy = projectField(p.view, f.target)!;

            expect(xy).not.toBeNull();
            expect(xy[0]).toBeGreaterThan(0);
            expect(xy[0]).toBeLessThan(p.view.width);
            expect(xy[1]).toBeGreaterThan(0);
            expect(xy[1]).toBeLessThan(p.view.height);
          }

          // 장마다 눈에 띄게 움직인다 (지도에서 몇 픽셀 넘게)
          const moved = p.frames.slice(1).map((f, k) => {
            const a = projectField(p.view, p.frames[k].target)!;
            const b = projectField(p.view, f.target)!;

            return Math.hypot(a[0] - b[0], a[1] - b[1]);
          });

          expect(Math.max(...moved)).toBeGreaterThan(15);
        }
      }
    },
  );

  it("같은 시드면 같은 문제", () => {
    const a = makeWanderGame(5, "hard");
    const b = makeWanderGame(5, "hard");

    expect(a.map((p) => p.frames[0].date.getTime())).toEqual(
      b.map((p) => p.frames[0].date.getTime()),
    );
  });

  it("입문은 밝은 행성(1.2등급보다 밝은)만, 밤하늘에서 보이는 곳에", () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const p of makeWanderGame(seed, "intro")) {
        expect(p.kind).toBe("planet");
        expect(p.targetMag).toBeLessThanOrEqual(WANDER_SETTINGS.intro.maxMag);

        for (const f of p.frames) {
          expect(elongationDeg(f.target, julianDay(f.date))).toBeGreaterThan(
            20,
          );
        }
      }
    }
  });

  it("어려움: 역행 문제의 보너스 정답이 실제 황경 변화와 맞는다", () => {
    for (const seed of [1, 2, 3, 11]) {
      const game = makeWanderGame(seed, "hard");
      const retro = game.filter((p) => p.kind === "retro");

      expect(retro.length).toBeGreaterThan(0);

      for (const p of retro) {
        const b = p.bonus!;
        const d = eclipticMotionDeg(
          p.frames[b.frameIndex].target,
          p.frames[b.frameIndex + 1].target,
        );

        expect(b.options).toEqual(DIRECTION_OPTIONS);
        expect(b.answer).toBe(d > 0 ? 0 : 1);
        // 충은 해의 거의 정반대
        const jd = julianDay(p.oppositionDate!);
        expect(
          elongationDeg(planetPosition(p.planet!, jd).vector, jd),
        ).toBeGreaterThan(160);
      }
    }
  });

  it("어려움: 혜성은 서로 다른 혜성, 게임 기간 안, 해의 방향 보너스가 맞는다", () => {
    for (const seed of [1, 2, 3, 11]) {
      const comets = makeWanderGame(seed, "hard").filter(
        (p) => p.kind === "comet",
      );

      expect(comets).toHaveLength(2);
      expect(comets[0].comet!.id).not.toBe(comets[1].comet!.id);

      for (const p of comets) {
        const c = p.comet!;

        for (const f of p.frames) {
          const day = f.date.toISOString().slice(0, 10);
          expect(day >= c.from && day <= c.to).toBe(true);
          expect(elongationDeg(f.target, julianDay(f.date))).toBeGreaterThan(
            25,
          );
        }

        if (p.bonus) {
          const f = p.frames[p.bonus.frameIndex];
          const a = sunScreenAngleDeg(p.view, f.target, julianDay(f.date))!;
          const off = Math.abs(((a - p.bonus.answer * 90 + 540) % 360) - 180);

          expect(off).toBeLessThan(45);

          // 꼬리는 해 반대쪽: 꼬리 끝은 해 방향과 반대 사분면
          const head = projectField(p.view, f.target)!;
          const tail = projectField(p.view, f.tail!)!;
          const tailAngle =
            (Math.atan2(tail[0] - head[0], -(tail[1] - head[1])) / D + 360) %
            360;
          const opposite = Math.abs(((tailAngle - a + 540) % 360) - 180);

          expect(opposite).toBeGreaterThan(150);
        }
      }
    }
  });
});

describe("채점", () => {
  const p = makeWanderGame(3, "intro")[0];
  const xy = projectField(p.view, p.frames[1].target)!;

  it("그 장의 떠돌이별 자리를 누르면 맞다, 다른 장의 자리는 틀리다", () => {
    expect(isHit(p, 1, xy, 20)).toBe(true);
    expect(isHit(p, 1, [xy[0] + 30, xy[1]], 20)).toBe(false);

    const other = projectField(p.view, p.frames[3].target)!;
    expect(isHit(p, 1, other, 20)).toBe(false);
  });

  it("점수: 틀림·힌트는 깎고, 찾으면 200점은 남고, 보너스는 더한다", () => {
    const base = {
      found: true,
      wrongTaps: 0,
      usedHint: false,
      bonusCorrect: false,
    };

    expect(scoreRound(base)).toBe(1000);
    expect(scoreRound({ ...base, wrongTaps: 2 })).toBe(600);
    expect(scoreRound({ ...base, usedHint: true })).toBe(700);
    expect(scoreRound({ ...base, wrongTaps: 9, usedHint: true })).toBe(200);
    expect(scoreRound({ ...base, bonusCorrect: true })).toBe(1300);
    expect(scoreRound({ ...base, found: false, bonusCorrect: true })).toBe(300);
    expect(scoreRound({ ...base, found: false })).toBe(0);
  });
});
