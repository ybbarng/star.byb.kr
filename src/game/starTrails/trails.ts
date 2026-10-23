import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { equatorialOf } from "@/game/latitudeTrip/trip";
import { STARS } from "@/game/sky/catalog";
import {
  altAzOf,
  julianDay,
  localSiderealDeg,
  sunVector,
} from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

// 별 궤적 풀기: 장노출 별 궤적 사진을 합성하고, 궤적만 보고 ① 천구의 극 자리 ② 위도(극의 높이)
// ③ 노출 시간(호의 각 ÷ 한 시간에 15°) ④ (어려움) 찍은 방향을 맞힌다.
// 하늘은 위도·지방 항성시만으로 정한다 (별은 J2000 위치 그대로 — 세차·대기 굴절·렌즈 왜곡은 무시).
// 좌표는 관측자 기준 동·북·위(ENU) 단위 벡터, 카메라는 방위·고도·가로 화각으로 정하는 직선투영.

const D = Math.PI / 180;

// 별은 한 시간에 15.04°씩 돈다 (항성일 23시간 56분). 게임에서는 "약 15°"로 읽는다
export const SIDEREAL_DEG_PER_HOUR = 360 / 23.9345;

export const PHOTO_WIDTH = 1200;
export const PHOTO_HEIGHT = 800;

export type TrailDifficulty = "intro" | "easy" | "normal" | "hard";
export type Facing = "north" | "east" | "south" | "west";

export const FACING_LABELS: Record<Facing, string> = {
  north: "북쪽",
  east: "동쪽",
  south: "남쪽",
  west: "서쪽",
};

export interface TrailSettings {
  altitudeGrid: boolean; // 고도 10°마다 눈금선
  compass: boolean; // 지평선에 동서남북
  poleAltHint: boolean; // 극을 찍으면 그 점의 높이를 알려 준다
  askFacing: boolean; // 찍은 방향 맞히기
  marginRatio: number; // 사진 밖으로 찍을 수 있는 여백 (사진 가로 대비)
  magLimit: number;
  lightPollution: number;
}

export const TRAIL_SETTINGS: Record<TrailDifficulty, TrailSettings> = {
  intro: {
    altitudeGrid: true,
    compass: true,
    poleAltHint: true,
    askFacing: false,
    marginRatio: 0,
    magLimit: 5,
    lightPollution: 0.1,
  },
  easy: {
    altitudeGrid: true,
    compass: true,
    poleAltHint: false,
    askFacing: false,
    marginRatio: 0,
    magLimit: 4.8,
    lightPollution: 0.2,
  },
  normal: {
    altitudeGrid: false,
    compass: true,
    poleAltHint: false,
    askFacing: false,
    marginRatio: 0.3,
    magLimit: 4.6,
    lightPollution: 0.3,
  },
  hard: {
    altitudeGrid: false,
    compass: false,
    poleAltHint: false,
    askFacing: true,
    marginRatio: 0.3,
    magLimit: 4.6,
    lightPollution: 0.3,
  },
};

// ---------- 하늘·카메라 계산 ----------

export interface TrailView {
  azDeg: number; // 광축 방위 (북 0°, 동 90°)
  altDeg: number; // 광축 고도
  fovDeg: number; // 가로 화각
}

// 고도·방위 → 동·북·위 단위 벡터
export const enuOf = (altDeg: number, azDeg: number): Point3D => [
  Math.cos(altDeg * D) * Math.sin(azDeg * D),
  Math.cos(altDeg * D) * Math.cos(azDeg * D),
  Math.sin(altDeg * D),
];

export const altOfEnu = (v: Point3D) =>
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;

export const azOfEnu = (v: Point3D) =>
  (((Math.atan2(v[0], v[1]) / D) % 360) + 360) % 360;

// 적위·시간각·위도 → 동·북·위 (latitudeTrip의 altAzAt과 같은 식, 벡터로)
export const starEnu = (
  decDeg: number,
  hourAngleDeg: number,
  latDeg: number,
): Point3D => {
  const d = decDeg * D;
  const h = hourAngleDeg * D;
  const p = latDeg * D;

  return [
    -Math.cos(d) * Math.sin(h),
    Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(h),
    Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h),
  ];
};

