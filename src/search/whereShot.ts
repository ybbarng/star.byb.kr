import type { Point3D } from "@/scripts/hash/types";
import { skyClockOf, zenithFromHorizon } from "@/search/shotTimeEstimate";
import { gmstDeg, j2000ToOfDate, julianDay } from "@/search/utils/ephemeris";

// 풀린 사진으로 "어디서 찍었을까?"를 답한다. 아는 만큼만: 위도는 가로선(또는 띠), 경도는 세로선.
// 하늘만으로는 경도를 알 수 없다 (같은 하늘이 경도마다 다른 시각에 온다 → 정확한 UTC 시각이 있어야 한다).
// 그래서 lonDeg는 모르면 null로 둔다. 시간대까지 아는 촬영 시각(utc)이 있으면 채운다.
//
// 출처 우선순위 (앞의 것이 있으면 뒤는 보지 않는다)
// 1. exif: 사진의 GPS → 위도·경도 그대로
// 2. record·manual: 샘플 기록이나 사람이 넣은 장소 → 위도·경도
// 3. horizon: 지평선 두 점 → 천정 → 천정의 적위가 위도 (ShotTimeEstimator와 같은 계산).
//    촬영 순간(UTC)을 알면 천정의 적경(지방 항성시) − 그리니치 항성시 = 경도
// 4. stars: 사진에 담긴 별들이 모두 지평선 위에 있으려면 위도가 어느 범위여야 하는가

export type WhereSource = "exif" | "record" | "manual" | "horizon" | "stars";

export interface WhereShot {
  source: WhereSource;
  estimated: boolean; // 하늘에서 추정한 값 (사진·사람이 준 값이 아니다)
  latDeg?: number; // 위도를 하나로 알 때
  latRange?: [number, number]; // 위도 띠 [남, 북]: horizon은 오차 폭, stars는 가능한 범위
  lonDeg: number | null; // 모르면 null
  lonFromTime?: boolean; // 경도를 촬영 시각으로 구했다 (지평선 + 시각)
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

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// 천정(J2000)과 촬영 순간(UTC) → 경도. 천정의 적경이 그 순간 그곳의 지방 항성시다.
// 항성시는 그날 춘분점 기준이라 천정도 그날 기준으로 바꿔서 잰다 (2024년이면 약 0.3° 차이).
export const lonFromZenith = (zenith: Point3D, utc: Date): number => {
  const jd = julianDay(utc);
  const lstDeg = skyClockOf(j2000ToOfDate(zenith, jd)).lstDeg;

  return wrap180(lstDeg - gmstDeg(jd));
};

// 지평선을 손으로 찍는 오차를 띠로 보여 준다 (1~2°쯤 기울어도 위도가 그만큼 움직인다)
export const HORIZON_LAT_TOLERANCE_DEG = 2;

const D = Math.PI / 180;
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
