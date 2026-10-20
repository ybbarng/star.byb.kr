import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  altAzOf,
  gmstDeg,
  julianDay,
  moonPosition,
  moonVectorFrom,
  sunVector,
} from "@/search/utils/ephemeris";

const raDecOf = (v: Point3D) => ({
  ra: ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360,
  dec: (Math.asin(v[2]) * 180) / Math.PI,
});

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

// 기준값은 Meeus, 『Astronomical Algorithms』(2판)의 예제
describe("시각", () => {
  it("J2000.0 (2000-01-01 12시 UTC)은 율리우스일 2451545", () => {
    expect(julianDay(new Date("2000-01-01T12:00:00Z"))).toBe(2451545);
  });

  it("1987-04-10 0시 UT의 그리니치 평균 항성시는 13h10m46.37s (예제 12.a)", () => {
    const jd = julianDay(new Date("1987-04-10T00:00:00Z"));

    expect(jd).toBe(2446895.5);
    expect(gmstDeg(jd)).toBeCloseTo(197.693195, 3);
  });
});

describe("해", () => {
  it("1992-10-13 0시: 적경 198.38°, 적위 -7.79° (예제 25.a)", () => {
    const { ra, dec } = raDecOf(
      sunVector(julianDay(new Date("1992-10-13T00:00:00Z"))),
    );

    expect(Math.abs(ra - 198.38083)).toBeLessThan(0.05);
    expect(Math.abs(dec - -7.78507)).toBeLessThan(0.05);
  });

  it("2022년 춘분날 그리니치 남중 때 고도는 90° - 위도", () => {
    const jd = julianDay(new Date("2022-03-20T12:07:00Z"));
    const { altDeg, azDeg } = altAzOf(sunVector(jd), jd, {
      latDeg: 51.48,
      lonDeg: 0,
    });

    expect(Math.abs(altDeg - (90 - 51.48))).toBeLessThan(0.3);
    expect(Math.abs(azDeg - 180)).toBeLessThan(1);
  });
});

describe("달", () => {
  it("1992-04-12 0시: 적경 134.69°, 적위 13.77°, 거리 368,410km (예제 47.a)", () => {
    const { vector, distanceEarthRadii } = moonPosition(
      julianDay(new Date("1992-04-12T00:00:00Z")),
    );
    const { ra, dec } = raDecOf(vector);

    expect(Math.abs(ra - 134.68847)).toBeLessThan(0.5);
    expect(Math.abs(dec - 13.768368)).toBeLessThan(0.5);
    expect(Math.abs(distanceEarthRadii * 6378.14 - 368409.7)).toBeLessThan(
      3000,
    );
  });

  it("관측지에서 본 달은 지구 중심에서 본 달과 1° 안에서 다르다 (시차)", () => {
    const jd = julianDay(new Date("2022-03-26T19:30:00Z"));
    const seoul = { latDeg: 37.5, lonDeg: 127 };
    const shift = angleDeg(moonPosition(jd).vector, moonVectorFrom(jd, seoul));

    expect(shift).toBeGreaterThan(0.5);
    expect(shift).toBeLessThan(1.1);
  });
});
