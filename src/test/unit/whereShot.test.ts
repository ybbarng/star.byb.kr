import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { skyClockOf, zenithFromHorizon } from "@/search/shotTimeEstimate";
import { julianDay, zenithVector } from "@/search/utils/ephemeris";
import {
  HORIZON_LAT_TOLERANCE_DEG,
  latRangeFromStars,
  latText,
  lonText,
  whereShot,
} from "@/search/whereShot";
import catalogData from "@build/database/vectors-database.json";

interface VectorStar {
  N?: string;
  x: number;
  y: number;
  z: number;
}

const catalog = catalogData as VectorStar[];
const vec = (s: VectorStar): Point3D => [s.x, s.y, s.z];
const named = (name: string) => vec(catalog.find((s) => s.N === name)!);
const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 사진 한 장에 담길 만한 하늘: 중심에서 radiusDeg 안의 카탈로그 별
const fieldAround = (center: Point3D, radiusDeg: number) =>
  catalog
    .map(vec)
    .filter((v) => dot(v, center) > Math.cos((radiusDeg * Math.PI) / 180));

// 천정에 수직인 두 방향 = 지평선 위 두 점 (shotTimeEstimate.test와 같은 방식)
const horizonPair = (z: Point3D): [Point3D, Point3D] => {
  const n = Math.hypot(z[1], z[0]);
  const u: Point3D = [-z[1] / n, z[0] / n, 0];
  const v: Point3D = [
    z[1] * u[2] - z[2] * u[1],
    z[2] * u[0] - z[0] * u[2],
    z[0] * u[1] - z[1] * u[0],
  ];

  return [u, v];
};

const seoul = { latDeg: 37.5, lonDeg: 127 };
const jd = julianDay(new Date("2021-10-02T19:30:00Z"));

describe("별만 있을 때: 이 하늘이 보이는 위도 범위", () => {
  it("북극성 둘레를 찍었으면 먼 남쪽에서는 찍을 수 없다", () => {
    const stars = fieldAround(named("Polaris"), 12);
    const [south, north] = latRangeFromStars(stars)!;

    expect(stars.length).toBeGreaterThan(3);
    expect(south).toBeGreaterThan(-15); // 남위 15°보다 남쪽은 북극성 둘레가 지평선 아래
    expect(north).toBe(90);
  });

  it("남십자자리(적위 약 −60°)가 담겼으면 북위 30°보다 북쪽일 수 없다", () => {
    const stars = fieldAround(named("Acrux"), 8);
    const [south, north] = latRangeFromStars(stars)!;

    expect(north).toBeLessThan(30);
    expect(south).toBe(-90);
    // 서울(북위 37.5°)은 범위 밖
    expect(seoul.latDeg).toBeGreaterThan(north);
  });

  it("whereShot은 별 범위를 추정으로, 경도는 모름으로 둔다", () => {
    const stars = fieldAround(named("Acrux"), 8);

    expect(whereShot({ stars })).toEqual({
      source: "stars",
      estimated: true,
      latRange: latRangeFromStars(stars),
      lonDeg: null,
    });
  });

  it("아무것도 없으면 답하지 않는다", () => {
    expect(whereShot({})).toBeNull();
    expect(whereShot({ stars: [] })).toBeNull();
  });
});

describe("지평선을 찍었을 때: 위도 하나 (추정)", () => {
  const z = zenithVector(jd, seoul);
  const [a, b] = horizonPair(z);

  it("ShotTimeEstimator와 같은 계산(skyClockOf)으로 위도를 낸다", () => {
    const where = whereShot({ horizon: { a, b, sky: z } })!;

    expect(where.source).toBe("horizon");
    expect(where.estimated).toBe(true);
    expect(where.latDeg).toBe(skyClockOf(zenithFromHorizon(a, b, z)!).latDeg);
    expect(where.latDeg).toBeCloseTo(37.5, 6);
    expect(where.latRange![1] - where.latRange![0]).toBeCloseTo(
      2 * HORIZON_LAT_TOLERANCE_DEG,
      6,
    );
    expect(where.lonDeg).toBeNull();
  });

  it("지평선이 별 범위보다 먼저다", () => {
    const where = whereShot({
      horizon: { a, b, sky: z },
      stars: fieldAround(named("Polaris"), 12),
    });

    expect(where?.source).toBe("horizon");
  });

  it("두 점이 같은 방향이면 지평선을 버리고 별 범위로 간다", () => {
    const where = whereShot({
      horizon: { a, b: a, sky: z },
      stars: fieldAround(named("Polaris"), 12),
    });

    expect(where?.source).toBe("stars");
  });
});

describe("장소를 알 때: 위도·경도 그대로", () => {
  const z = zenithVector(jd, seoul);
  const [a, b] = horizonPair(z);
  const all = {
    horizon: { a, b, sky: z },
    stars: fieldAround(named("Acrux"), 8),
    place: { latDeg: 15.18, lonDeg: 145.75, source: "manual" as const },
  };

  it("사람이 넣은 장소가 하늘 추정보다 먼저다", () => {
    expect(whereShot(all)).toEqual({
      source: "manual",
      estimated: false,
      latDeg: 15.18,
      lonDeg: 145.75,
    });
  });

  it("사진의 GPS가 무엇보다 먼저다", () => {
    expect(
      whereShot({ ...all, exif: { latDeg: -33.9, lonDeg: 18.4 } }),
    ).toEqual({
      source: "exif",
      estimated: false,
      latDeg: -33.9,
      lonDeg: 18.4,
    });
  });
});

describe("글자", () => {
  it("북위/남위, 동경/서경", () => {
    expect(latText(37.5)).toBe("북위 38°");
    expect(latText(-33.9, 1)).toBe("남위 33.9°");
    expect(lonText(127)).toBe("동경 127°");
    expect(lonText(-70.4)).toBe("서경 70°");
  });
});