// 하늘 위에 보이는 쪽 천구의 극: 북반구면 북극(정북, 고도 = 위도), 남반구면 남극(정남, 고도 = −위도)
export const visiblePole = (latDeg: number): Point3D =>
  latDeg >= 0
    ? [0, Math.cos(latDeg * D), Math.sin(latDeg * D)]
    : [0, -Math.cos(latDeg * D), -Math.sin(latDeg * D)];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const angleBetweenDeg = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

const camera = (view: TrailView, width: number) => {
  const d = enuOf(view.altDeg, view.azDeg);
  const r: Point3D = [Math.cos(view.azDeg * D), -Math.sin(view.azDeg * D), 0];
  // u = r × d (화면 위쪽)
  const u: Point3D = [
    r[1] * d[2] - r[2] * d[1],
    r[2] * d[0] - r[0] * d[2],
    r[0] * d[1] - r[1] * d[0],
  ];
  const f = width / 2 / Math.tan((view.fovDeg / 2) * D);

  return { d, r, u, f };
};

// 사진 좌표로 (카메라 뒤면 null). 사진 밖 좌표도 그대로 돌려준다
export const projectEnu = (
  view: TrailView,
  width: number,
  height: number,
  v: Point3D,
): Point2D | null => {
  const { d, r, u, f } = camera(view, width);
  const z = dot(v, d);

  return z > 1e-6
    ? [width / 2 + (f * dot(v, r)) / z, height / 2 - (f * dot(v, u)) / z]
    : null;
};

// 사진 좌표 → 하늘 방향 (사진 밖 여백을 눌러도 된다)
export const pixelToEnu = (
  view: TrailView,
  width: number,
  height: number,
  [x, y]: Point2D,
): Point3D => {
  const { d, r, u, f } = camera(view, width);
  const a = (x - width / 2) / f;
  const b = (height / 2 - y) / f;
  const v: Point3D = [
    d[0] + a * r[0] + b * u[0],
    d[1] + a * r[1] + b * u[1],
    d[2] + a * r[2] + b * u[2],
  ];
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

export const facingOf = (azDeg: number): Facing =>
  (["north", "east", "south", "west"] as const)[
    Math.round((((azDeg % 360) + 360) % 360) / 90) % 4
  ];

// ---------- 문제 ----------

export interface TrailProblem {
  seed: number;
  difficulty: TrailDifficulty;
  date: Date; // 노출을 시작한 순간 (UTC)
  observer: Observer;
  lstStartDeg: number; // 노출 시작의 지방 항성시
  exposureHours: number;
  view: TrailView;
  width: number;
  height: number;
  marginPx: number;
  facing: Facing;
  pole: Point3D; // 보이는 쪽 천구의 극 (동·북·위)
  polePx: Point2D | null; // 사진 좌표 (사진 밖일 수도 있다)
  askPole: boolean; // 극 자리를 찍는 단계가 있다 (극이 찍을 수 있는 판 안에 있을 때)
  groundSeed: number;
}

interface Plan {
  lat: [number, number]; // 위도 절댓값 범위 (hard는 부호 포함 범위)
  southShare: number;
  facing: "pole" | "cardinal";
  spreadDeg: number; // 광축 방위가 극 쪽(또는 동서남북)에서 벗어나는 폭
  fov: [number, number];
  hours: [number, number];
  pole: "in" | "either" | "any";
}

const PLAN: Record<TrailDifficulty, Plan> = {
  intro: {
    lat: [30, 50],
    southShare: 0,
    facing: "pole",
    spreadDeg: 8,
    fov: [90, 110],
    hours: [1, 4],
    pole: "in",
  },
  easy: {
    lat: [15, 60],
    southShare: 0,
    facing: "pole",
    spreadDeg: 25,
    fov: [65, 100],
    hours: [0.5, 5],
    pole: "in",
  },
  normal: {
    lat: [15, 55],
    southShare: 0.5,
    facing: "pole",
    spreadDeg: 35,
    fov: [55, 95],
    hours: [0.5, 6],
    pole: "either",
  },
  hard: {
    lat: [-28, 32],
    southShare: 0,
    facing: "cardinal",
    spreadDeg: 12,
    fov: [55, 95],
    hours: [0.5, 4],
    pole: "any",
  },
};

const NIGHT_SUN_ALT_DEG = -15;

const isNight = (date: Date, observer: Observer) => {
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, observer).altDeg < NIGHT_SUN_ALT_DEG;
};

