import type { Cloud, Mountain } from "@/game/sky/drawSky";
import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { isLand } from "@/game/geo/world";
import { constellationCenter, constellationParts } from "@/game/sky/catalog";
import {
  altAzOf,
  julianDay,
  localSiderealDeg,
  sunVector,
} from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

// SkyGuessr (docs/game-plans.md): 밤하늘 사진 한 장(360°로 둘러볼 수 있다)과 촬영 순간의 세계 공통 시각(UTC)만 보고
// 찍은 곳을 세계 지도에 핀으로 찍는다. 정답과의 거리로 점수.
//
// 왜 UTC만 주나: 별 배치는 위도와 그곳의 별시각(지방 항성시)으로만 정해지는데, 별시각과 현지 시각은 둘 다
// "세계 공통 시각 + 경도"다. 그래서 현지 시각을 주면 같은 위도는 어디나 같은 하늘이라 경도를 알 수 없고,
// 둘 다 주면 계산으로 답이 나온다. UTC만 주면 하늘에서 현지 시각을 읽어(노을·새벽빛, 남중 별자리, 북두칠성 시계)
// 낮밤 지도의 그 시각인 곳을 찾아야 한다 — 크로노미터로 경도를 구하던 항해사와 같다. 위도는 천구의 극 높이 등.
// 달은 실제 위치에 그리지만 풀이에는 쓰지 않는다 (숙련자용 숨은 단서: 달 거리법).

// 입문: 쉬움과 같은 하늘에, 길잡이(guide.ts)가 단서를 하나씩 같이 찾는다
export type GeoDifficulty = "intro" | "easy" | "normal" | "hard";
export type SkyTime = "dusk" | "night" | "dawn"; // 노을이 남은 저녁, 한밤, 동트기 전

export interface GeoSettings {
  compass: boolean; // 하늘에 동서남북
  seasonCard: boolean; // 계절 별자리 카드를 처음부터 준다
  timeBands: boolean; // 지도에 현지 시각 띠와 숫자
  hoverTime: boolean; // 지도 위 커서 자리의 현지 시각
  magLimit: number;
  lightPollution: number;
  mountainCount: number;
  // 산이 천구의 극 쪽을 가릴 확률
  hidePoleChance: number;
  cloudCount: number;
  // 저녁·한밤·새벽 문제 비율 (단서의 쉬움)
  timeWeights: Record<SkyTime, number>;
}

export const GEO_SETTINGS: Record<GeoDifficulty, GeoSettings> = {
  intro: {
    compass: true,
    seasonCard: true,
    timeBands: true,
    hoverTime: true,
    magLimit: 5,
    lightPollution: 0.1,
    mountainCount: 0,
    hidePoleChance: 0,
    cloudCount: 0,
    timeWeights: { dusk: 0.4, night: 0.3, dawn: 0.3 },
  },
  easy: {
    compass: true,
    seasonCard: true,
    timeBands: true,
    hoverTime: true,
    magLimit: 5,
    lightPollution: 0.1,
    mountainCount: 0,
    hidePoleChance: 0,
    cloudCount: 0,
    timeWeights: { dusk: 0.4, night: 0.3, dawn: 0.3 },
  },
  normal: {
    compass: true,
    seasonCard: true,
    timeBands: false,
    hoverTime: true,
    magLimit: 4.8,
    lightPollution: 0.25,
    mountainCount: 1,
    hidePoleChance: 0.3,
    cloudCount: 2,
    timeWeights: { dusk: 0.25, night: 0.5, dawn: 0.25 },
  },
  hard: {
    compass: false,
    seasonCard: false,
    timeBands: false,
    hoverTime: false,
    magLimit: 4.3,
    lightPollution: 0.45,
    mountainCount: 2,
    hidePoleChance: 0.5,
    cloudCount: 4,
    timeWeights: { dusk: 0.15, night: 0.7, dawn: 0.15 },
  },
};

export interface GeoProblem {
  seed: number;
  difficulty: GeoDifficulty;
  date: Date; // 촬영 순간 (UTC)
  observer: Observer;
  skyTime: SkyTime;
  startAzimuthDeg: number;
  mountains: Mountain[];
  clouds: Cloud[];
  groundSeed: number;
}

