import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { julianDay, ofDateToJ2000, sunVector } from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";

const D = Math.PI / 180;

const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) / D;

const fromRaDec = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

// J2000 황도 경도
const eclipticLongitude = (v: Point3D) => {
  const e = 23.43928 * D;
  const y = Math.cos(e) * v[1] + Math.sin(e) * v[2];

  return (((Math.atan2(y, v[0]) / D) % 360) + 360) % 360;
};

describe("세차 되돌리기", () => {
  it("J2000 시각에서는 그대로다", () => {
    const v = fromRaDec(123, 45);

    expect(angleDeg(ofDateToJ2000(v, 2451545), v)).toBeLessThan(1e-9);
  });

  it("22년이면 약 0.3° 움직인다 (1년에 50″)", () => {
    const jd = julianDay(new Date("2022-03-27T00:00:00Z"));
    const shift = angleDeg(
      ofDateToJ2000(fromRaDec(300, -26), jd),
      fromRaDec(300, -26),
    );

    expect(shift).toBeGreaterThan(0.25);
    expect(shift).toBeLessThan(0.35);
  });
});

describe("행성", () => {
  it("1992-12-20 금성: 적경 316.17°, 적위 -18.89° (Meeus 예제 33.a)", () => {
    const jd = julianDay(new Date("1992-12-20T00:00:00Z"));
    const expected = ofDateToJ2000(fromRaDec(316.172727, -18.88801), jd);
    const { vector, distanceAu } = planetPosition("Venus", jd);

    expect(angleDeg(vector, expected)).toBeLessThan(0.05);
    expect(Math.abs(distanceAu - 0.910947)).toBeLessThan(0.001);
  });

  it("2020-12-21 목성과 토성의 대근접: 0.1°까지 다가간다", () => {
    const jd = julianDay(new Date("2020-12-21T18:00:00Z"));
    const sep = angleDeg(
      planetPosition("Jupiter", jd).vector,
      planetPosition("Saturn", jd).vector,
    );

    expect(sep).toBeGreaterThan(0.05);
    expect(sep).toBeLessThan(0.15);
  });

  it("2020-10-13 23시(UTC) 화성 충: 해의 정반대 황경", () => {
    const jd = julianDay(new Date("2020-10-13T23:20:00Z"));
    const mars = eclipticLongitude(planetPosition("Mars", jd).vector);
    const sun = eclipticLongitude(ofDateToJ2000(sunVector(jd), jd));

    expect(Math.abs(((mars - sun + 360) % 360) - 180)).toBeLessThan(0.2);
  });
});