// 별 하나의 시작 시간각 기준 적위·적경 (한 번만 계산)
const EQ = STARS.map((s) => ({ ...equatorialOf(s.vector), star: s }));

const inPhoto = (p: Point2D | null, w: number, h: number, pad = 0) =>
  !!p && p[0] >= pad && p[0] <= w - pad && p[1] >= pad && p[1] <= h - pad;

// 문제 만들기: 위도·날짜·장소·카메라·노출 시간을 고르고, 사진답고 풀 만한 것만 남긴다
// (노출 내내 해가 15° 아래, 지평선이 사진 아래쪽, 극 자리 조건, 밝은 궤적이 충분히)
export const makeTrailProblem = (
  seed: number,
  difficulty: TrailDifficulty,
): TrailProblem => {
  const rng = createRng(seed);
  const plan = PLAN[difficulty];
  const set = TRAIL_SETTINGS[difficulty];
  const W = PHOTO_WIDTH;
  const H = PHOTO_HEIGHT;
  const marginPx = Math.round(set.marginRatio * W);
  // 보통: 절반쯤은 극이 사진 밖 (그래도 여백 안)
  const poleOutside = plan.pole === "either" && rng() < 0.6;
  let fallback: TrailProblem | null = null;

  for (let attempt = 0; attempt < 4000; attempt++) {
    const latDeg =
      plan.facing === "cardinal"
        ? Math.round(plan.lat[0] + rng() * (plan.lat[1] - plan.lat[0]))
        : Math.round(plan.lat[0] + rng() * (plan.lat[1] - plan.lat[0])) *
          (rng() < plan.southShare ? -1 : 1);
    const observer: Observer = { latDeg, lonDeg: -180 + rng() * 360 };
    const date = new Date(
      Date.UTC(2025, 0, 1) + Math.floor(rng() * 3 * 365 * 1440) * 60000,
    );
    const exposureHours =
      Math.round(
        (plan.hours[0] + rng() * (plan.hours[1] - plan.hours[0])) * 4,
      ) / 4;
    const fovDeg = Math.round(
      plan.fov[0] + rng() * (plan.fov[1] - plan.fov[0]),
    );
    const baseAz =
      plan.facing === "pole"
        ? latDeg >= 0
          ? 0
          : 180
        : Math.floor(rng() * 4) * 90;
    const azDeg = (baseAz + (rng() * 2 - 1) * plan.spreadDeg + 360) % 360;
    const f = W / 2 / Math.tan((fovDeg / 2) * D);
    const pole = visiblePole(latDeg);
    let altDeg: number;

    if (plan.pole === "in" || (plan.pole === "either" && !poleOutside)) {
      // 극이 사진 위쪽 15~45% 높이에 오게 광축을 든다
      const yTarget = H * (0.15 + rng() * 0.3);
      altDeg = Math.abs(latDeg) - Math.atan((H / 2 - yTarget) / f) / D;
    } else {
      // 지평선이 사진 아래쪽 62~95% 높이에 오게
      const yHorizon = H * (0.62 + rng() * 0.33);
      altDeg = Math.atan((yHorizon - H / 2) / f) / D;
    }

    const view: TrailView = { azDeg, altDeg, fovDeg };
    const horizon = projectEnu(view, W, H, enuOf(0, azDeg));

    if (
      !horizon ||
      horizon[1] < H * 0.6 ||
      horizon[1] > H * (difficulty === "easy" ? 1.15 : 1)
    ) {
      continue;
    }

    const polePx = projectEnu(view, W, H, pole);
    const poleInPhoto = inPhoto(polePx, W, H, H * 0.08);
    const poleOnBoard =
      !!polePx &&
      polePx[0] >= -marginPx * 0.85 &&
      polePx[0] <= W + marginPx * 0.85 &&
      polePx[1] >= -marginPx * 0.85 &&
      polePx[1] <= H + marginPx * 0.85;

    if (plan.pole === "in" || (plan.pole === "either" && !poleOutside)) {
      if (!poleInPhoto || polePx![1] > H * 0.8) {
        continue;
      }
    } else if (plan.pole === "either") {
      if (inPhoto(polePx, W, H, -W * 0.04) || !poleOnBoard) {
        continue;
      }
    }

    // 노출 내내 밤
    const end = new Date(date.getTime() + exposureHours * 3600000);
    const mid = new Date(date.getTime() + exposureHours * 1800000);

    if (
      !isNight(date, observer) ||
      !isNight(mid, observer) ||
      !isNight(end, observer)
    ) {
      continue;
    }

    const lstStartDeg = localSiderealDeg(julianDay(date), observer);
    const problem: TrailProblem = {
      seed,
      difficulty,
      date,
      observer,
      lstStartDeg,
      exposureHours,
      view,
      width: W,
      height: H,
      marginPx,
      facing: facingOf(azDeg),
      pole,
      polePx,
      askPole:
        plan.pole !== "any" ||
        (poleOnBoard && Math.abs(latDeg) >= 5 && !!polePx),
      groundSeed: Math.floor(rng() * 1e9),
    };
    fallback ??= problem;

    // 밝은(4등급까지) 궤적이 사진에 충분히 지나가야 풀 만하다
    if (brightTrailCount(problem) >= 14) {
      return problem;
    }
  }

  return fallback!;
};

