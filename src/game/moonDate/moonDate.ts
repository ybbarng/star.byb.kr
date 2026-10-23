import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonView } from "@/search/horizonSolve";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import { horizonCameraTP } from "@/search/horizonSolve";
import { constellationAt } from "@/search/utils/constellationBounds";
import {
  horizontalFrameJ2000,
  julianDay,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { createRng } from "@/utils/rng";

// 달로 날짜 맞히기 (docs/game-plans.md): 어느 해·장소·시각대의 밤하늘(별과 달)을 보고 날짜를 맞힌다.
// 달의 모양(위상)은 29.5일마다, 별 사이 자리는 27.3일마다 되풀이된다. 두 주기가 어긋나 있어서
// 모양과 자리를 함께 보면 1년 안에서 날짜가 거의 하나로 정해진다 (발표의 화악산 그믐달, learn/MoonDateDemo).
// 계산은 search/utils/ephemeris.ts(달 약 0.3°)와 IAU 별자리 경계(constellationBounds.ts)를 그대로 쓴다.

export type MoonDifficulty = "intro" | "easy" | "normal";

const D = Math.PI / 180;
const SYNODIC_DAYS = 29.530589;

// ---------- 장소·시각대 ----------

export interface MoonPlace {
  name: string;
  observer: Observer;
  tz: number; // 표준시 (UTC+몇 시간). 일광 절약 시간은 쓰지 않는다
}

export const PLACES: MoonPlace[] = [
  { name: "화악산", observer: { latDeg: 37.99, lonDeg: 127.52 }, tz: 9 },
  { name: "서울", observer: { latDeg: 37.57, lonDeg: 126.98 }, tz: 9 },
  { name: "제주", observer: { latDeg: 33.36, lonDeg: 126.53 }, tz: 9 },
  { name: "시드니", observer: { latDeg: -33.87, lonDeg: 151.21 }, tz: 10 },
  { name: "마우나케아", observer: { latDeg: 19.82, lonDeg: -155.47 }, tz: -10 },
];

// 입문·쉬움은 우리나라만, 보통은 남반구(달이 거꾸로 보인다)·하와이도
const PLACES_BY_DIFFICULTY: Record<MoonDifficulty, number[]> = {
  intro: [0, 1, 2],
  easy: [0, 1, 2],
  normal: [0, 1, 2, 3, 4],
};

export type MoonSlot = "evening" | "night" | "dawn";

// 시각대는 그 지역 표준시. 날짜가 헷갈리지 않게 한밤은 자정 전까지만 둔다
export const SLOTS: Record<
  MoonSlot,
  { label: string; note: string; hours: [number, number] }
> = {
  evening: { label: "저녁", note: "해 진 뒤 ~ 밤 10시", hours: [19, 22] },
  night: { label: "한밤", note: "밤 10시 ~ 자정", hours: [22, 24] },
  dawn: { label: "새벽", note: "새벽 3시 ~ 해 뜨기 전", hours: [3, 6] },
};

const SLOT_KEYS: MoonSlot[] = ["evening", "night", "dawn"];

// ---------- 달 모양 ----------

// 위상각: 해에서 달까지 황도를 따라 동쪽으로 잰 각 (0 삭, 90 상현, 180 보름, 270 하현)
export type MoonShape =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

export const SHAPES: {
  key: Exclude<MoonShape, "new">;
  name: string;
  lo: number;
  hi: number;
  note: string; // "~ 보여요"로 이어지는 때와 방향
}[] = [
  {
    key: "waxingCrescent",
    name: "초승달",
    lo: 15,
    hi: 75,
    note: "해 진 직후 서쪽 하늘에서",
  },
  {
    key: "firstQuarter",
    name: "상현달",
    lo: 75,
    hi: 105,
    note: "해 질 무렵 하늘 높이에서",
  },
  {
    key: "waxingGibbous",
    name: "차오르는 볼록달",
    lo: 105,
    hi: 165,
    note: "저녁 동쪽 하늘에서",
  },
  {
    key: "full",
    name: "보름달",
    lo: 165,
    hi: 195,
    note: "해 질 때 동쪽에서 떠올라 밤새",
  },
  {
    key: "waningGibbous",
    name: "기우는 볼록달",
    lo: 195,
    hi: 255,
    note: "밤늦게 떠올라 새벽까지",
  },
  {
    key: "lastQuarter",
    name: "하현달",
    lo: 255,
    hi: 285,
    note: "자정 무렵 떠올라 새벽 하늘 높이에서",
  },
  {
    key: "waningCrescent",
    name: "그믐달",
    lo: 285,
    hi: 345,
    note: "해 뜨기 전 새벽 동쪽 하늘에서",
  },
];

export const shapeOf = (phaseDeg: number): MoonShape =>
  SHAPES.find((s) => phaseDeg >= s.lo && phaseDeg < s.hi)?.key ?? "new";

export const shapeName = (shape: MoonShape) =>
  SHAPES.find((s) => s.key === shape)?.name ?? "삭 (안 보임)";

// 위상각에서 가장 가까운 모양 경계까지 (문제는 경계에서 떨어진 것만 낸다)
const edgeGapDeg = (phaseDeg: number) =>
  Math.min(
    ...SHAPES.flatMap((s) => [s.lo, s.hi]).map((e) => Math.abs(phaseDeg - e)),
  );

// ---------- 그 순간의 달 ----------

export interface MoonState {
  phaseDeg: number; // 0~360
  lit: number; // 빛나는 비율 0~1
  waxing: boolean; // 차오르는 중 (해의 동쪽)
  shape: MoonShape;
  ageDays: number; // 삭에서 지난 날 (음력 날짜쯤)
  constellation: string; // 달이 든 별자리 구역 (IAU 경계)
  moonAltDeg: number;
  moonAzDeg: number;
  sunAltDeg: number;
  moon: Point3D; // 관측지에서 본 달 (J2000)
  sun: Point3D; // 해 (J2000)
}

const OBLIQUITY = 23.4393 * D;

// J2000 적도좌표 → 황경(도)
const eclipticLonDeg = (v: Point3D) =>
  (Math.atan2(Math.cos(OBLIQUITY) * v[1] + Math.sin(OBLIQUITY) * v[2], v[0]) /
    D +
    360) %
  360;

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const moonState = (date: Date, observer: Observer): MoonState => {
  const jd = julianDay(date);
  // drawSky(solarSystemObjects)와 같은 계산: 관측지에서 본 달, 지구 중심에서 본 해
  const moon = ofDateToJ2000(moonVectorFrom(jd, observer), jd);
  const sun = ofDateToJ2000(sunVector(jd), jd);
  const elong = Math.acos(Math.max(-1, Math.min(1, dot(moon, sun)))) / D;
  // 위상각은 황경 차이로 잰다 (삭 무렵 달이 황도에서 위아래로 5°까지 비켜 있어도 0이 되게)
  const phaseDeg = (eclipticLonDeg(moon) - eclipticLonDeg(sun) + 360) % 360;
  const waxing = phaseDeg < 180;
  const frame = horizontalFrameJ2000(jd, observer);
  const altOf = (v: Point3D) =>
    Math.asin(Math.max(-1, Math.min(1, dot(v, frame.zenith)))) / D;

  return {
    phaseDeg,
    lit: (1 - Math.cos(elong * D)) / 2,
    waxing,
    shape: shapeOf(phaseDeg),
    ageDays: (phaseDeg / 360) * SYNODIC_DAYS,
    constellation: constellationAt(moon) ?? "?",
    moonAltDeg: altOf(moon),
    moonAzDeg:
      (Math.atan2(dot(moon, frame.east), dot(moon, frame.north)) / D + 360) %
      360,
    sunAltDeg: altOf(sun),
    moon,
    sun,
  };
};

// ---------- 날짜 ----------

export const daysInYear = (year: number) =>
  (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;

// 그해 day번째 날(0 = 1월 1일) 그 지역 시계로 hours시 → 그 순간 (UTC)
export const localMoment = (
  year: number,
  day: number,
  hours: number,
  tz: number,
) => new Date(Date.UTC(year, 0, 1 + day) + (hours - tz) * 3600000);

export const dayLabel = (year: number, day: number) => {
  const d = new Date(Date.UTC(year, 0, 1 + day));

  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

export const dayOfYear = (year: number, month: number, date: number) =>
  (Date.UTC(year, month, date) - Date.UTC(year, 0, 1)) / 86400000;

export const clockLabel = (hours: number) => {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// ---------- 그해 날마다의 달 (같은 시계 시각) ----------

export interface DayMoon extends MoonState {
  day: number;
}

export const yearTable = (
  year: number,
  place: MoonPlace,
  hours: number,
): DayMoon[] =>
  Array.from({ length: daysInYear(year) }, (_, day) => ({
    day,
    ...moonState(localMoment(year, day, hours, place.tz), place.observer),
  }));

// 모양과 별자리가 둘 다 맞는 날 (입문의 마지막 단계에서 달력에 표시한다)
export const candidateDays = (
  table: DayMoon[],
  shape: MoonShape,
  constellation: string,
) =>
  table
    .filter((d) => d.shape === shape && d.constellation === constellation)
    .map((d) => d.day);

export interface MoonPass {
  from: number; // 들어온 날
  to: number; // 나간 날 전날 (그 시각에 아직 그 구역)
  mid: DayMoon; // 가운데 날의 달
}

// 그해 달이 그 별자리 구역을 지난 때들 (그 시계 시각에 구역 안이던 날을 이어 붙인다)
export const passesThrough = (
  table: DayMoon[],
  constellation: string,
): MoonPass[] => {
  const out: MoonPass[] = [];
  let start = -1;

  for (let i = 0; i <= table.length; i++) {
    const inside = i < table.length && table[i].constellation === constellation;

    if (inside && start < 0) {
      start = i;
    } else if (!inside && start >= 0) {
      out.push({
        from: start,
        to: i - 1,
        mid: table[Math.floor((start + i - 1) / 2)],
      });
      start = -1;
    }
  }

  return out;
};

// ---------- 문제 ----------

export const SCENE_WIDTH = 1280;
export const SCENE_HEIGHT = 800;

const LOOK: Record<
  MoonDifficulty,
  { magLimit: number; lightPollution: number; fovDeg: number }
> = {
  intro: { magLimit: 5, lightPollution: 0.12, fovDeg: 70 },
  easy: { magLimit: 4.8, lightPollution: 0.2, fovDeg: 70 },
  normal: { magLimit: 4.5, lightPollution: 0.3, fovDeg: 64 },
};

export interface MoonProblem {
  seed: number;
  difficulty: MoonDifficulty;
  year: number;
  day: number; // 정답: 그해 몇 번째 날 (그 지역 날짜)
  slot: MoonSlot;
  hours: number; // 그 지역 시계 시각
  place: MoonPlace;
  date: Date; // 촬영 순간 (UTC)
  state: MoonState;
  view: HorizonView;
  TP: Mat3;
  width: number;
  height: number;
  magLimit: number;
  lightPollution: number;
  groundSeed: number;
}

const MIN_MOON_ALT = 6;
const MAX_MOON_ALT = 55; // 지평선이 사진에 남게
const NIGHT_SUN_ALT = -12;
const SHAPE_EDGE_GAP = 4; // 모양 경계에서 이만큼 떨어진 것만

export const makeMoonProblem = (
  seed: number,
  difficulty: MoonDifficulty,
): MoonProblem => {
  const rng = createRng(seed);
  const places = PLACES_BY_DIFFICULTY[difficulty];
  const look = LOOK[difficulty];

  for (;;) {
    const year = 2025 + Math.floor(rng() * 3);
    const day = Math.floor(rng() * daysInYear(year));
    const slot = SLOT_KEYS[Math.floor(rng() * 3)];
    const [h0, h1] = SLOTS[slot].hours;
    const hours = Math.round((h0 + rng() * (h1 - h0)) * 12) / 12;
    const place = PLACES[places[Math.floor(rng() * places.length)]];
    const date = localMoment(year, day, Math.min(hours, 23.95), place.tz);
    const state = moonState(date, place.observer);

    if (
      state.shape === "new" ||
      state.sunAltDeg > NIGHT_SUN_ALT ||
      state.moonAltDeg < MIN_MOON_ALT ||
      state.moonAltDeg > MAX_MOON_ALT ||
      edgeGapDeg(state.phaseDeg) < SHAPE_EDGE_GAP ||
      state.constellation === "?"
    ) {
      continue;
    }

    // 달을 화면 가운데 근처에 두고, 지평선이 아래쪽에 보이게 광축을 든다
    const fovDeg = look.fovDeg;
    const view: HorizonView = {
      azimuthDeg: (state.moonAzDeg + (rng() - 0.5) * 24 + 360) % 360,
      altitudeDeg: Math.min(
        fovDeg / 2 - 6,
        Math.max(fovDeg * 0.2, state.moonAltDeg - 16),
      ),
      rollDeg: (rng() - 0.5) * 3,
      fovDeg,
    };
    const TP = horizonCameraTP(
      date,
      place.observer,
      view,
      SCENE_WIDTH,
      SCENE_HEIGHT,
    );
    const at = projectVecToPhoto(TP, state.moon);

    if (
      !at ||
      at[0] < SCENE_WIDTH * 0.12 ||
      at[0] > SCENE_WIDTH * 0.88 ||
      at[1] < SCENE_HEIGHT * 0.1 ||
      at[1] > SCENE_HEIGHT * 0.8
    ) {
      continue;
    }

    return {
      seed,
      difficulty,
      year,
      day: Math.min(day, daysInYear(year) - 1),
      slot,
      hours: Math.min(hours, 23.95),
      place,
      date,
      state,
      view,
      TP,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      magLimit: look.magLimit,
      lightPollution: look.lightPollution,
      groundSeed: Math.floor(rng() * 1e9),
    };
  }
};

// 사진 속 달의 자리와 밝은 쪽 방향(화면 각, 라디안. 오른쪽 0, 아래로 +) — drawSky와 같은 방법
export const moonInPhoto = (
  p: MoonProblem,
): { at: Point2D; sunAngle: number } | null => {
  const at = projectVecToPhoto(p.TP, p.state.moon);
  const t = p.state.moon.map((c, i) => c + 0.02 * p.state.sun[i]);
  const n = Math.hypot(t[0], t[1], t[2]);
  const toward = projectVecToPhoto(p.TP, [t[0] / n, t[1] / n, t[2] / n]);

  return at && toward
    ? {
        at,
        sunAngle: Math.atan2(toward[1] - at[1], toward[0] - at[0]),
      }
    : null;
};

// 입문 2단계: 정답 별자리와, 며칠 앞뒤 달이 있던 이웃 별자리 셋
export const constellationChoices = (
  table: DayMoon[],
  p: MoonProblem,
): string[] => {
  const answer = p.state.constellation;
  const out = [answer];

  for (const k of [3, -3, 6, -6, 9, -9, 12, -12]) {
    const c = table[(p.day + k + table.length) % table.length].constellation;

    if (out.length < 4 && c !== "?" && !out.includes(c)) {
      out.push(c);
    }
  }

  // 정답 자리를 시드로 섞는다
  const rng = createRng(p.seed + 17);

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
};

// ---------- 점수 ----------

export const ROUND_MAX = 1000;
export const STEP_MISS_COST = 0.1; // 입문 단계에서 한 번 틀릴 때마다
export const PHASE_HINT_COST = 0.3; // 보통: 달력에 달 모양 보기

export interface MoonScore {
  diffDays: number;
  points: number;
}

// 날짜 차이(일)로 매긴다: 하루 819, 사흘 549, 일주일 247, 한 달이면 거의 0
export const scoreMoonDate = (
  p: MoonProblem,
  guessDay: number,
  penalty = 0,
): MoonScore => {
  const diffDays = Math.abs(guessDay - p.day);

  return {
    diffDays,
    points: Math.round(
      ROUND_MAX * Math.exp(-diffDays / 5) * Math.max(0, 1 - penalty),
    ),
  };
};

// ---------- 풀이 설명 ----------

export interface MoonExplanation {
  elongDeg: number; // 해와 달 사이 각
  sunConstellation: string;
  sunRanges: [number, number][]; // 그해 해가 그 별자리에 있던 날들 (연말·연초로 나뉠 수 있다)
  passes: MoonPass[];
  answerPass: number; // 정답 날이 든 지나감
  sameShapePasses: number; // 모양까지 맞는 지나감 수
}

// 이어진 날들을 [처음, 끝] 묶음으로
const runs = (days: number[]): [number, number][] =>
  days.reduce<[number, number][]>((out, d) => {
    const last = out[out.length - 1];

    if (last && last[1] === d - 1) {
      last[1] = d;
    } else {
      out.push([d, d]);
    }

    return out;
  }, []);

export const explainMoonDate = (
  p: MoonProblem,
  table: DayMoon[],
): MoonExplanation => {
  const sunConstellation = constellationAt(p.state.sun) ?? "?";
  // 해는 하루 1°씩 옮기니 날마다 정오만 본다
  const sunIn = table
    .map((d) => d.day)
    .filter((day) => {
      const jd = julianDay(localMoment(p.year, day, 12, p.place.tz));

      return (
        constellationAt(ofDateToJ2000(sunVector(jd), jd)) === sunConstellation
      );
    });
  const passes = passesThrough(table, p.state.constellation);

  return {
    elongDeg: Math.min(p.state.phaseDeg, 360 - p.state.phaseDeg),
    sunConstellation,
    sunRanges: runs(sunIn),
    passes,
    answerPass: passes.findIndex((s) => s.from <= p.day && p.day <= s.to),
    sameShapePasses: passes.filter((s) =>
      table.slice(s.from, s.to + 1).some((d) => d.shape === p.state.shape),
    ).length,
  };
};
