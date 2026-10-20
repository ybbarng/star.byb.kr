import type { SkyScene } from "@/game/sky/scene";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import { dialDate } from "@/game/skyMatch/match";
import {
  nextTimeWithLst,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  localSiderealDeg,
} from "@/search/utils/ephemeris";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";

// 하늘 맞추기의 두 도우미:
// 1. 방향 힌트 — 정답 하늘과 내 하늘이 위도·회전(지방 항성시)으로 얼마나 어긋났는지
// 2. 컴퓨터는 이렇게 푼다 — 플레이트 솔빙으로 안 사진의 방향 + 지평선 두 점 → 천정 → 위도·항성시 → 시각
//    (사이판 사진을 푼 shotTimeEstimate의 방법 그대로)

const SIDEREAL_MINUTES = 1436.07; // 하늘이 한 바퀴 도는 데 걸리는 분
const DEG_PER_DAY = 360 / 365.2422; // 같은 시각의 하늘이 하루에 도는 각도

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const wrapMinutes = (m: number) => ((m % 1440) + 1440) % 1440;

export interface Dials {
  latDeg: number;
  dayOfYear: number;
  minutes: number;
}

export interface SkyError {
  latDeg: number; // 내 위도 - 정답 위도 (+면 내가 더 북쪽)
  turnDeg: number; // 내 하늘의 회전(지방 항성시) - 정답 (+면 내 하늘이 앞서 돌았다)
}

export const skyError = (scene: SkyScene, dials: Dials): SkyError => {
  const mine = dialDate(scene, dials.dayOfYear, dials.minutes);
  const lst = (d: Date) => localSiderealDeg(julianDay(d), scene.observer);

  return {
    latDeg: dials.latDeg - scene.observer.latDeg,
    turnDeg: wrap180(lst(mine) - lst(scene.date)),
  };
};

export type HintDial = "lat" | "time";

export interface Hint {
  dial: HintDial;
  stage: 1 | 2 | 3; // 1: 어느 다이얼, 2: 어느 쪽으로, 3: 대략 어디쯤
  text: string;
  target?: { center: number; halfWidth: number }; // 3단계: 다이얼에서 정답 근처 구간
}

// 이만큼보다 덜 어긋났으면 그 다이얼은 거의 맞았다
const LAT_CLOSE_DEG = 2;
const TURN_CLOSE_DEG = 3;

// 지금 어긋난 정도로 힌트를 고른다. locked는 이 단계에서 움직이지 않는 다이얼
export const hintFor = (
  scene: SkyScene,
  dials: Dials,
  stage: 1 | 2 | 3,
  locked: HintDial | null,
): Hint => {
  const err = skyError(scene, dials);
  const latOff = Math.abs(err.latDeg) >= LAT_CLOSE_DEG;
  const turnOff = Math.abs(err.turnDeg) >= TURN_CLOSE_DEG;
  // 회전은 하늘 둘레의 각이라 위도 1°보다 덜 크게 보인다 → 절반으로 견준다
  const dial: HintDial =
    locked === "lat"
      ? "time"
      : locked === "time"
        ? "lat"
        : latOff &&
            (!turnOff || Math.abs(err.latDeg) > Math.abs(err.turnDeg) / 2)
          ? "lat"
          : "time";

  if (dial === "lat") {
    const north = err.latDeg < 0;

    return stage === 1
      ? { dial, stage, text: "위도 다이얼을 움직여 보세요. 하늘이 기울어요." }
      : stage === 2
        ? {
            dial,
            stage,
            text: north
              ? "위도를 더 북쪽(오른쪽)으로 옮겨 보세요."
              : "위도를 더 남쪽(왼쪽)으로 옮겨 보세요.",
          }
        : {
            dial,
            stage,
            text: "위도는 반짝이는 구간 어딘가예요.",
            target: { center: scene.observer.latDeg, halfWidth: 6 },
          };
  }

  // 시각 다이얼: 지금 날짜에서 같은 하늘이 되는 시각
  const targetMinutes = wrapMinutes(
    dials.minutes - (err.turnDeg / 360) * SIDEREAL_MINUTES,
  );
  const later = err.turnDeg < 0;

  return stage === 1
    ? {
        dial,
        stage,
        text: "시각(또는 날짜) 다이얼을 돌려 보세요. 하늘이 돌아요.",
      }
    : stage === 2
      ? {
          dial,
          stage,
          text: later
            ? "시각을 더 늦게(오른쪽으로) 돌려 보세요. 별이 서쪽으로 움직여요."
            : "시각을 더 이르게(왼쪽으로) 돌려 보세요. 별이 동쪽으로 돌아와요.",
        }
      : {
          dial,
          stage,
          text: `시각은 반짝이는 구간 어딘가예요. (날짜를 하루 바꾸면 같은 하늘이 약 ${Math.round((DEG_PER_DAY / 360) * SIDEREAL_MINUTES)}분 일찍 와요)`,
          target: { center: targetMinutes, halfWidth: 40 },
        };
};

export interface ComputerSolve {
  quad: Point2D[]; // 모양을 찾는 밝은 별 넷 (사진 좌표)
  horizon: [Point2D, Point2D]; // 사진에서 찾은 지평선 두 점
  zenithAt: Point2D | null; // 천정이 사진 안에 있으면 그 자리 (대개 사진 위쪽 밖)
  latDeg: number;
  lstDeg: number;
  minutes: number; // dayOfYear 날짜에 같은 하늘이 되는 현지 시각
}

// 컴퓨터의 풀이. 사진의 방향(TP)은 플레이트 솔빙이 알려 준 것으로 본다 (합성 문제라 정답 변환을 쓴다).
export const computerSolve = (
  scene: SkyScene,
  dayOfYear: number,
  brightest: Point2D[],
): ComputerSolve => {
  const frame = horizontalFrameJ2000(julianDay(scene.date), scene.observer);
  const half = scene.view.fovDeg * 0.3;
  // 사진 속 지평선 위 두 점 (사람이나 자동 지평선 찾기가 찍는 자리)
  const horizon = [-half, half].map((d) =>
    projectVecToPhoto(
      scene.TP,
      fromAltAzJ2000(frame, 0, scene.view.azimuthDeg + d),
    ),
  ) as [Point2D, Point2D];
  const dirs = horizon.map((p) => photoToSky(scene.TP, p));
  const up = photoToSky(scene.TP, [scene.width / 2, 0]);
  const zenith = zenithFromHorizon(dirs[0], dirs[1], up) as Point3D;
  const clock = skyClockOf(zenith);
  const from = dialDate(scene, dayOfYear, 0);
  const when = nextTimeWithLst(clock.lstDeg, scene.observer.lonDeg, from);

  return {
    quad: brightest.slice(0, 4),
    horizon,
    zenithAt: projectVecToPhoto(scene.TP, zenith),
    latDeg: clock.latDeg,
    lstDeg: clock.lstDeg,
    minutes: wrapMinutes(Math.round((when.getTime() - from.getTime()) / 60000)),
  };
};
