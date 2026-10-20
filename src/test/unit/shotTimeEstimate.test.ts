import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  angleDeg,
  estimateShotTimes,
  nextTimeWithLst,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import {
  julianDay,
  localSiderealDeg,
  moonVectorFrom,
  ofDateToJ2000,
  zenithVector,
} from "@/search/utils/ephemeris";

const seoul = { latDeg: 37.5, lonDeg: 127 };

// 천정에 수직인 두 방향 = 지평선 위 두 점
const horizonPair = (z: Point3D): [Point3D, Point3D] => {
  const a: Point3D = [-z[1], z[0], 0];
  const n = Math.hypot(a[0], a[1]);
  const u: Point3D = [a[0] / n, a[1] / n, 0];
  const v: Point3D = [
    z[1] * u[2] - z[2] * u[1],
    z[2] * u[0] - z[0] * u[2],
    z[0] * u[1] - z[1] * u[0],
  ];

  return [u, v];
};

describe("지평선 → 천정 → 위도·항성시", () => {
  it("지평선 두 점에서 천정을 되찾고, 하늘 쪽으로 방향을 정한다", () => {
    const z = zenithVector(2459500.3, seoul);
    const [a, b] = horizonPair(z);

    expect(angleDeg(zenithFromHorizon(a, b, z)!, z)).toBeLessThan(1e-9);
    expect(angleDeg(zenithFromHorizon(b, a, z)!, z)).toBeLessThan(1e-9);
  });

  it("천정의 적위는 위도, 적경은 지방 항성시", () => {
    const jd = julianDay(new Date("2021-10-02T19:30:00Z"));
    const clock = skyClockOf(zenithVector(jd, seoul));

    expect(clock.latDeg).toBeCloseTo(37.5, 6);
    expect(clock.lstDeg).toBeCloseTo(localSiderealDeg(jd, seoul), 6);
  });
});

describe("촬영 시각 후보", () => {
  it("항성시가 같은 다음 순간을 찾는다", () => {
    const from = new Date("2021-10-02T00:00:00Z");
    const t = nextTimeWithLst(200, seoul.lonDeg, from);

    expect(t.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(t.getTime() - from.getTime()).toBeLessThan(86400000);
    expect(localSiderealDeg(julianDay(t), seoul)).toBeCloseTo(200, 3);
  });

  it("같은 하늘은 하루에 약 4분씩 일찍 오고, 해가 뜬 시각은 뺀다", () => {
    const truth = new Date("2021-10-02T19:30:00Z"); // 10월 3일 04:30 KST
    const clock = skyClockOf(zenithVector(julianDay(truth), seoul));
    const list = estimateShotTimes(clock, {
      lonDeg: seoul.lonDeg,
      from: new Date("2021-01-01T00:00:00Z"),
      days: 365,
    });
    const found = list.find(
      (c) => Math.abs(c.date.getTime() - truth.getTime()) < 60000,
    );

    expect(found).toBeDefined();
    expect(list.every((c) => c.sunAltDeg <= -12)).toBe(true);
    // 이 하늘(새벽 4시 반의 가을 하늘)은 해가 뜬 낮 시각이 되는 봄·여름 날들이 빠진다
    expect(list.length).toBeLessThan(300);
  });

  it("사진 속 달 위치로 날짜를 하루로 좁힌다", () => {
    const truth = new Date("2022-03-26T19:30:00Z"); // 은하수 사진 3월 27일 04:30 KST
    const jd = julianDay(truth);
    const clock = skyClockOf(zenithVector(jd, seoul));
    const moon = ofDateToJ2000(moonVectorFrom(jd, seoul), jd);
    const [best, second, third] = estimateShotTimes(clock, {
      lonDeg: seoul.lonDeg,
      from: new Date("2022-01-01T00:00:00Z"),
      days: 365,
      moon,
    });

    expect(Math.abs(best.date.getTime() - truth.getTime())).toBeLessThan(60000);
    expect(best.moonErrorDeg!).toBeLessThan(0.1);

    // 달은 27.3일(항성월)마다 같은 별자리 자리로 돌아와 위치만으로는 그 간격이 겹친다
    // (2위는 6월 16일, 1.5° 차이). 그 후보들은 위상이 달라서 사진 속 달 모양으로 가른다
    // (실제 0.32 그믐 쪽 vs 6월 0.93 거의 보름).
    for (const other of [second, third]) {
      const months =
        Math.abs(other.date.getTime() - truth.getTime()) / 86400000 / 27.32;

      expect(Math.abs(months - Math.round(months))).toBeLessThan(0.1);
      expect(Math.abs(other.moonLit! - best.moonLit!)).toBeGreaterThan(0.2);
    }
  });
});
