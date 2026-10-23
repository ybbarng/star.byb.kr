import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { altAzAt } from "@/game/latitudeTrip/trip";
import {
  altOfEnu,
  angleBetweenDeg,
  azOfEnu,
  enuOf,
  explainTrails,
  facingOf,
  makeTrailProblem,
  pixelToEnu,
  projectEnu,
  roundMax,
  scoreTrails,
  SIDEREAL_DEG_PER_HOUR,
  starEnu,
  TRAIL_SETTINGS,
  trailsOf,
  visiblePole,
} from "@/game/starTrails/trails";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";

// 별 궤적 풀기: 카메라 투영이 되돌려지는지, 궤적이 정말 극을 중심으로 15°/시간씩 도는지,
// 문제가 난이도 규칙(밤, 지평선, 극 자리)을 지키는지, 점수와 풀이 설명.

const D = Math.PI / 180;

const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

describe("하늘·카메라 계산", () => {
  it("별의 고도·방위가 극지방·적도 여행(altAzAt)과 같다", () => {
    for (const [dec, ha, lat] of [
      [20, 30, 37],
      [-50, 200, -33],
      [80, 120, 60],
      [0, 270, 0],
    ]) {
      const v = starEnu(dec, ha, lat);
      const ref = altAzAt(dec, ha, lat);

      expect(altOfEnu(v)).toBeCloseTo(ref.altDeg, 9);

      if (ref.altDeg < 89) {
        expect(azOfEnu(v)).toBeCloseTo(ref.azDeg, 9);
      }
    }
  });

  it("보이는 극의 높이는 위도의 크기이고, 북반구는 정북·남반구는 정남에 있다", () => {
    expect(altOfEnu(visiblePole(37))).toBeCloseTo(37, 9);
    expect(azOfEnu(visiblePole(37))).toBeCloseTo(0, 9);
    expect(altOfEnu(visiblePole(-34))).toBeCloseTo(34, 9);
    expect(azOfEnu(visiblePole(-34))).toBeCloseTo(180, 9);
  });

  it("사진 좌표로 투영했다가 되돌리면 같은 방향이다 (사진 밖 여백도)", () => {
    const view = { azDeg: 20, altDeg: 25, fovDeg: 80 };

    for (const [alt, az] of [
      [30, 10],
      [5, 60],
      [70, 340],
      [40, -40],
    ]) {
      const v = enuOf(alt, az);
      const p = projectEnu(view, 1200, 800, v)!;

      expect(angleBetweenDeg(pixelToEnu(view, 1200, 800, p), v)).toBeLessThan(
        1e-5,
      );
    }

    // 광축은 사진 한가운데, 같은 방위의 지평선은 그 바로 아래
    expect(projectEnu(view, 1200, 800, enuOf(25, 20))![0]).toBeCloseTo(600, 6);
    expect(projectEnu(view, 1200, 800, enuOf(0, 20))![0]).toBeCloseTo(600, 6);
    expect(projectEnu(view, 1200, 800, enuOf(0, 20))![1]).toBeGreaterThan(400);
    // 오른쪽은 방위가 큰 쪽 (북쪽을 보면 오른쪽이 동쪽)
    expect(projectEnu(view, 1200, 800, enuOf(25, 40))![0]).toBeGreaterThan(600);
  });

  it("방위를 가장 가까운 동서남북으로", () => {
    expect(facingOf(10)).toBe("north");
    expect(facingOf(350)).toBe("north");
    expect(facingOf(95)).toBe("east");
    expect(facingOf(170)).toBe("south");
    expect(facingOf(-80)).toBe("west");
  });
});

