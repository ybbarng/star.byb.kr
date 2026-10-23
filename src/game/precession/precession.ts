import type { ZodiacConstellation } from "@/game/birthday/zodiac";
import type { Point3D } from "@/scripts/hash/types";
import { zodiacAt } from "@/game/birthday/zodiac";

// 세차운동 타임머신: 지구 자전축이 팽이처럼 약 25,800년에 한 바퀴 돌아, 천구의 북극이 별 사이에서 원을 그린다.
//
// 근사: 자전축은 황도의 북극을 중심으로, 지금의 기울기(23.44°)를 그대로 둔 채 1년에 50.288″씩 일정하게 돈다
// (IAU 2006 세차의 황경 방향 첫째 항 5028.796195″/세기). 둘째 항 이후·황도 자체의 움직임·기울기의 변화(약 4만 년 주기로
// 22.1~24.5°)·별의 고유 운동은 무시한다. 지금 둘레 몇백 년은 아주 잘 맞고, 만 년쯤 떨어지면 1~2° 어긋날 수 있다.
// 좌표는 카탈로그와 같은 J2000 적도좌표 단위 벡터 (x: 춘분점, z: 천구 북극).

const D = Math.PI / 180;

// 1년에 춘분점이 황도를 따라 밀리는 각 (″)
export const PRECESSION_ARCSEC_PER_YEAR = 50.28796195;
// 지구 자전축 기울기 (J2000, 고정)
export const OBLIQUITY_DEG = 23.4392911;
// 한 바퀴 걸리는 해
export const PRECESSION_PERIOD_YEARS =
  (360 * 3600) / PRECESSION_ARCSEC_PER_YEAR;

const EPS = OBLIQUITY_DEG * D;

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

// J2000부터 그 해까지 춘분점이 밀린 각 (°, 연도는 천문 연도: 0년 = 기원전 1년)
export const precessionDeg = (year: number) =>
  ((year - 2000) * PRECESSION_ARCSEC_PER_YEAR) / 3600;

// J2000 황경·황위(°) → 적도좌표 방향
export const fromEclipticJ2000 = (lonDeg: number, latDeg: number): Point3D => {
  const x = Math.cos(latDeg * D) * Math.cos(lonDeg * D);
  const y = Math.cos(latDeg * D) * Math.sin(lonDeg * D);
  const z = Math.sin(latDeg * D);

  return [
    x,
    Math.cos(EPS) * y - Math.sin(EPS) * z,
    Math.sin(EPS) * y + Math.cos(EPS) * z,
  ];
};

// 적도좌표 방향 → J2000 황경·황위 (°)
export const toEclipticJ2000 = (v: Point3D) => {
  const y = Math.cos(EPS) * v[1] + Math.sin(EPS) * v[2];
  const z = -Math.sin(EPS) * v[1] + Math.cos(EPS) * v[2];

  return {
    lonDeg: wrap360(Math.atan2(y, v[0]) / D),
    latDeg: Math.asin(Math.max(-1, Math.min(1, z))) / D,
  };
};

// 그 해의 천구의 북극 (지금은 황경 90°, 황위 90° - 23.44°에 있다. 춘분점이 밀린 만큼 같이 밀린다)
export const northPoleOfYear = (year: number): Point3D =>
  fromEclipticJ2000(90 - precessionDeg(year), 90 - OBLIQUITY_DEG);

// 그 해의 춘분점 황경 (J2000 기준, °). 점성술 양자리의 시작(0°)이 여기다
export const equinoxLonOfYear = (year: number) => wrap360(-precessionDeg(year));

// 그 해의 춘분점이 실제로 들어 있는 황도 별자리
export const equinoxConstellation = (year: number): ZodiacConstellation =>
  zodiacAt(equinoxLonOfYear(year));

// 점성술의 열두 궁이 정해진 무렵 (기원전 2세기, 히파르코스. 그때 춘분점이 양자리 별들 곁에 있었다)
export const ASTROLOGY_EPOCH_YEAR = -129;

// 점성술 기준이 정해진 뒤로 별자리와 궁이 어긋난 각 (°)
export const astrologyDriftDeg = (year: number) =>
  precessionDeg(year) - precessionDeg(ASTROLOGY_EPOCH_YEAR);

export const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) / D;

export interface PoleStarCandidate {
  vector: Point3D;
  mag: number;
  name?: string;
}

// 그 해의 북극에 가장 가까운 밝은 별 (magLimit 등급까지)
export const nearestPoleStar = <T extends PoleStarCandidate>(
  year: number,
  stars: T[],
  magLimit = 3.7,
): { star: T; sepDeg: number } => {
  const pole = northPoleOfYear(year);
  let best: { star: T; sepDeg: number } | null = null;

  for (const s of stars) {
    if (s.mag > magLimit) {
      continue;
    }

    const sep = angleDeg(pole, s.vector);

    if (!best || sep < best.sepDeg) {
      best = { star: s, sepDeg: sep };
    }
  }

  return best!;
};

export interface PoleStarEra<T> {
  star: T;
  bestYear: number; // 극에 가장 가까워지는 해
  minSepDeg: number;
}

// 북극성이 될 만한 별들의 시대: 극이 별에서 maxSep° 안을 지나는 별마다 가장 가까운 해
export const poleStarEras = <T extends PoleStarCandidate>(
  stars: T[],
  fromYear: number,
  toYear: number,
  { magLimit = 3.7, maxSepDeg = 5, stepYears = 25 } = {},
): PoleStarEra<T>[] => {
  const best = new Map<T, PoleStarEra<T>>();

  for (let y = fromYear; y <= toYear; y += stepYears) {
    const pole = northPoleOfYear(y);

    for (const s of stars) {
      if (s.mag > magLimit) {
        continue;
      }

      const sep = angleDeg(pole, s.vector);
      const prev = best.get(s);

      if (sep <= maxSepDeg && (!prev || sep < prev.minSepDeg)) {
        best.set(s, { star: s, bestYear: y, minSepDeg: sep });
      }
    }
  }

  return [...best.values()].sort((a, b) => a.bestYear - b.bestYear);
};

// 천문 연도 → 보이는 연도 (0년 = 기원전 1년)
export const yearLabel = (year: number) =>
  year <= 0
    ? `기원전 ${(1 - year).toLocaleString()}년`
    : `${year.toLocaleString()}년`;