const D = Math.PI / 180;
const YEAR = 2026;
const MAX_LAT = 62;
const MIN_LAT = -50;

const sunAltAt = (date: Date, observer: Observer) => {
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, observer).altDeg;
};

// 그 날 그 곳에서 skyTime에 맞는 순간 (5분 간격으로 하루를 훑는다). 없으면 null
const momentFor = (
  day: number,
  observer: Observer,
  skyTime: SkyTime,
  rng: () => number,
): Date | null => {
  // 현지 정오부터 다음 날 정오까지
  const noon =
    Date.UTC(YEAR, 0, 1) +
    day * 86400000 +
    (12 - observer.lonDeg / 15) * 3600000;
  const ok: Date[] = [];

  for (let m = 0; m < 24 * 60; m += 5) {
    const t = new Date(noon + m * 60000);
    const alt = sunAltAt(t, observer);
    const evening = m < 12 * 60;

    if (
      (skyTime === "night" && alt < -18) ||
      (skyTime === "dusk" && evening && alt < -6 && alt > -11) ||
      (skyTime === "dawn" && !evening && alt < -6 && alt > -11)
    ) {
      ok.push(t);
    }
  }

  return ok.length ? ok[Math.floor(rng() * ok.length)] : null;
};

const pick = <T extends string>(weights: Record<T, number>, r: number): T => {
  let acc = 0;
  const keys = Object.keys(weights) as T[];

  for (const k of keys) {
    acc += weights[k];

    if (r < acc) {
      return k;
    }
  }

  return keys[keys.length - 1];
};

// 문제 만들기: 땅 위 아무 곳, 2026년 아무 날, 고른 하늘 때(저녁·한밤·새벽)
export const makeGeoProblem = (
  seed: number,
  difficulty: GeoDifficulty,
): GeoProblem => {
  const rng = createRng(seed);
  const set = GEO_SETTINGS[difficulty];

  for (;;) {
    const lat = MIN_LAT + rng() * (MAX_LAT - MIN_LAT);
    const lon = -180 + rng() * 360;

    if (!isLand(lat, lon)) {
      continue;
    }

    const observer = { latDeg: lat, lonDeg: lon };
    const skyTime = pick(set.timeWeights, rng());
    const day = Math.floor(rng() * 365);
    const date = momentFor(day, observer, skyTime, rng);

    if (!date) {
      continue; // 백야처럼 그 날 그 때가 없다
    }

    const poleAz = lat >= 0 ? 0 : 180;
    const mountains: Mountain[] = Array.from(
      { length: set.mountainCount },
      (_, i) => ({
        azDeg:
          i === 0 && rng() < set.hidePoleChance
            ? poleAz + (rng() - 0.5) * 20
            : rng() * 360,
        widthDeg: 25 + rng() * 35,
        // 극을 가리려면 극 높이(=|위도|)보다 조금 높게
        heightDeg: Math.min(40, Math.abs(lat) + 4 + rng() * 6),
      }),
    ).map((m, i) =>
      i === 0 || rng() < 0.5 ? m : { ...m, heightDeg: 4 + rng() * 10 },
    );
    const clouds: Cloud[] = Array.from({ length: set.cloudCount }, () => ({
      azDeg: rng() * 360,
      altDeg: 15 + rng() * 50,
      sizeDeg: 10 + rng() * 18,
      seed: Math.floor(rng() * 1e9),
    }));

    return {
      seed,
      difficulty,
      date,
      observer,
      skyTime,
      startAzimuthDeg: rng() * 360,
      mountains,
      clouds,
      groundSeed: Math.floor(rng() * 1e9),
    };
  }
};

// ---------- 점수 ----------

const EARTH_KM = 6371;

