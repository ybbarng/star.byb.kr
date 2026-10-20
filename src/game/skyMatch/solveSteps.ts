import type { SkyScene } from "@/game/sky/scene";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import { dialDate } from "@/game/skyMatch/match";
import { horizonCameraTP } from "@/search/horizonSolve";
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
export type HintStage = 1 | 2 | 3 | 4;

export interface Hint {
  stage: HintStage; // 1: 이야기 단서, 2: 하늘 단서, 3: 연한 화살표와 방향, 4: 다이얼 위 대략의 구간
  texts: string[];
  dial?: HintDial; // 3단계부터: 움직일 다이얼
  arrows: boolean; // 3단계부터: 사진에 별이 가야 할 쪽으로 연한 화살표
  target?: { center: number; halfWidth: number }; // 4단계: 다이얼에서 정답 근처 구간
}

// 이만큼보다 덜 어긋났으면 그 다이얼은 거의 맞았다
const LAT_CLOSE_DEG = 2;
const TURN_CLOSE_DEG = 3;

const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

// 이야기 단서: 사진 찍은 곳·때를 말로 유추하게 한다 (잠긴 다이얼은 건너뛴다)
export const storyClues = (scene: SkyScene, locked: HintDial | null) => {
  const lat = scene.observer.latDeg;
  const a = Math.abs(lat);
  const south = lat < -5;
  const clues: string[] = [];

  if (locked !== "lat") {
    clues.push(
      (a < 15
        ? "일 년 내내 덥고, 한낮의 해가 거의 머리 위를 지나는 곳이에요."
        : a < 35
          ? "겨울에도 눈 보기가 어려운 따뜻한 곳이에요."
          : a < 50
            ? "사계절이 뚜렷한 곳이에요 (서울과 비슷해요)."
            : "여름밤은 아주 짧고 겨울밤은 아주 긴 곳이에요.") +
        (south ? " 북극성이 보이지 않는 남반구예요." : ""),
    );
  }

  if (locked !== "time") {
    const local = new Date(
      scene.date.getTime() + (scene.observer.lonDeg / 15) * 3600000,
    );
    const month = local.getUTCMonth(); // 0~11
    const season = [
      "겨울",
      "겨울",
      "봄",
      "봄",
      "봄",
      "여름",
      "여름",
      "여름",
      "가을",
      "가을",
      "가을",
      "겨울",
    ][south ? (month + 6) % 12 : month];
    const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
    const when =
      hour >= 17 && hour < 21
        ? "해가 진 지 얼마 안 된 초저녁"
        : hour >= 21
          ? "자정이 다가오는 밤"
          : hour < 2
            ? "자정을 막 넘긴 한밤"
            : hour < 4
              ? "모두 잠든 새벽"
              : "곧 동이 트는 새벽";
    clues.push(`${south ? "남반구" : "북반구"}의 ${season}, ${when}이에요.`);
  }

  return clues;
};

// 하늘 단서: 하늘 전체 뷰와 이어지는 단서 (극의 높이, 밝은 별의 자리)
export const skyClues = (
  scene: SkyScene,
  locked: HintDial | null,
  landmark?: { name: string; vector: Point3D },
) => {
  const clues: string[] = [];
  const lat = scene.observer.latDeg;

  if (locked !== "lat") {
    clues.push(
      Math.abs(lat) < 3
        ? "천구의 극이 지평선에 걸려 있어요 (하늘 전체 뷰의 ★)."
        : `천구의 ${lat >= 0 ? "북극" : "남극"}이 지평선에서 약 ${Math.max(5, Math.round(Math.abs(lat) / 5) * 5)}° 높이에 떠 있어요 (하늘 전체 뷰의 ★).`,
    );
  }

  if (locked !== "time" && landmark) {
    const frame = horizontalFrameJ2000(julianDay(scene.date), scene.observer);
    const v = landmark.vector;
    const dot = (b: Point3D) => v[0] * b[0] + v[1] * b[1] + v[2] * b[2];
    const alt = Math.asin(dot(frame.zenith)) / (Math.PI / 180);
    const az = (Math.atan2(dot(frame.east), dot(frame.north)) * 180) / Math.PI;
    const dir = DIRECTIONS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
    clues.push(
      `밝은 별 ${landmark.name} — ${dir}쪽 하늘 약 ${Math.round(alt / 5) * 5}° 높이에 있어요.`,
    );
  }

  return clues;
};

