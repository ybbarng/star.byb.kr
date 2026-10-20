import type { HorizonView } from "@/search/horizonSolve";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import { horizonCameraTP } from "@/search/horizonSolve";
import { altAzOf, julianDay, sunVector } from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

// 별하늘 지오게서의 문제: 아무 위도·밤 시각·카메라 방향에서 본 하늘. 정답(위도·날짜·현지 시각)을 함께 갖는다.
// 같은 시드면 같은 문제다 ("오늘의 문제"는 날짜를 시드로 쓴다).

export type Difficulty = "easy" | "normal" | "hard";

export interface GuessrScene {
  seed: number;
  difficulty: Difficulty;
  date: Date; // 촬영 순간 (UTC)
  observer: Observer;
  view: HorizonView;
  width: number;
  height: number;
  TP: Mat3;
  magLimit: number; // 보이는 가장 어두운 별 등급
  lightPollution: number; // 지평선 쪽 광해 세기 0~1
}

export const SCENE_WIDTH = 1280;
export const SCENE_HEIGHT = 800;

// 난이도별: 보이는 별 등급, 광해
const DIFFICULTY = {
  easy: { magLimit: 5, lightPollution: 0.15 },
  normal: { magLimit: 4.5, lightPollution: 0.35 },
  hard: { magLimit: 3.3, lightPollution: 0.7 },
} as const;

// 해가 이보다 낮아야 밤으로 친다 (천문 박명이 끝나 가는 정도)
const NIGHT_SUN_ALT_DEG = -15;

export const makeGuessrScene = (
  seed: number,
  difficulty: Difficulty,
): GuessrScene => {
  const rng = createRng(seed);
  let date: Date;
  let observer: Observer;

  // 사람이 사는 위도 범위의 밤
  for (;;) {
    date = new Date(Date.UTC(2025, 0, 1) + rng() * 3 * 365 * 86400000);
    observer = { latDeg: -50 + rng() * 115, lonDeg: -180 + rng() * 360 };
    const jd = julianDay(date);

    if (altAzOf(sunVector(jd), jd, observer).altDeg < NIGHT_SUN_ALT_DEG) {
      break;
    }
  }

  const fovDeg = 50 + rng() * 25;
  // 지평선이 사진 아래쪽 1/5~1/3 높이에 오게 광축을 든다
  const view: HorizonView = {
    azimuthDeg: rng() * 360,
    altitudeDeg: fovDeg * (0.17 + rng() * 0.15),
    rollDeg: (rng() - 0.5) * 3,
    fovDeg,
  };

  return {
    seed,
    difficulty,
    date,
    observer,
    view,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    TP: horizonCameraTP(date, observer, view, SCENE_WIDTH, SCENE_HEIGHT),
    ...DIFFICULTY[difficulty],
  };
};

// 오늘의 문제: 같은 날이면 누구에게나 같은 시드
export const dailySeed = (today = new Date()) =>
  today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

// 현지 평균 태양시 (경도 15°마다 1시간). 하늘은 경도와 상관없이 위도와 현지 시각으로 정해진다.
export const localMeanTime = (date: Date, lonDeg: number) =>
  new Date(date.getTime() + (lonDeg / 15) * 3600000);