const brightTrailCount = (p: TrailProblem) => {
  let n = 0;

  for (const e of EQ) {
    if (e.star.mag > 4) {
      continue;
    }

    const ha = p.lstStartDeg - e.raDeg;
    const mid = starEnu(
      e.decDeg,
      ha + (p.exposureHours * SIDEREAL_DEG_PER_HOUR) / 2,
      p.observer.latDeg,
    );

    if (
      mid[2] > Math.sin(5 * D) &&
      inPhoto(projectEnu(p.view, p.width, p.height, mid), p.width, p.height)
    ) {
      n++;
    }
  }

  return n;
};

// ---------- 궤적 ----------

export interface Trail {
  hr: string;
  name?: string;
  mag: number;
  kelvin: number;
  decDeg: number;
  // 사진 좌표 꺾은선들 (지평선 아래·카메라 뒤에서 끊긴다). 각 점의 고도도 함께 (대기에 묻히는 정도)
  lines: { points: Point2D[]; alts: number[] }[];
}

// 노출 동안 별이 지나간 길. 0.5°마다 한 점, 사진에서 크게 벗어난 부분은 버린다
export const trailsOf = (p: TrailProblem, magLimit: number): Trail[] => {
  const arcDeg = p.exposureHours * SIDEREAL_DEG_PER_HOUR;
  const steps = Math.max(2, Math.ceil(arcDeg / 0.5));
  const pad = 40;
  const out: Trail[] = [];

  for (const e of EQ) {
    if (e.star.mag > magLimit) {
      continue;
    }

    // 하루 내내 지평선 아래인 별은 건너뛴다
    if (Math.abs(p.observer.latDeg - e.decDeg) >= 90) {
      continue;
    }

    const lines: Trail["lines"] = [];
    let cur: Trail["lines"][number] | null = null;
    const ha0 = p.lstStartDeg - e.raDeg;

    for (let i = 0; i <= steps; i++) {
      const v = starEnu(
        e.decDeg,
        ha0 + (arcDeg * i) / steps,
        p.observer.latDeg,
      );
      const q = v[2] > 0 ? projectEnu(p.view, p.width, p.height, v) : null;
      const ok =
        !!q &&
        q[0] > -pad &&
        q[0] < p.width + pad &&
        q[1] > -pad &&
        q[1] < p.height + pad;

      if (ok) {
        cur ??= { points: [], alts: [] };
        cur.points.push(q!);
        cur.alts.push(altOfEnu(v));
      } else if (cur) {
        lines.push(cur);
        cur = null;
      }
    }

    if (cur) {
      lines.push(cur);
    }

    const kept = lines.filter((l) => l.points.length > 1);

    if (kept.length) {
      out.push({
        hr: e.star.hr,
        name: e.star.name,
        mag: e.star.mag,
        kelvin: e.star.kelvin,
        decDeg: e.decDeg,
        lines: kept,
      });
    }
  }

  return out;
};

// ---------- 점수 ----------

export interface TrailGuess {
  polePx: Point2D | null; // 찍은 극 자리 (사진 좌표)
  latDeg: number;
  hours: number;
  facing: Facing | null;
}