export const distanceKm = (
  a: { latDeg: number; lonDeg: number },
  b: { latDeg: number; lonDeg: number },
) => {
  const h =
    Math.sin(((b.latDeg - a.latDeg) * D) / 2) ** 2 +
    Math.cos(a.latDeg * D) *
      Math.cos(b.latDeg * D) *
      Math.sin(((b.lonDeg - a.lonDeg) * D) / 2) ** 2;

  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const MAX_ROUND_POINTS = 5000;
// GeoGuessr처럼 거리에 따라 지수로 줄어든다 (1,500km마다 약 1/e)
const POINT_SCALE_KM = 1500;

export const pointsFor = (km: number, penalty: number) =>
  Math.round(
    MAX_ROUND_POINTS *
      Math.exp(-km / POINT_SCALE_KM) *
      Math.max(0, 1 - penalty),
  );

// 힌트(점수에서 깎는 비율)
export const HINT_COSTS = {
  timelapse: 0.15, // 별 궤적 (극의 자리를 알려 준다)
  seasonCard: 0.1, // 어려움에서 계절 별자리 카드
  compass: 0.1, // 어려움에서 동서남북
  localClock: 0.3, // "현지 시계로 밤 10시쯤"
} as const;

export type HintKey = keyof typeof HINT_COSTS;

// ---------- 풀이 설명 ----------

// 현지 평균시 (분, 0~1439)
export const localMinutes = (date: Date, lonDeg: number) =>
  (((date.getUTCHours() * 60 + date.getUTCMinutes() + (lonDeg / 15) * 60) %
    1440) +
    1440) %
  1440;

export const clockLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

// 계절 별자리 카드: 달마다 15일 자정에 하늘 한가운데(정남, 남반구는 정북)에 오는 잘 알려진 별자리.
// 달마다 다른 별자리가 되게 골라 두고, 실제로 그 무렵(±1.5시간) 한가운데인지 테스트로 확인한다.
export const SEASON_CARD = [
  "쌍둥이자리",
  "게자리",
  "사자자리",
  "처녀자리",
  "천칭자리",
  "전갈자리",
  "독수리자리",
  "염소자리",
  "페가수스자리",
  "안드로메다자리",
  "황소자리",
  "오리온자리",
].map((label, m) => ({ month: m + 1, label }));

// 그 달 15일 현지 자정의 별시각(°): 해의 적경 + 180°
export const midnightLstDeg = (month: number) => {
  const jd = julianDay(new Date(Date.UTC(YEAR, month - 1, 15, 0)));

  return (raOf(sunVector(jd)) + 180) % 360;
};

const raOf = (v: Point3D) => (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360;

export const constellationRaDeg = (label: string) =>
  raOf(constellationCenter(constellationParts(label)));

const MERIDIAN_CANDIDATES = [
  ...SEASON_CARD.map((c) => c.label),
  "목동자리",
  "궁수자리",
  "백조자리",
  "물고기자리",
  "큰개자리",
];
const CANDIDATE_RA = MERIDIAN_CANDIDATES.map((label) => ({
  label,
  ra: constellationRaDeg(label),
}));

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

// 별시각(°)에 하늘 한가운데에 가장 가까운 잘 알려진 별자리
export const meridianConstellation = (lstDeg: number) =>
  CANDIDATE_RA.reduce((best, c) =>
    Math.abs(wrap180(c.ra - lstDeg)) < Math.abs(wrap180(best.ra - lstDeg))
      ? c
      : best,
  ).label;

export interface Explanation {
  poleAltitudeDeg: number;
  poleName: string;
  localClock: string;
  utcClock: string;
  hourOffset: number; // 현지 - UTC (시간)
  meridian: string; // 그 순간 정남(남반구는 정북)에 가까운 별자리
  skyTime: SkyTime;
}

export const explain = (p: GeoProblem): Explanation => {
  const local = localMinutes(p.date, p.observer.lonDeg);
  const utc = p.date.getUTCHours() * 60 + p.date.getUTCMinutes();
  const lst = localSiderealDeg(julianDay(p.date), p.observer);

  return {
    poleAltitudeDeg: Math.abs(p.observer.latDeg),
    poleName: p.observer.latDeg >= 0 ? "천구의 북극(북극성 곁)" : "천구의 남극",
    localClock: clockLabel(local),
    utcClock: clockLabel(utc),
    hourOffset: p.observer.lonDeg / 15,
    meridian: meridianConstellation(lst),
    skyTime: p.skyTime,
  };
};
