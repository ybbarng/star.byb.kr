import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import {
  altAzOf,
  gmstDeg,
  julianDay,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";

// 풀린 사진에서 촬영 시각을 거꾸로 찾는다 (발표 "이과생의 별 헤는 밤"을 계산으로).
// 1) 지평선 위 두 방향(고도 0°)의 수직 방향이 천정이다.
// 2) 천정의 적위 = 위도, 천정의 적경 = 지방 항성시. 같은 항성시면 같은 하늘이다.
// 3) 경도를 알면 날짜마다 그 항성시가 되는 시각이 하나씩 정해진다 → 해가 떠 있으면 버린다.
// 4) 사진에 달이 있으면 그 시각의 달 위치가 맞는 날짜를 고른다 (달은 하루 13°씩 움직인다).
// 세차는 무시한다(카탈로그는 J2000, 항성시는 그날 기준) — 20년이면 약 0.3°, 1분 남짓이다.

const D = Math.PI / 180;
const SIDEREAL_DAY = 0.99726957; // 태양일 단위 항성일

const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

// 지평선 위 두 방향 → 천정. sky는 하늘 쪽에 있는 아무 방향(사진 위쪽 등)으로 위아래를 정한다.
export const zenithFromHorizon = (
  a: Point3D,
  b: Point3D,
  sky: Point3D,
): Point3D | null => {
  const n = cross(a, b);
  const len = Math.hypot(n[0], n[1], n[2]);

  if (len < 1e-6) {
    return null; // 두 점이 같은 방향
  }

  const s = dot(n, sky) >= 0 ? 1 : -1;

  return [(s * n[0]) / len, (s * n[1]) / len, (s * n[2]) / len];
};

export interface SkyClock {
  latDeg: number; // 천정의 적위
  lstDeg: number; // 지방 항성시 (천정의 적경)
}

export const skyClockOf = (zenith: Point3D): SkyClock => ({
  latDeg: Math.asin(Math.max(-1, Math.min(1, zenith[2]))) / D,
  lstDeg: (((Math.atan2(zenith[1], zenith[0]) / D) % 360) + 360) % 360,
});

// from부터 시작해 처음으로 지방 항성시가 lstDeg가 되는 순간
export const nextTimeWithLst = (
  lstDeg: number,
  lonDeg: number,
  from: Date,
): Date => {
  const jd = julianDay(from);
  const now = gmstDeg(jd) + lonDeg;
  const ahead = (((lstDeg - now) % 360) + 360) % 360;

  return new Date(from.getTime() + (ahead / 360) * SIDEREAL_DAY * 86400000);
};

export interface ShotCandidate {
  date: Date;
  sunAltDeg: number;
  moonErrorDeg?: number; // 사진 속 달과 계산한 달 사이 각도
  // 달이 빛나는 비율 (0 그믐 ~ 1 보름). 달은 27.3일마다 같은 별자리 자리로 돌아오므로
  // 위치만으로는 그 간격의 날짜가 겹친다. 사진 속 달 모양(위상)으로 가른다.
  moonLit?: number;
}

export interface EstimateOptions {
  lonDeg: number; // 촬영지 경도 (모르면 시간대 중심 경도로 둔다)
  from: Date; // 찾을 기간 시작
  days: number; // 찾을 기간 길이
  maxSunAltDeg?: number; // 이보다 해가 높으면 버린다 (기본 -12°: 별이 잘 보이는 밤)
  moon?: Point3D; // 사진 속 달 방향 (J2000)
}

// 기간 안에서 그 하늘이 되는 밤 시각들. 달을 주면 달이 맞는 순으로 정렬한다.
export const estimateShotTimes = (
  clock: SkyClock,
  options: EstimateOptions,
): ShotCandidate[] => {
  const maxSun = options.maxSunAltDeg ?? -12;
  const observer: Observer = { latDeg: clock.latDeg, lonDeg: options.lonDeg };
  const end = options.from.getTime() + options.days * 86400000;
  const out: ShotCandidate[] = [];

  for (
    let t = nextTimeWithLst(clock.lstDeg, options.lonDeg, options.from);
    t.getTime() < end;
    t = new Date(t.getTime() + SIDEREAL_DAY * 86400000)
  ) {
    const jd = julianDay(t);
    const sunAltDeg = altAzOf(sunVector(jd), jd, observer).altDeg;

    if (sunAltDeg > maxSun) {
      continue;
    }

    const candidate: ShotCandidate = { date: t, sunAltDeg };

    if (options.moon) {
      const moon = moonVectorFrom(jd, observer);
      candidate.moonErrorDeg = angleDeg(ofDateToJ2000(moon, jd), options.moon);
      candidate.moonLit = (1 - Math.cos(angleDeg(moon, sunVector(jd)) * D)) / 2;
    }

    out.push(candidate);
  }

  if (options.moon) {
    out.sort((a, b) => a.moonErrorDeg! - b.moonErrorDeg!);
  }

  return out;
};