describe("궤적", () => {
  it.each([
    [3, "intro"],
    [8, "normal"],
  ] as const)(
    "시드 %i (%s): 궤적의 모든 점이 극에서 같은 거리, 처음과 끝이 극을 노출 시간 × 15.04°만큼 돈다",
    (seed, difficulty) => {
      const p = makeTrailProblem(seed, difficulty);
      const trails = trailsOf(p, 3.5);

      expect(trails.length).toBeGreaterThan(5);

      for (const t of trails.slice(0, 15)) {
        for (const line of t.lines) {
          const dirs = line.points.map((q) =>
            pixelToEnu(p.view, p.width, p.height, q),
          );
          const radius = angleBetweenDeg(dirs[0], p.pole);
          // 보이는 극에서의 거리 = 90° ∓ 적위
          const expected =
            p.observer.latDeg >= 0 ? 90 - t.decDeg : 90 + t.decDeg;

          expect(radius).toBeCloseTo(expected, 6);

          for (const v of dirs) {
            expect(angleBetweenDeg(v, p.pole)).toBeCloseTo(radius, 6);
          }
        }
      }

      // 끊기지 않은 궤적 하나로 도는 각을 잰다: 극에 수직인 평면에 내려 사잇각
      const whole = trails.find(
        (t) =>
          t.lines.length === 1 &&
          t.lines[0].points.length ===
            Math.max(
              2,
              Math.ceil((p.exposureHours * SIDEREAL_DEG_PER_HOUR) / 0.5),
            ) +
              1,
      )!;

      expect(whole).toBeDefined();

      const pts = whole.lines[0].points;
      const a = pixelToEnu(p.view, p.width, p.height, pts[0]);
      const b = pixelToEnu(p.view, p.width, p.height, pts[pts.length - 1]);

      const flat = (v: Point3D): Point3D => {
        const k = v[0] * p.pole[0] + v[1] * p.pole[1] + v[2] * p.pole[2];

        return [
          v[0] - k * p.pole[0],
          v[1] - k * p.pole[1],
          v[2] - k * p.pole[2],
        ];
      };

      const fa = flat(a);
      const fb = flat(b);
      const c = cross(fa, fb);
      const turn =
        Math.atan2(
          Math.hypot(c[0], c[1], c[2]),
          fa[0] * fb[0] + fa[1] * fb[1] + fa[2] * fb[2],
        ) / D;

      expect(turn).toBeCloseTo(p.exposureHours * SIDEREAL_DEG_PER_HOUR, 4);
    },
  );
});

describe("문제 만들기", () => {
  it("같은 시드면 같은 문제다", () => {
    const a = makeTrailProblem(42, "normal");
    const b = makeTrailProblem(42, "normal");

    expect(a.date.getTime()).toBe(b.date.getTime());
    expect(a.view).toEqual(b.view);
    expect(a.exposureHours).toBe(b.exposureHours);
  });

  it.each([1, 2, 3, 4])(
    "시드 %i: 난이도마다 노출 내내 밤, 지평선이 사진 아래쪽, 극 자리 규칙",
    (seed) => {
      for (const difficulty of ["intro", "easy", "normal", "hard"] as const) {
        const p = makeTrailProblem(seed, difficulty);
        const lat = p.observer.latDeg;

        for (const h of [0, p.exposureHours]) {
          const date = new Date(p.date.getTime() + h * 3600000);
          const jd = julianDay(date);

          expect(altAzOf(sunVector(jd), jd, p.observer).altDeg).toBeLessThan(
            -15,
          );
        }

        const horizon = projectEnu(
          p.view,
          p.width,
          p.height,
          enuOf(0, p.view.azDeg),
        )!;

        expect(horizon[1]).toBeGreaterThan(p.height * 0.6);
        expect(horizon[1]).toBeLessThanOrEqual(p.height * 1.15);
        expect(p.exposureHours).toBeGreaterThanOrEqual(0.5);
        expect(p.exposureHours * 4).toBe(Math.round(p.exposureHours * 4));

        if (difficulty === "intro" || difficulty === "easy") {
          // 북반구, 극이 사진 안
          expect(lat).toBeGreaterThan(0);
          expect(p.askPole).toBe(true);
          expect(p.polePx![0]).toBeGreaterThan(0);
          expect(p.polePx![0]).toBeLessThan(p.width);
          expect(p.polePx![1]).toBeGreaterThan(0);
          expect(p.polePx![1]).toBeLessThan(p.height * 0.8);
        }

        if (difficulty === "normal") {
          // 극을 늘 찍을 수 있다 (사진 밖이면 여백 안)
          expect(p.askPole).toBe(true);
          expect(Math.abs(p.polePx![0] - p.width / 2)).toBeLessThan(
            p.width / 2 + p.marginPx,
          );
          expect(Math.abs(p.polePx![1] - p.height / 2)).toBeLessThan(
            p.height / 2 + p.marginPx,
          );
        }

        if (difficulty === "hard") {
          expect(Math.abs(lat)).toBeLessThanOrEqual(32);
          // 광축은 동서남북 중 하나에서 12° 안
          const off = Math.abs(((p.view.azDeg + 45) % 90) - 45);
          expect(off).toBeLessThanOrEqual(12.0001);
        }

        expect(p.facing).toBe(facingOf(p.view.azDeg));
      }
    },
  );

  it("보통에는 남반구 문제와 극이 사진 밖인 문제가 섞인다", () => {
    const ps = Array.from({ length: 12 }, (_, i) =>
      makeTrailProblem(100 + i, "normal"),
    );

    expect(ps.some((p) => p.observer.latDeg < 0)).toBe(true);
    expect(ps.some((p) => p.observer.latDeg > 0)).toBe(true);
    expect(
      ps.some(
        (p) =>
          p.polePx![0] < 0 ||
          p.polePx![0] > p.width ||
          p.polePx![1] < 0 ||
          p.polePx![1] > p.height,
      ),
    ).toBe(true);
  });
});

