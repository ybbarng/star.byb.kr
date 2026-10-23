import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { STARS } from "@/game/sky/catalog";
import { altOf, azOf, frameAt, sunAt } from "@/game/tonight/report";
import { localToUtc } from "@/game/tonight/time";

// 별자리 익히기에서 같이 쓰는 하늘 계산: 별 번호(HR) → 방향, 적경·적위 → 방향, 장소 시각 → 고도·방위.
// 해·별의 위치는 오늘 밤 내 하늘과 같은 계산(J2000 → 그 시각 수평 좌표)을 쓴다.

const D = Math.PI / 180;

export const STAR_BY_HR = new Map(STARS.map((s) => [s.hr, s]));

export const hrVector = (hr: string): Point3D => {
  const s = STAR_BY_HR.get(hr);

  if (!s) {
    throw new Error(`카탈로그에 없는 별 HR ${hr}`);
  }

  return s.vector;
};

export const raDecVector = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

export const raDecOf = (v: Point3D) => ({
  raDeg: (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360,
  decDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
});

export const normalize = (v: number[]): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / n, v[1] / n, v[2] / n];
};

export const centerOf = (vs: Point3D[]): Point3D =>
  normalize(
    vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]),
  );

export const separationDeg = (a: Point3D, b: Point3D) =>
  Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) / D;

// 장소와 그곳 시계의 시각
export interface SkyPlace {
  name: string;
  latDeg: number;
  lonDeg: number;
  tz: string;
}

export interface LocalTime {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

export const SEOUL_PLACE: SkyPlace = {
  name: "서울",
  latDeg: 37.57,
  lonDeg: 126.98,
  tz: "Asia/Seoul",
};

export const SYDNEY_PLACE: SkyPlace = {
  name: "시드니",
  latDeg: -33.87,
  lonDeg: 151.21,
  tz: "Australia/Sydney",
};

export const YEONGYANG_PLACE: SkyPlace = {
  name: "영양 (반딧불이 밤하늘 보호공원)",
  latDeg: 36.67,
  lonDeg: 129.12,
  tz: "Asia/Seoul",
};

export const dateAt = (place: SkyPlace, t: LocalTime) =>
  new Date(localToUtc(t.y, t.m, t.d, t.h, t.min, place.tz));

export const observerOf = (place: SkyPlace): Observer => ({
  latDeg: place.latDeg,
  lonDeg: place.lonDeg,
});

// 그 장소·순간에서 방향 v의 고도·방위
export const altAzAt = (v: Point3D, date: Date, observer: Observer) => {
  const frame = frameAt(date.getTime(), observer);

  return { altDeg: altOf(v, frame), azDeg: azOf(v, frame) };
};

export const sunAltAt = (date: Date, observer: Observer) =>
  altOf(sunAt(date.getTime()), frameAt(date.getTime(), observer));

const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

export const directionWord = (azDeg: number) =>
  DIRECTIONS[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];

// 받침에 따라 조사를 고른다 (을/를, 이/가, 은/는, 과/와)
export const josa = (word: string, withB: string, withoutB: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;

  return word + (code >= 0 && code < 11172 && code % 28 > 0 ? withB : withoutB);
};

// "5월 15일 밤 10시" (자정 넘은 시각은 그 날짜 그대로 "5월 16일 새벽 1시")
export const timeLabel = (t: LocalTime) => {
  const part =
    t.h === 0
      ? "밤 12시"
      : t.h < 6
        ? `새벽 ${t.h}시`
        : t.h < 12
          ? `아침 ${t.h}시`
          : t.h < 18
            ? `낮 ${t.h === 12 ? 12 : t.h - 12}시`
            : t.h < 21
              ? `저녁 ${t.h - 12}시`
              : `밤 ${t.h - 12}시`;

  return `${t.m}월 ${t.d}일 ${part}${t.min ? ` ${t.min}분` : ""}`;
};
