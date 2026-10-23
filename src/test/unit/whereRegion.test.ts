import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
} from "@/search/utils/ephemeris";
import {
  latRangeFromStars,
  regionContains,
  regionFromStarsAtTime,
  whereShot,
} from "@/search/whereShot";
import catalogData from "@build/database/vectors-database.json";

interface VectorStar {
  x: number;
  y: number;
  z: number;
}

const catalog = (catalogData as VectorStar[]).map(
  (s): Point3D => [s.x, s.y, s.z],
);
const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sinD = (deg: number) => Math.sin((deg * Math.PI) / 180);

// 정답을 아는 합성 사진: 그 시각·장소에서 (고도, 방위)를 보고 찍었을 때 사진에 담기는 별
// (시야 반지름 radiusDeg 안, 지평선 위 1° 넘는 별만 — 땅에 가린 별은 찍히지 않는다)
const photoStars = (
  date: Date,
  observer: { latDeg: number; lonDeg: number },
  altDeg: number,
  azDeg: number,
  radiusDeg = 25,
) => {
  const frame = horizontalFrameJ2000(julianDay(date), observer);
  const center = fromAltAzJ2000(frame, altDeg, azDeg);

  return catalog.filter(
    (v) =>
      dot(v, center) > Math.cos((radiusDeg * Math.PI) / 180) &&
      dot(v, frame.zenith) > sinD(1),
  );
};

// 서울, 2021-10-03 04:30 KST (해는 지평선 아래 약 20°)
const seoulDate = new Date("2021-10-02T19:30:00Z");
const seoul = { latDeg: 37.5, lonDeg: 127 };

describe("촬영 순간을 알 때: 이 별들이 모두 떠 있던 곳", () => {
  it.each([
    ["서울, 동쪽 지평선 근처", seoulDate, seoul, 12, 90],
    ["서울, 남서쪽 하늘", seoulDate, seoul, 30, 220],
    [
      "옐로나이프, 북동쪽 지평선 근처",
      new Date("2024-04-02T05:24:15Z"),
      { latDeg: 62.53, lonDeg: -114.2 },
      15,
      20,
    ],
    [
      "케이프타운, 남쪽",
      new Date("2023-06-20T21:00:00Z"),
      { latDeg: -33.9, lonDeg: 18.4 },
      20,
      180,
    ],
    [
      "날짜 변경선 근처",
      new Date("2019-06-17T12:36:00Z"),
      { latDeg: 15.18, lonDeg: 179.5 },
      15,
      160,
    ],
  ] as const)("%s: 실제 촬영지가 영역 안이다", (_, date, observer, alt, az) => {
    const stars = photoStars(date, observer, alt, az);
    const region = regionFromStarsAtTime(stars, date)!;

    expect(stars.length).toBeGreaterThan(5);
    expect(regionContains(region, observer.latDeg, observer.lonDeg)).toBe(true);

    // 경도 범위도 촬영지를 감싼다 (날짜 변경선을 넘으면 서쪽 끝이 더 크다).
    // 영역이 극까지 닿으면 모든 경도를 지나 범위가 없다(null)
    if (region.lonRange) {
      const [west, east] = region.lonRange;
      const inLon =
        west <= east
          ? observer.lonDeg >= west && observer.lonDeg <= east
          : observer.lonDeg >= west || observer.lonDeg <= east;
      expect(inLon).toBe(true);
    }

    expect(observer.latDeg).toBeGreaterThanOrEqual(region.latRange[0]);
    expect(observer.latDeg).toBeLessThanOrEqual(region.latRange[1]);
  });

  it("지평선 가까운 별이 담기면 영역이 작다 (2026-10-23 측정: 서울 동쪽 지평선 2.2%, 머리 위 13.9%)", () => {
    const low = regionFromStarsAtTime(
      photoStars(seoulDate, seoul, 12, 90),
      seoulDate,
    )!;
    const high = regionFromStarsAtTime(
      photoStars(seoulDate, seoul, 75, 90),
      seoulDate,
    )!;

    expect(low.areaShare).toBeLessThan(0.05);
    expect(low.areaShare).toBeLessThan(high.areaShare / 3);
    // 경도로는 동경 118°~144° 쯤 (한반도·중국 동부·일본)
    const [west, east] = low.lonRange!;
    expect(east - west).toBeLessThan(40);
  });

  it("시각이 12시간 틀리면 촬영지가 영역 밖이다 (그 시각 서울은 낮)", () => {
    const stars = photoStars(seoulDate, seoul, 12, 90);
    const wrong = new Date(seoulDate.getTime() + 12 * 3600000);
    const region = regionFromStarsAtTime(stars, wrong);

    expect(
      region !== null && regionContains(region, seoul.latDeg, seoul.lonDeg),
    ).toBe(false);
  });
});

describe("whereShot에서", () => {
  const stars = photoStars(seoulDate, seoul, 12, 90);

  it("촬영 순간을 알면 영역(starsTime), 모르면 위도 범위(stars)", () => {
    const withTime = whereShot({ stars, utc: seoulDate })!;

    expect(withTime.source).toBe("starsTime");
    expect(withTime.lonDeg).toBeNull();
    expect(withTime.latRange).toEqual(withTime.region!.latRange);
    expect(whereShot({ stars })!.source).toBe("stars");
  });

  it("그 순간 별이 모두 떠 있는 곳이 없으면 위도 범위로 돌아간다", () => {
    // 천구의 북극과 남극을 함께 보려면 적도에 서야 하는데, 칸 가운데(±1°)에서는 하나가 지평선 아래다
    const poles: Point3D[] = [
      [0, 0, 1],
      [0, 0, -1],
    ];

    expect(regionFromStarsAtTime(poles, seoulDate)).toBeNull();
    expect(whereShot({ stars: poles, utc: seoulDate })).toEqual({
      source: "stars",
      estimated: true,
      latRange: latRangeFromStars(poles),
      lonDeg: null,
    });
  });

  it("지평선이 있으면 영역보다 지평선이 먼저다", () => {
    const frame = horizontalFrameJ2000(julianDay(seoulDate), seoul);
    const where = whereShot({
      stars,
      utc: seoulDate,
      horizon: {
        a: fromAltAzJ2000(frame, 0, 80),
        b: fromAltAzJ2000(frame, 0, 100),
        sky: frame.zenith,
      },
    })!;

    expect(where.source).toBe("horizon");
    expect(where.lonFromTime).toBe(true);
  });
});
