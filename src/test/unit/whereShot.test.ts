import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { exactShotUtc, shotFromExif } from "@/plate-solver/shotTime";
import { horizonCameraTP } from "@/search/horizonSolve";
import { skyClockOf, zenithFromHorizon } from "@/search/shotTimeEstimate";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  zenithVector,
} from "@/search/utils/ephemeris";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
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

// 정답을 아는 합성 사진(compass.test와 같은 방식): 시각·장소로 카메라를 세우고,
// 지평선 위 두 방위를 사진에 찍은 뒤 풀이 변환으로 되돌린다
const horizonFromPhoto = (
  date: Date,
  observer: { latDeg: number; lonDeg: number },
  azimuthDeg: number,
) => {
  const W = 4000;
  const H = 1848;
  const TP = horizonCameraTP(
    date,
    observer,
    { azimuthDeg, altitudeDeg: 15, rollDeg: 1, fovDeg: 50 },
    W,
    H,
  );
  const frame = horizontalFrameJ2000(julianDay(date), observer);
  const a = projectVecToPhoto(TP, fromAltAzJ2000(frame, 0, azimuthDeg - 20))!;
  const b = projectVecToPhoto(TP, fromAltAzJ2000(frame, 0, azimuthDeg + 20))!;

  return {
    a: photoToSky(TP, a),
    b: photoToSky(TP, b),
    sky: photoToSky(TP, [W / 2, 0]),
  };
};

describe("지평선 + 시간대까지 아는 촬영 시각: 경도 (추정)", () => {
  it.each([
    ["옐로나이프", new Date("2024-04-02T05:24:15Z"), 62.53, -114.2, 20],
    ["서울", new Date("2021-10-02T19:30:00Z"), 37.5, 127, 250],
    ["케이프타운", new Date("2023-06-20T21:00:00Z"), -33.9, 18.4, 180],
    ["날짜 변경선 근처", new Date("2019-06-17T12:36:00Z"), 15.18, 179.5, 160],
  ] as const)(
    "%s: 되찾은 경도가 0.5° 안으로 맞는다",
    (_, date, latDeg, lonDeg, azimuthDeg) => {
      const horizon = horizonFromPhoto(date, { latDeg, lonDeg }, azimuthDeg);
      const where = whereShot({ horizon, utc: date })!;

      expect(where.source).toBe("horizon");
      expect(where.lonFromTime).toBe(true);
      expect(where.latDeg!).toBeCloseTo(latDeg, 0);
      const lonError = ((where.lonDeg! - lonDeg + 540) % 360) - 180;
      expect(Math.abs(lonError)).toBeLessThan(0.5);
    },
  );

  it("시각이 1시간 틀리면 경도가 15°쯤 틀린다 (그래서 시간대를 추정한 시각은 쓰지 않는다)", () => {
    const date = new Date("2024-04-02T05:24:15Z");
    const horizon = horizonFromPhoto(
      date,
      { latDeg: 62.53, lonDeg: -114.2 },
      20,
    );
    const where = whereShot({
      horizon,
      utc: new Date(date.getTime() + 3600000),
    })!;

    expect(where.lonDeg! - -114.2).toBeCloseTo(-15.04, 0);
  });

  it("촬영 시각이 없으면 경도는 모름", () => {
    const date = new Date("2024-04-02T05:24:15Z");
    const horizon = horizonFromPhoto(
      date,
      { latDeg: 62.53, lonDeg: -114.2 },
      20,
    );

    expect(whereShot({ horizon })!.lonDeg).toBeNull();
    expect(whereShot({ horizon, utc: null })!.lonFromTime).toBeUndefined();
    expect(whereShot({ horizon, utc: new Date(NaN) })!.lonDeg).toBeNull();
  });
});

describe("경도에 쓸 수 있는 촬영 시각 (시간대까지 아는가)", () => {
  const exif = {
    localDateTime: "2024-04-01T23:24:15",
    latDeg: null,
    lonDeg: null,
  };

  it("EXIF에 시간대가 있으면 그 순간을 쓴다", () => {
    const shot = shotFromExif({ ...exif, offset: "-06:00" });

    expect(exactShotUtc(shot)?.toISOString()).toBe("2024-04-02T05:24:00.000Z");
  });

  it("EXIF에 시간대가 없으면 (브라우저 시간대로 추정) 쓰지 않는다", () => {
    const shot = shotFromExif({ ...exif, offset: null });

    expect(shot?.offsetGuessed).toBe(true);
    expect(exactShotUtc(shot)).toBeNull();
  });

  it("'언제 찍었을까?'에서 하늘로 거꾸로 찾은 시각은 쓰지 않는다", () => {
    expect(
      exactShotUtc({
        local: "2024-04-01T23:24",
        offset: "-06:00",
        source: "manual",
        note: "사진에서 추정",
      }),
    ).toBeNull();
    expect(exactShotUtc(null)).toBeNull();
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
