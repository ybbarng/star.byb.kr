import type { Shadow, SunPlace } from "@/game/shadow/shadow";
import {
  altitudeFromShadow,
  dayDate,
  dayLight,
  shadowOf,
  sunAt,
  sunDeclinationDeg,
} from "@/game/shadow/shadow";
import { createRng } from "@/utils/rng";

// 그림자 시계 (docs/game-plans.md): 땅에 세운 막대와 그 그림자(지금 그림자, 정오 그림자 자국)만 보고
// 위도·날짜(계절)·해시계 시각을 맞힌다.
// 정오 그림자 길이 → 정오 해 높이 → |위도 − 적위|, 그림자 끝 곡선의 점 개수(낮 길이) → 적위의 부호·크기,
// 지금 그림자가 정오 그림자에서 돌아간 쪽과 각 → 시각.

export type ShadowDifficulty = "intro" | "easy" | "normal";

export interface ShadowSettings {
  dateGiven: boolean; // 날짜를 알려 준다 (맞힐 것: 위도·시각)
  compass: "full" | "north"; // 동서남북 모두, 북쪽 화살표만
  rings: boolean; // 막대 길이 눈금 고리
  curveFree: boolean; // 그림자 끝 곡선을 처음부터 보여 준다
}

export const SHADOW_SETTINGS: Record<ShadowDifficulty, ShadowSettings> = {
  intro: { dateGiven: true, compass: "full", rings: true, curveFree: true },
  easy: { dateGiven: false, compass: "full", rings: true, curveFree: true },
  normal: {
    dateGiven: false,
    compass: "north",
    rings: false,
    curveFree: false,
  },
};

export const CURVE_HINT_COST = 0.25;

export interface ShadowProblem {
  seed: number;
  difficulty: ShadowDifficulty;
  latDeg: number;
  day: number; // 2026년 몇 번째 날 (0 = 1월 1일)
  solarHours: number; // 해시계 시각
  decDeg: number; // 그 날 해의 적위
  sun: SunPlace;
  shadow: Shadow;
  noonSun: SunPlace;
  noonShadow: Shadow;
}

const LAT_RANGE: Record<ShadowDifficulty, [number, number]> = {
  intro: [-40, 60],
  easy: [-50, 62],
  normal: [-55, 65],
};

// 문제 만들기: 위도·날짜·시각을 고르고, 그림자가 읽기 좋은 것만 (정오 해 높이 15~86°,
// 지금 해 높이 14° 이상, 정오와 30분 넘게 떨어진 때, 백야·극야 근처는 뺀다)
export const makeShadowProblem = (
  seed: number,
  difficulty: ShadowDifficulty,
): ShadowProblem => {
  const rng = createRng(seed);
  const [lo, hi] = LAT_RANGE[difficulty];

  for (;;) {
    const latDeg = Math.round(lo + rng() * (hi - lo));
    const day = Math.floor(rng() * 365);
    const solarHours = Math.round((7 + rng() * 10) * 6) / 6;
    const decDeg = sunDeclinationDeg(dayDate(day));
    const light = dayLight(latDeg, decDeg);

    if (light.hours < 6 || light.hours > 18) {
      continue;
    }

    if (Math.abs(solarHours - 12) < 0.5) {
      continue;
    }

    const noonSun = sunAt(latDeg, day, 12);
    const sun = sunAt(latDeg, day, solarHours);

    if (noonSun.altDeg < 15 || noonSun.altDeg > 86 || sun.altDeg < 14) {
      continue;
    }

    return {
      seed,
      difficulty,
      latDeg,
      day,
      solarHours,
      decDeg,
      sun,
      shadow: shadowOf(sun)!,
      noonSun,
      noonShadow: shadowOf(noonSun)!,
    };
  }
};

// ---------- 점수 ----------

export interface ShadowGuess {
  latDeg: number;
  day: number;
  solarHours: number;
}

export const ROUND_POINTS = { lat: 400, season: 300, time: 300 };

export interface ShadowScore {
  latErrDeg: number;
  decErrDeg: number; // 날짜는 적위 차이로 잰다 (봄·가을 같은 적위의 날은 둘 다 정답)
  timeErrMin: number;
  lat: number;
  season: number;
  time: number;
  total: number;
}

export const scoreShadow = (
  p: ShadowProblem,
  g: ShadowGuess,
  penalty = 0,
): ShadowScore => {
  const latErrDeg = Math.abs(g.latDeg - p.latDeg);
  const decErrDeg = SHADOW_SETTINGS[p.difficulty].dateGiven
    ? 0
    : Math.abs(sunDeclinationDeg(dayDate(g.day)) - p.decDeg);
  const timeErrMin = Math.abs(g.solarHours - p.solarHours) * 60;
  const k = 1 - penalty;
  const lat = Math.round(ROUND_POINTS.lat * Math.exp(-latErrDeg / 8) * k);
  const season = Math.round(ROUND_POINTS.season * Math.exp(-decErrDeg / 4) * k);
  const time = Math.round(ROUND_POINTS.time * Math.exp(-timeErrMin / 45) * k);

  return {
    latErrDeg,
    decErrDeg,
    timeErrMin,
    lat,
    season,
    time,
    total: lat + season + time,
  };
};

// ---------- 풀이 설명 ----------

export interface ShadowExplanation {
  noonLength: number; // 정오 그림자 길이 (막대의 몇 배)
  noonAltDeg: number; // 그 길이로 구한 정오 해 높이
  zenithGapDeg: number; // 90° − 해 높이 = |위도 − 적위|
  noonPointsNorth: boolean; // 정오 그림자가 북쪽을 가리킨다 = 해가 남쪽 = 위도 > 적위
  dayHours: number; // 낮 길이
  sunrise: number;
  sunset: number;
  turnDeg: number; // 지금 그림자가 정오 그림자에서 돌아간 각 (+ 시계 방향)
  morning: boolean;
}

export const explainShadow = (p: ShadowProblem): ShadowExplanation => {
  const noonLength = p.noonShadow.length;
  const noonAltDeg = altitudeFromShadow(noonLength);
  const light = dayLight(p.latDeg, p.decDeg);
  const turn =
    ((((p.shadow.azDeg - p.noonShadow.azDeg) % 360) + 540) % 360) - 180;

  return {
    noonLength,
    noonAltDeg,
    zenithGapDeg: 90 - noonAltDeg,
    noonPointsNorth: Math.cos(p.noonShadow.azDeg * (Math.PI / 180)) > 0,
    dayHours: light.hours,
    sunrise: light.sunrise,
    sunset: light.sunset,
    turnDeg: turn,
    morning: p.solarHours < 12,
  };
};

export const latLabel = (latDeg: number) =>
  latDeg === 0
    ? "적도 0°"
    : `${latDeg > 0 ? "북위" : "남위"} ${Math.abs(Math.round(latDeg))}°`;