export const ROUND_POINTS = { pole: 400, lat: 300, hours: 300, facing: 300 };

export interface TrailScore {
  poleErrDeg: number | null;
  latErrDeg: number;
  arcErrDeg: number;
  facingRight: boolean | null;
  pole: number;
  lat: number;
  hours: number;
  facing: number;
  total: number;
  max: number;
}

export const roundMax = (p: TrailProblem) =>
  (p.askPole ? ROUND_POINTS.pole : 0) +
  ROUND_POINTS.lat +
  ROUND_POINTS.hours +
  (TRAIL_SETTINGS[p.difficulty].askFacing ? ROUND_POINTS.facing : 0);

export const scoreTrails = (p: TrailProblem, g: TrailGuess): TrailScore => {
  const poleErrDeg =
    p.askPole && g.polePx
      ? angleBetweenDeg(pixelToEnu(p.view, p.width, p.height, g.polePx), p.pole)
      : null;
  const latErrDeg = Math.abs(g.latDeg - p.observer.latDeg);
  // 노출 시간은 호의 각으로 잰다 (한 시간 = 15°)
  const arcErrDeg = Math.abs(g.hours - p.exposureHours) * 15;
  const askFacing = TRAIL_SETTINGS[p.difficulty].askFacing;
  const facingRight = askFacing ? g.facing === p.facing : null;
  const pole =
    p.askPole && poleErrDeg !== null
      ? Math.round(ROUND_POINTS.pole * Math.exp(-poleErrDeg / 4))
      : 0;
  const lat = Math.round(ROUND_POINTS.lat * Math.exp(-latErrDeg / 6));
  const hours = Math.round(ROUND_POINTS.hours * Math.exp(-arcErrDeg / 10));
  const facing = facingRight ? ROUND_POINTS.facing : 0;

  return {
    poleErrDeg,
    latErrDeg,
    arcErrDeg,
    facingRight,
    pole,
    lat,
    hours,
    facing,
    total: pole + lat + hours + facing,
    max: roundMax(p),
  };
};

// ---------- 풀이 설명 ----------

export interface TrailExplanation {
  poleAltDeg: number; // 극의 높이 = |위도|
  north: boolean;
  arcDeg: number; // 호의 각
  risingAngleDeg: number; // 동·서 지평선에서 궤적이 지평선과 이루는 각 (90° − |위도|)
  // 호의 각을 보여 줄 궤적 하나 (밝고, 사진 안에 다 들어오고, 극에서 적당히 떨어진 것)
  sample: {
    name?: string;
    start: Point2D;
    end: Point2D;
    points: Point2D[];
  } | null;
}

export const explainTrails = (
  p: TrailProblem,
  trails: Trail[] = trailsOf(p, 3.5),
): TrailExplanation => {
  const inside = (q: Point2D) => inPhoto(q, p.width, p.height, 20);
  const candidates = trails
    .filter((t) => t.lines.length === 1 && t.mag <= 3.5)
    .map((t) => ({ t, pts: t.lines[0].points }))
    .filter(
      ({ pts }) =>
        inside(pts[0]) &&
        inside(pts[pts.length - 1]) &&
        Math.hypot(
          pts[0][0] - pts[pts.length - 1][0],
          pts[0][1] - pts[pts.length - 1][1],
        ) > 60,
    )
    .sort((a, b) => a.t.mag - b.t.mag);
  const best = candidates[0];

  return {
    poleAltDeg: Math.abs(p.observer.latDeg),
    north: p.observer.latDeg >= 0,
    arcDeg: p.exposureHours * SIDEREAL_DEG_PER_HOUR,
    risingAngleDeg: 90 - Math.abs(p.observer.latDeg),
    sample: best
      ? {
          name: best.t.name,
          start: best.pts[0],
          end: best.pts[best.pts.length - 1],
          points: best.pts,
        }
      : null,
  };
};

export const latLabel = (latDeg: number) =>
  Math.round(latDeg) === 0
    ? "적도 0°"
    : `${latDeg > 0 ? "북위" : "남위"} ${Math.abs(Math.round(latDeg))}°`;

export const hoursLabel = (hours: number) => {
  const h = Math.floor(hours + 1e-9);
  const m = Math.round((hours - h) * 60);

  return h === 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};
