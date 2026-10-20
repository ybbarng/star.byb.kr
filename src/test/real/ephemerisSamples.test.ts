import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  altAzOf,
  julianDay,
  localSiderealDeg,
  moonVectorFrom,
  sunVector,
} from "@/search/utils/ephemeris";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import { loadSolvedPoses } from "@/test/real/detectionLabels";

// 촬영 기록을 아는 실제 샘플로 해·달 계산을 확인한다 (journey 20장, 발표 "이과생의 별 헤는 밤").

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

// 촬영 기록: 2022-03-27 04:30 KST, 서울 송파구 석촌호수 (출처 https://naver.me/5xgcLXzT)
describe("은하수 사진: 건물 뒤 빛은 막 뜬 달", () => {
  const seokchon = { latDeg: 37.509, lonDeg: 127.1 };
  const jd = julianDay(new Date("2022-03-26T19:30:00Z"));
  const pose = loadSolvedPoses()["20220328-brice-Milky Way over Buzzvil.jpg"];
  const glow: [number, number] = [455, 770];

  it("풀린 변환으로 투영한 달이 건물 뒤 빛과 4° 안에 있다", () => {
    const moon = moonVectorFrom(jd, seokchon);
    const xy = projectVecToPhoto(pose.TP, moon)!;

    expect(angleDeg(moon, photoToSky(pose.TP, glow))).toBeLessThan(4);
    expect(xy[0]).toBeGreaterThan(0);
    expect(xy[0]).toBeLessThan(pose.width);
  });

  it("달은 지평선 바로 위, 해는 지평선 아래", () => {
    const moon = altAzOf(moonVectorFrom(jd, seokchon), jd, seokchon);
    const sun = altAzOf(sunVector(jd), jd, seokchon);

    expect(moon.altDeg).toBeGreaterThan(0);
    expect(moon.altDeg).toBeLessThan(15);
    expect(sun.altDeg).toBeLessThan(-12);
  });
});

// Berry 사진: 발표에서 Stellarium으로 찾은 "같은 하늘" 2022-01-11 22:00에서
// 한 달에 2시간씩 밀어 후보를 만들고, 밤인 후보 중 10월 새벽 4시가 본인 답(10월 3일 4~5시)과 맞았다.
describe("Berry 사진: 같은 하늘은 같은 항성시", () => {
  const seoul = { latDeg: 37.5, lonDeg: 127 };
  const lstAt = (iso: string) =>
    localSiderealDeg(julianDay(new Date(iso)), seoul);
  const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

  // "한 달에 2시간"은 근사라 10월→1월(92일)이면 약 6분(1.4°) 어긋난다
  it("2022-01-11 22:00과 2021-10-11 04:00 KST의 항성시가 2°(8분) 안에서 같다", () => {
    expect(
      diff(lstAt("2022-01-11T13:00:00Z"), lstAt("2021-10-10T19:00:00Z")),
    ).toBeLessThan(2);
  });

  it("본인이 답한 2021-10-03 04:30 KST는 해가 18° 아래인 깜깜한 밤", () => {
    const jd = julianDay(new Date("2021-10-02T19:30:00Z"));

    expect(altAzOf(sunVector(jd), jd, seoul).altDeg).toBeLessThan(-18);
  });
});