// 지금 어긋난 정도로 힌트를 고른다. locked는 이 단계에서 움직이지 않는 다이얼
export const hintFor = (
  scene: SkyScene,
  dials: Dials,
  stage: HintStage,
  locked: HintDial | null,
  landmark?: { name: string; vector: Point3D },
): Hint => {
  if (stage === 1) {
    return { stage, texts: storyClues(scene, locked), arrows: false };
  }

  if (stage === 2) {
    return { stage, texts: skyClues(scene, locked, landmark), arrows: false };
  }

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
    return stage === 3
      ? {
          stage,
          dial,
          arrows: true,
          texts: [
            err.latDeg < 0
              ? "위도를 더 북쪽(오른쪽)으로 옮겨 보세요."
              : "위도를 더 남쪽(왼쪽)으로 옮겨 보세요.",
          ],
        }
      : {
          stage,
          dial,
          arrows: true,
          texts: ["위도는 반짝이는 구간 어딘가예요."],
          target: { center: scene.observer.latDeg, halfWidth: 6 },
        };
  }

  // 시각 다이얼: 지금 날짜에서 같은 하늘이 되는 시각
  const targetMinutes = wrapMinutes(
    dials.minutes - (err.turnDeg / 360) * SIDEREAL_MINUTES,
  );

  return stage === 3
    ? {
        stage,
        dial,
        arrows: true,
        texts: [
          err.turnDeg < 0
            ? "시각을 더 늦게(오른쪽으로) 돌려 보세요."
            : "시각을 더 이르게(왼쪽으로) 돌려 보세요.",
        ],
      }
    : {
        stage,
        dial,
        arrows: true,
        texts: [
          `시각은 반짝이는 구간 어딘가예요. (날짜를 하루 바꾸면 같은 하늘이 약 ${Math.round((DEG_PER_DAY / 360) * SIDEREAL_MINUTES)}분 일찍 와요)`,
        ],
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

// ---------- 하늘을 손으로 끌기 ----------

// 잡은 별(v)이 커서(target)를 따라오도록 다이얼(위도·시각)을 고친다. 잠긴 다이얼은 그대로.
// 숫자 미분으로 가우스-뉴턴 몇 번: 극을 중심으로 돌리듯 끌면 시각이, 위아래로 끌면 위도가 바뀐다.
const DRAG_LAT_STEP = 0.5;
const DRAG_MIN_STEP = 4;
const DRAG_DAMPING = 1e-3;

export const dragDials = (
  scene: SkyScene,
  dials: Dials,
  v: Point3D,
  target: Point2D,
  locked: HintDial | null,
  latRange: [number, number],
): Dials => {
  const proj = (lat: number, minutes: number) =>
    projectVecToPhoto(
      horizonCameraTP(
        dialDate(scene, dials.dayOfYear, minutes),
        { latDeg: lat, lonDeg: scene.observer.lonDeg },
        scene.view,
        scene.width,
        scene.height,
      ),
      v,
    );
  let lat = dials.latDeg;
  let min = dials.minutes;

  for (let it = 0; it < 4; it++) {
    const p = proj(lat, min);

    if (!p) {
      break;
    }

    const r = [p[0] - target[0], p[1] - target[1]];
    const qLat = locked === "lat" ? null : proj(lat + DRAG_LAT_STEP, min);
    const qMin = locked === "time" ? null : proj(lat, min + DRAG_MIN_STEP);
    const dLat = qLat
      ? [(qLat[0] - p[0]) / DRAG_LAT_STEP, (qLat[1] - p[1]) / DRAG_LAT_STEP]
      : null;
    const dMin = qMin
      ? [(qMin[0] - p[0]) / DRAG_MIN_STEP, (qMin[1] - p[1]) / DRAG_MIN_STEP]
      : null;
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
    let stepLat = 0;
    let stepMin = 0;

    if (dLat && dMin) {
      // (JᵀJ + λ) δ = -Jᵀ r
      const a = dot(dLat, dLat) + DRAG_DAMPING;
      const b = dot(dLat, dMin);
      const c = dot(dMin, dMin) + DRAG_DAMPING;
      const det = a * c - b * b;

      if (Math.abs(det) < 1e-12) {
        break;
      }

      const g1 = -dot(dLat, r);
      const g2 = -dot(dMin, r);
      stepLat = (c * g1 - b * g2) / det;
      stepMin = (a * g2 - b * g1) / det;
    } else if (dLat) {
      stepLat = -dot(dLat, r) / (dot(dLat, dLat) + DRAG_DAMPING);
    } else if (dMin) {
      stepMin = -dot(dMin, r) / (dot(dMin, dMin) + DRAG_DAMPING);
    }

    lat = Math.max(
      latRange[0],
      Math.min(latRange[1], lat + Math.max(-10, Math.min(10, stepLat))),
    );
    min += Math.max(-120, Math.min(120, stepMin));
  }

  return {
    ...dials,
    latDeg: locked === "lat" ? dials.latDeg : Math.round(lat * 10) / 10,
    minutes: locked === "time" ? dials.minutes : Math.round(wrapMinutes(min)),
  };
};
