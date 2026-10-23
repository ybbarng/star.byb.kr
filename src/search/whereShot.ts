import type { Point3D } from "@/scripts/hash/types";
import { skyClockOf, zenithFromHorizon } from "@/search/shotTimeEstimate";
import {
  gmstDeg,
  j2000ToOfDate,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";

// 풀린 사진으로 "어디서 찍었을까?"를 답한다. 아는 만큼만: 위도는 가로선(또는 띠), 경도는 세로선.
// 하늘만으로는 경도를 알 수 없다 (같은 하늘이 경도마다 다른 시각에 온다 → 정확한 UTC 시각이 있어야 한다).
// 그래서 lonDeg는 모르면 null로 둔다. 시간대까지 아는 촬영 시각(utc)이 있으면 채운다.
//
// 출처 우선순위 (앞의 것이 있으면 뒤는 보지 않는다)
// 1. exif: 사진의 GPS → 위도·경도 그대로
// 2. record·manual: 샘플 기록이나 사람이 넣은 장소 → 위도·경도
// 3. horizon: 지평선 두 점 → 천정 → 천정의 적위가 위도 (ShotTimeEstimator와 같은 계산).
//    촬영 순간(UTC)을 알면 천정의 적경(지방 항성시) − 그리니치 항성시 = 경도
// 4. starsTime: 촬영 순간(UTC)을 알면, 그 순간 사진 속 별이 모두 떠 있고 해가 충분히 진 곳 (지구 위 영역)
// 5. stars: 사진에 담긴 별들이 모두 지평선 위에 있으려면 위도가 어느 범위여야 하는가

export type WhereSource =
  | "exif"
  | "record"
  | "manual"
  | "horizon"
  | "starsTime"
  | "stars";

// 지구를 위도·경도 칸으로 나눠 조건에 맞는 칸만 모은 영역
export interface EarthRegion {
  stepDeg: number;
  cells: [number, number][]; // 칸 가운데 [위도, 경도]
  latRange: [number, number]; // [남, 북] (칸 끝까지)
  // [서쪽 끝, 동쪽 끝] (칸 끝까지). 날짜 변경선을 넘으면 서쪽 끝이 더 크다. 경도 전체면 null
  lonRange: [number, number] | null;
  center: LatLon; // 칸들의 가운데 (넓이로 가중)
  areaShare: number; // 지구 겉넓이 중 차지하는 비율
}

export interface WhereShot {
  source: WhereSource;
  estimated: boolean; // 하늘에서 추정한 값 (사진·사람이 준 값이 아니다)
  latDeg?: number; // 위도를 하나로 알 때
  latRange?: [number, number]; // 위도 띠 [남, 북]: horizon은 오차 폭, stars는 가능한 범위
  lonDeg: number | null; // 모르면 null
  lonFromTime?: boolean; // 경도를 촬영 시각으로 구했다 (지평선 + 시각)
  region?: EarthRegion; // starsTime: 그 순간 이 별들이 모두 떠 있던 곳
}

export interface LatLon {
  latDeg: number;
  lonDeg: number;
}

export interface WhereInputs {
  exif?: LatLon | null; // 사진 EXIF의 GPS
  place?: (LatLon & { source: "record" | "manual" }) | null; // 샘플 기록·사람이 넣은 장소
  // 지평선 위 두 방향과 하늘 쪽 아무 방향 (J2000 단위 벡터, 사진 좌표를 풀이로 되돌린 것)
  horizon?: { a: Point3D; b: Point3D; sky: Point3D } | null;
  stars?: Point3D[]; // 사진에 담긴(지평선 위에 보인) 별 방향
  // 시간대까지 아는 촬영 순간. 시간대를 추정한 시각은 넣지 않는다 (1시간 틀리면 경도가 15° 틀린다)
  utc?: Date | null;
}

const D = Math.PI / 180;
const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// 천정(J2000)과 촬영 순간(UTC) → 경도. 천정의 적경이 그 순간 그곳의 지방 항성시다.
// 항성시는 그날 춘분점 기준이라 천정도 그날 기준으로 바꿔서 잰다 (2024년이면 약 0.3° 차이).
export const lonFromZenith = (zenith: Point3D, utc: Date): number => {
  const jd = julianDay(utc);
  const lstDeg = skyClockOf(j2000ToOfDate(zenith, jd)).lstDeg;

  return wrap180(lstDeg - gmstDeg(jd));
};

export const REGION_STEP_DEG = 2;
// 대기 굴절로 지평선 바로 아래 별도 0.5°쯤 떠 보인다
export const STAR_MIN_ALT_DEG = -0.5;
// 별이 찍힐 만큼 어두운 하늘: 해가 지평선 아래 12° (항해 박명이 끝날 때)
export const DARK_SUN_ALT_DEG = -12;

// 그 순간(UTC) 별(J2000 방향)이 모두 STAR_MIN_ALT_DEG 위에 있고 해가 DARK_SUN_ALT_DEG 아래인 곳.
// 칸 가운데에서만 따진다 (2°면 칸 끝에서 1°쯤 어긋날 수 있다). 맞는 칸이 없으면 null.
export const regionFromStarsAtTime = (
  stars: Point3D[],
  utc: Date,
  stepDeg = REGION_STEP_DEG,
): EarthRegion | null => {
  if (stars.length === 0 || Number.isNaN(utc.getTime())) {
    return null;
  }

  const jd = julianDay(utc);
  const gmst = gmstDeg(jd);
  // 항성시는 그날 춘분점 기준이라 별도 그날 기준으로 바꾼다. 해 공식은 이미 그날 기준이다
  const toBody = (v: Point3D) => ({
    sinDec: v[2],
    cosDec: Math.hypot(v[0], v[1]),
    raDeg: Math.atan2(v[1], v[0]) / D,
  });
  const bodies = stars.map((v) => toBody(j2000ToOfDate(v, jd)));
  const sun = toBody(sunVector(jd));
  const minStar = Math.sin(STAR_MIN_ALT_DEG * D);
  const maxSun = Math.sin(DARK_SUN_ALT_DEG * D);
  const sinAlt = (
    b: ReturnType<typeof toBody>,
    sinLat: number,
    cosLat: number,
    lstDeg: number,
  ) => sinLat * b.sinDec + cosLat * b.cosDec * Math.cos((lstDeg - b.raDeg) * D);

  const cells: [number, number][] = [];
  const lonUsed = new Set<number>();
  let area = 0;
  let total = 0;
  const c: Point3D = [0, 0, 0];

  for (let lat = -90 + stepDeg / 2; lat < 90; lat += stepDeg) {
    const sinLat = Math.sin(lat * D);
    const cosLat = Math.cos(lat * D);

    for (let i = 0, lon = -180 + stepDeg / 2; lon < 180; i++, lon += stepDeg) {
      total += cosLat;
      const lst = gmst + lon;

      if (
        sinAlt(sun, sinLat, cosLat, lst) >= maxSun ||
        bodies.some((b) => sinAlt(b, sinLat, cosLat, lst) <= minStar)
      ) {
        continue;
      }

      cells.push([lat, lon]);
      lonUsed.add(i);
      area += cosLat;
      c[0] += cosLat * cosLat * Math.cos(lon * D);
      c[1] += cosLat * cosLat * Math.sin(lon * D);
      c[2] += cosLat * sinLat;
    }
  }

  if (cells.length === 0) {
    return null;
  }

  const lats = cells.map(([lat]) => lat);

  return {
    stepDeg,
    cells,
    latRange: [
      Math.max(-90, Math.min(...lats) - stepDeg / 2),
      Math.min(90, Math.max(...lats) + stepDeg / 2),
    ],
    lonRange: lonRangeOf(lonUsed, stepDeg),
    center: {
      latDeg: Math.atan2(c[2], Math.hypot(c[0], c[1])) / D,
      lonDeg: Math.atan2(c[1], c[0]) / D,
    },
    areaShare: area / total,
  };
};

// 쓰인 경도 칸들을 감싸는 가장 짧은 구간: 비어 있는 가장 긴 구간의 반대쪽
const lonRangeOf = (
  used: Set<number>,
  stepDeg: number,
): [number, number] | null => {
  const n = Math.round(360 / stepDeg);

  if (used.size >= n) {
    return null;
  }

  // 가장 긴 빈 구간 [gapStart, gapStart + gapLength)
  let gapStart = 0;
  let gapLength = 0;

  for (let i = 0; i < n; i++) {
    if (used.has(i) || !used.has((i - 1 + n) % n)) {
      continue;
    }

    let length = 0;

    while (!used.has((i + length) % n)) {
      length++;
    }

    if (length > gapLength) {
      gapStart = i;
      gapLength = length;
    }
  }

  const west = (gapStart + gapLength) % n;
  const east = (gapStart - 1 + n) % n;

  return [-180 + west * stepDeg, -180 + (east + 1) * stepDeg];
};

// 그 위도·경도가 영역 안인가 (그 자리를 담은 칸이 영역에 있는가)
export const regionContains = (
  region: EarthRegion,
  latDeg: number,
  lonDeg: number,
): boolean =>
  region.cells.some(
    ([lat, lon]) =>
      Math.abs(lat - latDeg) <= region.stepDeg / 2 &&
      Math.abs(wrap180(lon - lonDeg)) <= region.stepDeg / 2,
  );

// 지평선을 손으로 찍는 오차를 띠로 보여 준다 (1~2°쯤 기울어도 위도가 그만큼 움직인다)
export const HORIZON_LAT_TOLERANCE_DEG = 2;

const decOf = (v: Point3D) => Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;

// 적위 δ인 별이 위도 φ에서 지평선 위로 올라오려면 δ > φ − 90 이고 δ < φ + 90 이어야 한다
// (남쪽 끝 별은 남쪽 하늘 지평선 위에, 북쪽 끝 별은 북쪽 하늘 지평선 위에).
// 모든 별을 만족하는 위도: maxDec − 90 < φ < minDec + 90.
export const latRangeFromStars = (
  stars: Point3D[],
): [number, number] | null => {
  if (stars.length === 0) {
    return null;
  }

  const decs = stars.map(decOf);

  return [
    Math.max(-90, Math.max(...decs) - 90),
    Math.min(90, Math.min(...decs) + 90),
  ];
};

export const whereShot = (input: WhereInputs): WhereShot | null => {
  if (input.exif) {
    return {
      source: "exif",
      estimated: false,
      latDeg: input.exif.latDeg,
      lonDeg: input.exif.lonDeg,
    };
  }

  if (input.place) {
    return {
      source: input.place.source,
      estimated: false,
      latDeg: input.place.latDeg,
      lonDeg: input.place.lonDeg,
    };
  }

  const h = input.horizon;
  const zenith = h ? zenithFromHorizon(h.a, h.b, h.sky) : null;

  if (zenith) {
    const latDeg = skyClockOf(zenith).latDeg;
    const utc =
      input.utc && !Number.isNaN(input.utc.getTime()) ? input.utc : null;

    return {
      source: "horizon",
      estimated: true,
      latDeg,
      latRange: [
        Math.max(-90, latDeg - HORIZON_LAT_TOLERANCE_DEG),
        Math.min(90, latDeg + HORIZON_LAT_TOLERANCE_DEG),
      ],
      lonDeg: utc ? lonFromZenith(zenith, utc) : null,
      ...(utc && { lonFromTime: true }),
    };
  }

  const region =
    input.utc && input.stars
      ? regionFromStarsAtTime(input.stars, input.utc)
      : null;

  if (region) {
    return {
      source: "starsTime",
      estimated: true,
      latRange: region.latRange,
      lonDeg: null,
      region,
    };
  }

  // 시각을 모르거나, 그 시각에 별이 모두 떠 있는 곳이 없으면(시각이 틀렸다) 위도 범위만
  const latRange = latRangeFromStars(input.stars ?? []);

  return latRange
    ? { source: "stars", estimated: true, latRange, lonDeg: null }
    : null;
};

// 북위/남위·동경/서경 (앱의 다른 곳과 같은 말)
export const latText = (latDeg: number, digits = 0) =>
  `${latDeg >= 0 ? "북위" : "남위"} ${Math.abs(latDeg).toFixed(digits)}°`;

export const lonText = (lonDeg: number, digits = 0) =>
  `${lonDeg >= 0 ? "동경" : "서경"} ${Math.abs(lonDeg).toFixed(digits)}°`;
