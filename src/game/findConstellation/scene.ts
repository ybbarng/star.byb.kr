import type { DrawConstellation } from "@/game/sky/drawSky";
import type { Difficulty } from "@/game/sky/scene";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonView } from "@/search/horizonSolve";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import {
  constellationCenter,
  constellationParts,
  uniqueStars,
} from "@/game/sky/catalog";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/game/sky/scene";
import { horizonCameraTP } from "@/search/horizonSolve";
import { nextTimeWithLst } from "@/search/shotTimeEstimate";
import {
  altAzOf,
  horizontalFrameJ2000,
  julianDay,
  moonVectorFrom,
  sunVector,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { createRng } from "@/utils/rng";

// 숨은그림찾기 문제: 찾을 별자리가 고도 25° 이상 떠 있는 밤의 하늘. 카메라는 별자리 근처로 조금 비켜서
// 향해 별자리가 사진 가운데에만 있지 않게 한다. 별자리 전체가 사진 안에 들어와야 한다.

export interface FindScene {
  target: DrawConstellation[]; // 선 묶음들
  date: Date;
  observer: Observer;
  view: HorizonView;
  TP: Mat3;
  width: number;
  height: number;
  magLimit: number;
  lightPollution: number;
  seed: number;
}

const D = Math.PI / 180;
const LOOK = {
  easy: { magLimit: 4.5, lightPollution: 0.15, fov: [65, 80] },
  normal: { magLimit: 5, lightPollution: 0.3, fov: [70, 85] },
  hard: { magLimit: 5, lightPollution: 0.5, fov: [80, 95] },
} as const;

export const makeFindScene = (
  label: string,
  seed: number,
  difficulty: Difficulty,
): FindScene | null => {
  const target = constellationParts(label);

  if (target.length === 0) {
    return null;
  }

  const rng = createRng(seed);
  const look = LOOK[difficulty];
  const center = constellationCenter(target);
  const decDeg = Math.asin(center[2]) / D;
  const raDeg = (((Math.atan2(center[1], center[0]) / D) % 360) + 360) % 360;
  const stars = uniqueStars(target);

  for (let attempt = 0; attempt < 300; attempt++) {
    // 별자리가 높이 뜰 수 있는 위도 (최대 고도 = 90° - |위도 - 적위|)
    const lo = Math.max(-50, decDeg - 55);
    const hi = Math.min(65, decDeg + 55);
    const observer = {
      latDeg: lo + rng() * (hi - lo),
      lonDeg: -180 + rng() * 360,
    };
    // 별자리가 정남(북)에서 ±2시간 안에 있을 때
    const date = nextTimeWithLst(
      raDeg + (rng() - 0.5) * 60,
      observer.lonDeg,
      new Date(Date.UTC(2025, 0, 1) + rng() * 365 * 86400000),
    );
    const jd = julianDay(date);

    if (altAzOf(sunVector(jd), jd, observer).altDeg > -15) {
      continue;
    }

    // 밝은 달이 떠 있으면 달빛이 별을 지워 찾을 수 없다. 달이 지평선 아래이거나 가는 달일 때만.
    const moon = moonVectorFrom(jd, observer);
    const sun = sunVector(jd);
    const lit =
      (1 - (moon[0] * sun[0] + moon[1] * sun[1] + moon[2] * sun[2])) / 2;

    if (altAzOf(moon, jd, observer).altDeg > -2 && lit > 0.25) {
      continue;
    }

    const frame = horizontalFrameJ2000(jd, observer);
    const dot = (a: Point3D, b: Point3D) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const alt = Math.asin(dot(center, frame.zenith)) / D;

    if (alt < 25 || stars.some((v) => dot(v, frame.zenith) < Math.sin(8 * D))) {
      continue;
    }

    const az =
      (((Math.atan2(dot(center, frame.east), dot(center, frame.north)) / D) %
        360) +
        360) %
      360;
    const fovDeg = look.fov[0] + rng() * (look.fov[1] - look.fov[0]);
    const view: HorizonView = {
      azimuthDeg: az + (rng() - 0.5) * fovDeg * 0.5,
      altitudeDeg: Math.min(
        80,
        Math.max(fovDeg * 0.3, alt + (rng() - 0.5) * fovDeg * 0.3),
      ),
      rollDeg: (rng() - 0.5) * 6,
      fovDeg,
    };
    const TP = horizonCameraTP(date, observer, view, SCENE_WIDTH, SCENE_HEIGHT);
    const inside = stars.every((v) => {
      const p = projectVecToPhoto(TP, v);

      return (
        p !== null &&
        p[0] > 40 &&
        p[0] < SCENE_WIDTH - 40 &&
        p[1] > 40 &&
        p[1] < SCENE_HEIGHT - 40
      );
    });

    if (inside) {
      return {
        target,
        date,
        observer,
        view,
        TP,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        magLimit: look.magLimit,
        lightPollution: look.lightPollution,
        seed,
      };
    }
  }

  return null;
};

// 사진 속 별자리 별 위치
export const targetPoints = (scene: FindScene): Point2D[] =>
  uniqueStars(scene.target)
    .map((v) => projectVecToPhoto(scene.TP, v))
    .filter((p): p is Point2D => p !== null);

// 누른 곳이 별자리를 감싸는 상자(조금 넓혀서) 안이면 찾은 것
export const isHit = (scene: FindScene, x: number, y: number): boolean => {
  const pts = targetPoints(scene);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 30;

  return (
    x >= Math.min(...xs) - pad &&
    x <= Math.max(...xs) + pad &&
    y >= Math.min(...ys) - pad &&
    y <= Math.max(...ys) + pad
  );
};

// 아주 큰 별자리(바다뱀자리 등)는 시드에 따라 사진 안에 다 들어오는 하늘을 못 만들 때가 있다. 시드를 바꿔 몇 번 더 해 본다.
export const makeFindSceneRetry = (
  label: string,
  seed: number,
  difficulty: Difficulty,
): FindScene | null => {
  for (let i = 0; i < 6; i++) {
    const scene = makeFindScene(label, seed + i * 104729, difficulty);

    if (scene) {
      return scene;
    }
  }

  return null;
};
