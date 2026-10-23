import { describe, expect, it } from "vitest";
import {
  altAzInFrame,
  angleBetweenDeg,
  brightStarsInPhoto,
  diagonalHalfDeg,
  directionLabel,
  makeWhichWayRound,
  PHOTO_H,
  PHOTO_POINTS,
  PHOTO_W,
  photoAim,
  photoOutline,
  photoToSkyFn,
  pointsFor,
  roundFrame,
  scoreRound,
  WHICH_WAY_SETTINGS,
} from "@/game/whichWay/problem";
import {
  affineFromTriangles,
  altAzToMap,
  mapRadius,
  mapToAltAz,
  panoXY,
  vecToMap,
} from "@/game/whichWay/skyMap";
import {
  altAzOf,
  fromAltAzJ2000,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";

// 어느 쪽을 찍었을까: 문제(같은 밤·같은 곳의 사진 여러 장)가 풀 만한지, 지도 좌표가 drawAllSky와 맞는지, 채점.

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

describe("문제 만들기", () => {
  it("같은 시드면 같은 문제다", () => {
    const a = makeWhichWayRound(42, "normal");
    const b = makeWhichWayRound(42, "normal");

    expect(a.date.getTime()).toBe(b.date.getTime());
    expect(a.place.name).toBe(b.place.name);
    expect(a.photos.map((p) => p.view)).toEqual(b.photos.map((p) => p.view));
  });

  it.each(
    (["intro", "easy", "normal", "hard"] as const).flatMap((d) =>
      [1, 2, 3, 4].map((seed) => [d, seed] as const),
    ),
  )("%s 시드 %i: 밤이고, 사진마다 밝은 별이 있고, 규칙을 지킨다", (d, seed) => {
    const set = WHICH_WAY_SETTINGS[d];
    const r = makeWhichWayRound(seed, d);
    const jd = julianDay(r.date);
    const frame = roundFrame(r);

    expect(altAzOf(sunVector(jd), jd, r.observer).altDeg).toBeLessThan(-15);
    expect(r.photos).toHaveLength(set.photos);
    expect(r.clouds).toHaveLength(set.clouds);

    r.photos.forEach((p, i) => {
      const v = p.view;

      expect(v.fovDeg).toBeGreaterThanOrEqual(set.fovDeg[0]);
      expect(v.fovDeg).toBeLessThanOrEqual(set.fovDeg[1]);
      expect(Math.abs(v.rollDeg)).toBeLessThanOrEqual(set.rollMaxDeg);
      // 귀퉁이도 천정을 넘지 않는다
      expect(v.altitudeDeg + diagonalHalfDeg(v.fovDeg)).toBeLessThanOrEqual(84);
      expect(brightStarsInPhoto(p.TP, frame)).toBeGreaterThanOrEqual(5);

      for (const q of r.photos.slice(0, i)) {
        expect(
          Math.abs(wrap180(q.view.azimuthDeg - v.azimuthDeg)),
        ).toBeGreaterThanOrEqual(set.minSepDeg);
      }
    });
  });

  it("입문 사진은 지평선이 사진 안에 보인다 (낮게 찍는다)", () => {
    for (const seed of [5, 6, 7]) {
      const r = makeWhichWayRound(seed, "intro");

      for (const p of r.photos) {
        // 광축 고도가 시야각 절반보다 낮으면 지평선이 사진 안에 든다
        expect(p.view.altitudeDeg).toBeLessThan(p.view.fovDeg / 2);
      }
    }
  });

  it("사진 가운데 픽셀의 하늘 방향이 정답 방위·고도와 같다 (변환과 수평 좌표계가 어긋나지 않는다)", () => {
    const r = makeWhichWayRound(11, "hard");
    const frame = roundFrame(r);

    for (const p of r.photos) {
      const center = altAzInFrame(
        photoToSkyFn(p.TP)(PHOTO_W / 2, PHOTO_H / 2),
        frame,
      );

      expect(angleBetweenDeg(center, photoAim(p))).toBeLessThan(0.05);
    }
  });

  it("사진 테두리는 광축에서 시야각 절반~대각선 절반 사이에 있다", () => {
    const r = makeWhichWayRound(3, "easy");
    const frame = roundFrame(r);
    const p = r.photos[0];
    const outline = photoOutline(p.TP, 8);

    expect(outline).toHaveLength(32);

    for (const v of outline) {
      const d = angleBetweenDeg(altAzInFrame(v, frame), photoAim(p));

      expect(d).toBeGreaterThan(p.view.fovDeg / 2 - 0.5);
      expect(d).toBeLessThan(diagonalHalfDeg(p.view.fovDeg) + 0.5);
    }
  });
});

describe("전천 지도 좌표", () => {
  const size = 760;
  const c = size / 2;
  const R = mapRadius(size);

  it("천정은 가운데, 북은 위, 동은 왼쪽, 지평선은 반지름 R", () => {
    const zen = altAzToMap({ altDeg: 90, azDeg: 0 }, size);
    const north = altAzToMap({ altDeg: 0, azDeg: 0 }, size);
    const east = altAzToMap({ altDeg: 0, azDeg: 90 }, size);
    const south = altAzToMap({ altDeg: 0, azDeg: 180 }, size);

    expect(zen[0]).toBeCloseTo(c);
    expect(zen[1]).toBeCloseTo(c);
    expect(north[1]).toBeCloseTo(c - R);
    expect(east[0]).toBeCloseTo(c - R);
    expect(south[1]).toBeCloseTo(c + R);
  });

  it("지도 위 점 → 고도·방위가 되돌아온다", () => {
    for (const a of [
      { altDeg: 10, azDeg: 30 },
      { altDeg: 45, azDeg: 200 },
      { altDeg: 70, azDeg: 300 },
      { altDeg: 1, azDeg: 135 },
    ]) {
      const [x, y] = altAzToMap(a, size);
      const b = mapToAltAz(x, y, size);

      expect(b.altDeg).toBeCloseTo(a.altDeg, 6);
      expect(b.azDeg).toBeCloseTo(a.azDeg, 6);
    }
  });

  it("지평선 밖을 누르면 지평선(고도 0°)으로 붙인다", () => {
    expect(mapToAltAz(c, c - R * 1.1, size).altDeg).toBe(0);
  });

  it("하늘 방향(J2000)을 그리는 식(drawAllSky와 같은 식)이 고도·방위 식과 같은 자리를 준다", () => {
    const r = makeWhichWayRound(8, "normal");
    const frame = roundFrame(r);

    for (const a of [
      { altDeg: 20, azDeg: 100 },
      { altDeg: 60, azDeg: 250 },
    ]) {
      const p = vecToMap(
        fromAltAzJ2000(frame, a.altDeg, a.azDeg),
        frame,
        size,
      )!;
      const q = altAzToMap(a, size);

      expect(p[0]).toBeCloseTo(q[0], 6);
      expect(p[1]).toBeCloseTo(q[1], 6);
    }
  });

  it("파노라마: 북 0°는 왼쪽 끝, 남은 가운데, 기준 방위 둘레로 풀어 이음매를 넘는다", () => {
    expect(panoXY({ altDeg: 0, azDeg: 180 }, 360, 100)[0]).toBeCloseTo(180);
    expect(panoXY({ altDeg: 90, azDeg: 0 }, 360, 100)[1]).toBeCloseTo(0);
    expect(panoXY({ altDeg: 0, azDeg: 10 }, 360, 100, 350)[0]).toBeCloseTo(370);
  });

  it("세 점 대응의 아핀 변환", () => {
    const m = affineFromTriangles(
      [0, 0],
      [10, 0],
      [0, 10],
      [5, 5],
      [5, 25],
      [-15, 5],
    )!;
    const apply = (x: number, y: number) => [
      m[0] * x + m[2] * y + m[4],
      m[1] * x + m[3] * y + m[5],
    ];

    expect(apply(10, 0)).toEqual([5, 25]);
    expect(apply(0, 10)).toEqual([-15, 5]);
    expect(apply(10, 10)[0]).toBeCloseTo(-15);
    expect(apply(10, 10)[1]).toBeCloseTo(25);
  });
});

describe("채점", () => {
  it("두 방향 사이 각", () => {
    expect(
      angleBetweenDeg({ altDeg: 0, azDeg: 0 }, { altDeg: 0, azDeg: 90 }),
    ).toBeCloseTo(90);
    expect(
      angleBetweenDeg({ altDeg: 90, azDeg: 0 }, { altDeg: 90, azDeg: 200 }),
    ).toBeCloseTo(0);
    expect(
      angleBetweenDeg({ altDeg: 30, azDeg: 350 }, { altDeg: 30, azDeg: 10 }),
    ).toBeCloseTo(
      (2 *
        Math.asin(
          Math.cos((30 * Math.PI) / 180) * Math.sin((10 * Math.PI) / 180),
        ) *
        180) /
        Math.PI,
    );
  });

  it("3° 안은 만점, 멀수록 줄어든다", () => {
    expect(pointsFor(0)).toBe(PHOTO_POINTS);
    expect(pointsFor(3)).toBe(PHOTO_POINTS);
    expect(pointsFor(10)).toBeGreaterThan(pointsFor(20));
    expect(pointsFor(20)).toBeGreaterThan(pointsFor(60));
    expect(pointsFor(180)).toBeLessThan(5);
  });

  it("정답 자리를 찍으면 만점, 안 찍은 사진은 0점", () => {
    const r = makeWhichWayRound(21, "easy");
    const perfect = scoreRound(r, r.photos.map(photoAim));

    expect(perfect.total).toBe(r.photos.length * PHOTO_POINTS);

    const partial = scoreRound(r, [
      photoAim(r.photos[0]),
      ...r.photos.slice(1).map(() => null),
    ]);

    expect(partial.total).toBe(PHOTO_POINTS);
    expect(partial.photos[1]).toEqual({ errDeg: null, points: 0 });
  });

  it("방위 이름 (16방위)", () => {
    expect(directionLabel(0)).toBe("북쪽");
    expect(directionLabel(359)).toBe("북쪽");
    expect(directionLabel(135)).toBe("남동쪽");
    expect(directionLabel(-90)).toBe("서쪽");
    expect(directionLabel(22)).toBe("북북동쪽");
  });
});
