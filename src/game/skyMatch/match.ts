import type { SkyScene } from "@/game/sky/scene";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { localMeanTime } from "@/game/sky/scene";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 하늘 맞추기 퍼즐: 정답 사진의 밝은 별 자리(유령 고리)에, 다이얼(위도·날짜·시각)로 움직이는 "내 하늘"의 같은
// 별이 얼마나 들어왔는지로 일치도를 잰다. 같은 하늘이면 날짜·시각 조합이 달라도 일치한다 (한 달에 2시간).

export interface TargetStar {
  vector: Point3D;
  at: Point2D; // 정답 사진에서의 위치
  mag: number;
}

export const TARGET_COUNT = 25;
// 별 하나를 맞춘 것으로 보는 거리 (사진 짧은 변 대비)
export const MATCH_TOLERANCE = 0.025;
// 이만큼 맞으면 성공
export const SOLVED_RATIO = 0.8;

// 정답 사진에 보이는 밝은 별들 (지평선 바로 위는 빼서 경계에서 흔들리지 않게)
export const targetStars = (
  scene: SkyScene,
  stars: { vector: Point3D; mag: number }[],
): TargetStar[] => {
  const frame = horizontalFrameJ2000(julianDay(scene.date), scene.observer);
  const out: TargetStar[] = [];

  for (const s of [...stars].sort((a, b) => a.mag - b.mag)) {
    const z = frame.zenith;
    const altSin = s.vector[0] * z[0] + s.vector[1] * z[1] + s.vector[2] * z[2];

    if (altSin < Math.sin((3 * Math.PI) / 180)) {
      continue;
    }

    const p = projectVecToPhoto(scene.TP, s.vector);

    if (
      p &&
      p[0] > 20 &&
      p[0] < scene.width - 20 &&
      p[1] > 20 &&
      p[1] < scene.height - 20
    ) {
      out.push({ vector: s.vector, at: p, mag: s.mag });

      if (out.length >= TARGET_COUNT) {
        break;
      }
    }
  }

  return out;
};

// 내 하늘의 변환으로 정답 별마다 맞았는지
export const matchedFlags = (
  targets: TargetStar[],
  playerTP: Mat3,
  scene: SkyScene,
): boolean[] => {
  const tol = MATCH_TOLERANCE * Math.min(scene.width, scene.height);

  return targets.map((t) => {
    const p = projectVecToPhoto(playerTP, t.vector);

    return p !== null && Math.hypot(p[0] - t.at[0], p[1] - t.at[1]) <= tol;
  });
};

// 다이얼 값(그 해의 몇째 날, 현지 시각 분) → 그 순간 (UTC)
export const dialDate = (
  scene: SkyScene,
  dayOfYear: number,
  minutes: number,
): Date => {
  const year = localMeanTime(
    scene.date,
    scene.observer.lonDeg,
  ).getUTCFullYear();
  const local = Date.UTC(year, 0, 1) + dayOfYear * 86400000 + minutes * 60000;

  return new Date(local - (scene.observer.lonDeg / 15) * 3600000);
};

// 정답의 다이얼 값 (풀이 화면·테스트용)
export const answerDials = (scene: SkyScene) => {
  const local = localMeanTime(scene.date, scene.observer.lonDeg);
  const start = Date.UTC(local.getUTCFullYear(), 0, 1);
  const ms = local.getTime() - start;

  return {
    latDeg: scene.observer.latDeg,
    dayOfYear: Math.floor(ms / 86400000),
    minutes: Math.round((ms % 86400000) / 60000),
  };
};