describe("점수와 풀이", () => {
  it("정답을 그대로 내면 만점, 반구를 틀리면 위도 점수가 거의 없다", () => {
    const p = makeTrailProblem(7, "normal");
    const perfect = scoreTrails(p, {
      polePx: p.polePx,
      latDeg: p.observer.latDeg,
      hours: p.exposureHours,
      facing: null,
    });

    expect(perfect.poleErrDeg).toBeLessThan(1e-6);
    expect(perfect.total).toBe(perfect.max);
    expect(perfect.max).toBe(roundMax(p));

    const flipped = scoreTrails(p, {
      polePx: p.polePx,
      latDeg: -p.observer.latDeg,
      hours: p.exposureHours + 1,
      facing: null,
    });

    expect(flipped.lat).toBeLessThan(20);
    expect(flipped.arcErrDeg).toBeCloseTo(15, 9);
    expect(flipped.hours).toBeLessThan(perfect.hours);
    expect(
      scoreTrails(p, {
        polePx: null,
        latDeg: p.observer.latDeg,
        hours: p.exposureHours,
        facing: null,
      }).pole,
    ).toBe(0);
  });

  it("어려움은 방향을 묻고, 맞히면 300점", () => {
    const p = makeTrailProblem(5, "hard");

    expect(TRAIL_SETTINGS.hard.askFacing).toBe(true);

    const g = {
      polePx: p.polePx,
      latDeg: p.observer.latDeg,
      hours: p.exposureHours,
    };

    expect(scoreTrails(p, { ...g, facing: p.facing }).facing).toBe(300);
    expect(
      scoreTrails(p, { ...g, facing: p.facing === "east" ? "west" : "east" })
        .facing,
    ).toBe(0);
  });

  it("풀이 설명: 극 높이 = 위도, 호의 각 = 노출 시간 × 15.04°, 보여 줄 궤적이 사진 안", () => {
    const p = makeTrailProblem(11, "intro");
    const ex = explainTrails(p);

    expect(ex.poleAltDeg).toBe(Math.abs(p.observer.latDeg));
    expect(ex.north).toBe(true);
    expect(ex.arcDeg).toBeCloseTo(p.exposureHours * 15.04, 1);
    expect(ex.risingAngleDeg).toBe(90 - p.observer.latDeg);
    expect(ex.sample).not.toBeNull();

    for (const q of [ex.sample!.start, ex.sample!.end]) {
      expect(q[0]).toBeGreaterThan(0);
      expect(q[0]).toBeLessThan(p.width);
      expect(q[1]).toBeGreaterThan(0);
      expect(q[1]).toBeLessThan(p.height);
    }
  });
});
