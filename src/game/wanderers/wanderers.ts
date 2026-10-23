import type { Comet } from "@/game/wanderers/comets";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { PlanetName } from "@/search/utils/planets";
import { toEclipticJ2000 } from "@/game/precession/precession";
import { COMETS, cometPosition, sunGeocentric } from "@/game/wanderers/comets";
import { julianDay } from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";
import { createRng } from "@/utils/rng";

// 떠돌이별 찾기 (docs/game-plans.md "행성 찾기 + 혜성 찾기"): 같은 하늘을 며칠·몇 주 간격으로 찍은 별 지도 여러 장을
// 넘겨 보며, 별 사이를 옮겨 다니는 점(행성·혜성)을 찾는다. 행성 위치는 planets.ts(JPL 궤도 요소, 약 1′),
// 혜성은 comets.ts(JPL Horizons 궤도 요소)로 실제 날짜의 위치를 계산한다.

export type WanderDifficulty = "intro" | "easy" | "normal" | "hard";
export type RoundKind = "planet" | "retro" | "comet";

export const ROUNDS = 5;
export const ROUND_POINTS = 1000;
export const WRONG_COST = 200;
export const HINT_COST = 300;
export const BONUS_POINTS = 300;
const MIN_FOUND_POINTS = 200;

export const PLANET_KO: Record<PlanetName, string> = {
  Mercury: "수성",
  Venus: "금성",
  Mars: "화성",
  Jupiter: "목성",
  Saturn: "토성",
  Uranus: "천왕성",
  Neptune: "해왕성",
};

// 화면에 그릴 색 (사진에서 보이는 대략의 색)
export const PLANET_COLOR: Record<PlanetName, string> = {
  Mercury: "255,235,210",
  Venus: "255,250,235",
  Mars: "255,170,120",
  Jupiter: "255,240,215",
  Saturn: "250,225,170",
  Uranus: "205,235,240",
  Neptune: "180,200,255",
};

interface Settings {
  kinds: RoundKind[]; // 라운드마다 문제 종류
  planets: PlanetName[]; // "planet" 라운드에 나올 행성
  minMag: number; // 행성 밝기 범위 (등급, 작을수록 밝다)
  maxMag: number;
  stepDeg: number; // 한 장 넘길 때 행성이 움직이는 각 (목표)
  maxIntervalDays: number; // 넘기는 간격의 상한 (천왕성처럼 느린 행성은 몇 달)
  frames: number;
  magLimit: number; // 그리는 별의 등급 한계
  fovDeg: number;
}

export const WANDER_SETTINGS: Record<WanderDifficulty, Settings> = {
  intro: {
    kinds: ["planet", "planet", "planet", "planet", "planet"],
    planets: ["Venus", "Mars", "Jupiter", "Saturn"],
    minMag: -5,
    maxMag: 1.2,
    stepDeg: 4,
    maxIntervalDays: 60,
    frames: 4,
    magLimit: 4,
    fovDeg: 40,
  },
  easy: {
    kinds: ["planet", "planet", "planet", "planet", "planet"],
    planets: ["Venus", "Mars", "Jupiter", "Saturn"],
    minMag: -5,
    maxMag: 2,
    stepDeg: 2.5,
    maxIntervalDays: 60,
    frames: 4,
    magLimit: 4.5,
    fovDeg: 45,
  },
  normal: {
    kinds: ["planet", "planet", "planet", "planet", "planet"],
    planets: ["Mercury", "Mars", "Saturn", "Uranus"],
    minMag: 0,
    maxMag: 6,
    stepDeg: 1.5,
    maxIntervalDays: 120,
    frames: 5,
    magLimit: 5,
    fovDeg: 50,
  },
  hard: {
    kinds: ["retro", "comet", "planet", "retro", "comet"],
    planets: ["Mercury", "Mars", "Saturn", "Uranus"],
    minMag: 0,
    maxMag: 6,
    stepDeg: 1.2,
    maxIntervalDays: 120,
    frames: 5,
    magLimit: 5,
    fovDeg: 50,
  },
};

const D = Math.PI / 180;
const DAY_MS = 86400000;

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalize = (v: number[]): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

export const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

const jdOf = (date: Date) => julianDay(date);
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

// 해에서 떨어진 각 (이각). 작으면 해 가까이라 밤하늘에서 보기 어렵다
export const elongationDeg = (v: Point3D, jd: number) =>
  angleDeg(v, normalize(sunGeocentric(jd)));

// ---------- 행성 밝기 ----------

// 행성의 겉보기 등급. 천문연감(1984)의 근사식 (J. Meeus, Astronomical Algorithms 41장).
// 토성은 고리의 기울기만 넣고(고리 극: IAU 자전축 적경 40.59°·적위 83.54°), 작은 항은 뺐다. 0.1~0.3등급쯤 어긋날 수 있다.
export const planetMagnitude = (name: PlanetName, jd: number): number => {
  const { vector: v, distanceAu: delta } = planetPosition(name, jd);
  const sun = sunGeocentric(jd);
  const R = Math.hypot(sun[0], sun[1], sun[2]);
  // 해에서 본 행성 = 지구에서 본 행성 − 지구에서 본 해
  const helio = [0, 1, 2].map((k) => v[k] * delta - sun[k]);
  const r = Math.hypot(helio[0], helio[1], helio[2]);
  const i =
    Math.acos(
      Math.max(
        -1,
        Math.min(1, (r * r + delta * delta - R * R) / (2 * r * delta)),
      ),
    ) / D;
  const base = 5 * Math.log10(r * delta);

  switch (name) {
    case "Mercury":
      return -0.42 + base + 0.038 * i - 0.000273 * i * i + 0.000002 * i ** 3;
    case "Venus":
      return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i ** 3;
    case "Mars":
      return -1.52 + base + 0.016 * i;
    case "Jupiter":
      return -9.4 + base + 0.005 * i;

    case "Saturn": {
      const pole: Point3D = [
        Math.cos(83.54 * D) * Math.cos(40.59 * D),
        Math.cos(83.54 * D) * Math.sin(40.59 * D),
        Math.sin(83.54 * D),
      ];
      const sinB = Math.abs(dot(pole, v));

      return -8.88 + base - 2.6 * sinB + 1.25 * sinB * sinB;
    }

    case "Uranus":
      return -7.19 + base;
    case "Neptune":
      return -6.87 + base;
  }
};

// ---------- 화면 투영 ----------

// 별 지도 한 장: 가운데 방향에서 접평면(심사) 투영. 위가 북쪽, 왼쪽이 동쪽 (하늘을 올려다본 모습)
export interface FieldView {
  center: Point3D;
  fovDeg: number; // 가로 시야
  width: number;
  height: number;
}

export const FIELD_SIZE = 840;

// 지도 가운데에서의 동쪽·북쪽 단위 벡터. 동쪽 = 천구 북극 × 가운데 (극 바로 위면 y축 쪽을 기준으로)
const fieldAxes = (c: Point3D): [Point3D, Point3D] => {
  const east = normalize(
    Math.hypot(c[0], c[1]) < 1e-6 ? [0, 1, 0] : [-c[1], c[0], 0],
  );
  const north: Point3D = [
    c[1] * east[2] - c[2] * east[1],
    c[2] * east[0] - c[0] * east[2],
    c[0] * east[1] - c[1] * east[0],
  ];

  return [east, north];
};

export const projectField = (view: FieldView, v: Point3D): Point2D | null => {
  const c = view.center;
  const z = dot(v, c);

  if (z <= 0.05) {
    return null;
  }

  const [east, north] = fieldAxes(c);
  const scale = view.width / 2 / Math.tan((view.fovDeg / 2) * D);

  return [
    view.width / 2 - (dot(v, east) / z) * scale,
    view.height / 2 - (dot(v, north) / z) * scale,
  ];
};

const insideField = (view: FieldView, v: Point3D, margin: number) => {
  const p = projectField(view, v);

  return (
    p !== null &&
    p[0] > view.width * margin &&
    p[0] < view.width * (1 - margin) &&
    p[1] > view.height * margin &&
    p[1] < view.height * (1 - margin)
  );
};

// ---------- 문제 ----------

export interface WanderFrame {
  date: Date;
  target: Point3D;
  tail?: Point3D; // 혜성 꼬리 끝 방향
}

export interface Bonus {
  question: string;
  options: string[];
  answer: number;
  explain: string;
  frameIndex: number; // 질문이 가리키는 장
}

export interface WanderProblem {
  kind: RoundKind;
  name: string;
  planet?: PlanetName;
  comet?: Comet;
  frames: WanderFrame[];
  intervalDays: number;
  view: FieldView;
  magLimit: number;
  targetMag: number; // 그릴 밝기 (혜성은 그림용 값)
  color: string;
  path: Point3D[]; // 첫 장부터 마지막 장까지 하루 간격 자취 (풀이 화면)
  oppositionDate?: Date; // 역행 문제: 충
  bonus?: Bonus;
}

const pathBetween = (
  first: Date,
  days: number,
  at: (d: Date) => Point3D,
): Point3D[] =>
  Array.from({ length: Math.max(2, Math.ceil(days) + 1) }, (_, k) =>
    at(addDays(first, Math.min(k, days))),
  );

const planetAt = (name: PlanetName) => (d: Date) =>
  planetPosition(name, jdOf(d)).vector;

// 별 지도 가운데를 자취 둘레에서 조금 비켜 잡는다 (늘 한가운데 있으면 너무 쉽다)
const placeView = (
  rng: () => number,
  points: Point3D[],
  fovDeg: number,
): FieldView | null => {
  const mean = normalize(
    points.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]),
  );

  for (let attempt = 0; attempt < 8; attempt++) {
    const shift = attempt < 6 ? fovDeg * 0.22 * rng() : 0;
    const dir = rng() * Math.PI * 2;
    const [east, north] = fieldAxes(mean);
    // 가운데에서 접평면 위로 (dx, dy)만큼 옮긴 방향을 새 가운데로
    const dx = Math.cos(dir) * Math.tan(shift * D);
    const dy = Math.sin(dir) * Math.tan(shift * D);
    const view: FieldView = {
      center: normalize(
        [0, 1, 2].map((i) => mean[i] + dx * east[i] + dy * north[i]),
      ),
      fovDeg,
      width: FIELD_SIZE,
      height: FIELD_SIZE,
    };

    if (points.every((p) => insideField(view, p, 0.1))) {
      return view;
    }
  }

  return null;
};

// 다른 맨눈 행성이 같은 지도에 들어오면 움직이는 점이 둘이 되어 문제가 흐려진다
const otherPlanetInView = (
  view: FieldView,
  dates: Date[],
  except?: PlanetName,
) =>
  dates.some((d) =>
    (Object.keys(PLANET_KO) as PlanetName[]).some(
      (p) =>
        p !== except &&
        p !== "Neptune" &&
        insideField(view, planetPosition(p, jdOf(d)).vector, -0.05),
    ),
  );

const MIN_ELONGATION: Record<PlanetName, number> = {
  Mercury: 18,
  Venus: 25,
  Mars: 45,
  Jupiter: 45,
  Saturn: 45,
  Uranus: 45,
  Neptune: 45,
};

const randomDate = (rng: () => number) =>
  new Date(Date.UTC(2000, 0, 1, 12) + Math.floor(rng() * 41 * 365.25) * DAY_MS);

const makePlanetProblem = (
  rng: () => number,
  s: Settings,
  prefer?: PlanetName,
): WanderProblem | null => {
  for (let attempt = 0; attempt < 400; attempt++) {
    // 처음엔 이 라운드에 정한 행성으로 (한 판에 여러 행성이 고루 나오게), 안 되면 아무 행성이나
    const planet =
      prefer && attempt < 300
        ? prefer
        : s.planets[Math.floor(rng() * s.planets.length)];
    const at = planetAt(planet);
    // 천왕성은 아주 느려서(하루 0.01~0.04°) 조금만 움직여도 되게 한다
    const step = planet === "Uranus" ? Math.min(s.stepDeg, 0.8) : s.stepDeg;
    const start = randomDate(rng);
    const speed = angleDeg(at(start), at(addDays(start, 1)));
    const interval = Math.max(
      1,
      Math.min(s.maxIntervalDays, Math.round(step / speed)),
    );
    const dates = Array.from({ length: s.frames }, (_, k) =>
      addDays(start, k * interval),
    );
    const targets = dates.map(at);
    const steps = targets.slice(1).map((t, k) => angleDeg(t, targets[k]));

    if (steps.some((d) => d < step * 0.6 || d > step * 2.2)) {
      continue; // 멈춘 듯 보이는 때(유) 언저리나 너무 빠른 때
    }

    if (
      dates.some(
        (d, k) => elongationDeg(targets[k], jdOf(d)) < MIN_ELONGATION[planet],
      )
    ) {
      continue;
    }

    const mag = planetMagnitude(planet, jdOf(dates[s.frames >> 1]));

    if (mag < s.minMag || mag > s.maxMag) {
      continue;
    }

    const view = placeView(rng, targets, s.fovDeg);

    if (!view || otherPlanetInView(view, dates, planet)) {
      continue;
    }

    return {
      kind: "planet",
      name: PLANET_KO[planet],
      planet,
      frames: dates.map((date, k) => ({ date, target: targets[k] })),
      intervalDays: interval,
      view,
      magLimit: s.magLimit,
      targetMag: mag,
      color: PLANET_COLOR[planet],
      path: pathBetween(dates[0], interval * (s.frames - 1), at),
    };
  }

  return null;
};

// 역행: 바깥 행성이 충(해의 정반대) 언저리에서 별 사이를 거꾸로 가며 고리·S자를 그린다
const RETRO: Partial<
  Record<PlanetName, { synodic: number; spacing: number; frames: number }>
> = {
  Mars: { synodic: 780, spacing: 20, frames: 7 },
  Jupiter: { synodic: 399, spacing: 30, frames: 7 },
  Saturn: { synodic: 378, spacing: 35, frames: 7 },
};

// 황경이 늘면 동쪽(순행), 줄면 서쪽(역행)
export const eclipticMotionDeg = (a: Point3D, b: Point3D) => {
  const d = toEclipticJ2000(b).lonDeg - toEclipticJ2000(a).lonDeg;

  return ((d + 540) % 360) - 180;
};

export const DIRECTION_OPTIONS = [
  "동쪽 (평소처럼 앞으로 · 순행)",
  "서쪽 (거꾸로 · 역행)",
];

export const findOpposition = (planet: PlanetName, from: Date): Date => {
  const { synodic } = RETRO[planet] ?? { synodic: 400 };
  let best = from;
  let bestElong = -1;

  for (let d = 0; d <= synodic; d += 2) {
    const date = addDays(from, d);
    const jd = jdOf(date);
    const e = elongationDeg(planetPosition(planet, jd).vector, jd);

    if (e > bestElong) {
      bestElong = e;
      best = date;
    }
  }

  return best;
};

const makeRetroProblem = (
  rng: () => number,
  s: Settings,
): WanderProblem | null => {
  const names = Object.keys(RETRO) as PlanetName[];

  for (let attempt = 0; attempt < 30; attempt++) {
    // 화성이 가장 크게 고리를 그려 반쯤은 화성
    const planet =
      rng() < 0.5 ? "Mars" : names[Math.floor(rng() * names.length)];
    const { spacing, frames } = RETRO[planet]!;
    const opposition = findOpposition(planet, randomDate(rng));
    const half = Math.floor(frames / 2);
    const dates = Array.from({ length: frames }, (_, k) =>
      addDays(opposition, (k - half) * spacing),
    );
    const at = planetAt(planet);
    const targets = dates.map(at);
    let span = 0;

    for (const a of targets) {
      for (const b of targets) {
        span = Math.max(span, angleDeg(a, b));
      }
    }

    // 고리가 지도에 크게 보이게 시야를 자취에 맞춘다
    const view = placeView(
      rng,
      targets,
      Math.min(s.fovDeg, Math.max(20, span * 1.9)),
    );

    if (!view || otherPlanetInView(view, dates, planet)) {
      continue;
    }

    // 보너스: 어느 두 장 사이에서 어느 쪽으로 갔나 (순행·역행을 섞어 묻는다)
    const moves = targets
      .slice(1)
      .map((t, k) => ({ k, d: eclipticMotionDeg(targets[k], t) }))
      .filter((m) => Math.abs(m.d) > 0.4);
    const askRetro = rng() < 0.6;
    const pool = moves.filter((m) => m.d < 0 === askRetro);
    const pick = (pool.length ? pool : moves)[
      Math.floor(rng() * (pool.length || moves.length))
    ];

    if (!pick) {
      continue;
    }

    const name = PLANET_KO[planet];

    return {
      kind: "retro",
      name,
      planet,
      frames: dates.map((date, k) => ({ date, target: targets[k] })),
      intervalDays: spacing,
      view,
      magLimit: s.magLimit,
      targetMag: planetMagnitude(planet, jdOf(opposition)),
      color: PLANET_COLOR[planet],
      path: pathBetween(dates[0], spacing * (frames - 1), at),
      oppositionDate: opposition,
      bonus: {
        question: `보너스: ${pick.k + 1}장째에서 ${pick.k + 2}장째로 넘어갈 때 ${name}은 별 사이에서 어느 쪽으로 움직였나요? (지도는 왼쪽이 동쪽이에요)`,
        options: DIRECTION_OPTIONS,
        answer: pick.d > 0 ? 0 : 1,
        explain:
          pick.d > 0
            ? `이때는 황도를 따라 동쪽으로 ${pick.d.toFixed(1)}° 갔어요. 행성은 보통 이렇게 별 사이를 서쪽에서 동쪽으로 옮겨 가요(순행).`
            : `이때는 거꾸로 서쪽으로 ${(-pick.d).toFixed(1)}° 갔어요(역행). 지구가 안쪽 길에서 ${name}을 앞지르는 충 무렵이라, 고속도로에서 느린 차를 앞지를 때 그 차가 뒤로 가는 것처럼 보이는 것과 같아요.`,
        frameIndex: pick.k,
      },
    };
  }

  return null;
};

export const SUN_DIRECTION_OPTIONS = ["위쪽", "오른쪽", "아래쪽", "왼쪽"];

// 지도 위에서 혜성 머리 → 해 쪽 방향 (화면 각, 0 = 위쪽, 시계 방향 90 = 오른쪽)
export const sunScreenAngleDeg = (
  view: FieldView,
  target: Point3D,
  jd: number,
): number | null => {
  const sun = normalize(sunGeocentric(jd));
  const t = target;
  const along = normalize(
    [0, 1, 2].map((i) => t[i] + 0.01 * (sun[i] - dot(sun, t) * t[i])),
  );
  const a = projectField(view, t);
  const b = projectField(view, along);

  if (!a || !b) {
    return null;
  }

  return (Math.atan2(b[0] - a[0], -(b[1] - a[1])) / D + 360) % 360;
};

// 혜성 꼬리 길이 (au). 실제 꼬리 길이는 계산하지 않고, 해에 가까울수록 길게 그리는 그림용 값
const tailLengthAu = (sunDistanceAu: number) =>
  Math.min(0.3, 0.08 / sunDistanceAu);

export const cometFrame = (comet: Comet, date: Date): WanderFrame => {
  const p = cometPosition(comet, jdOf(date));
  const L = tailLengthAu(p.sunDistanceAu);

  return {
    date,
    target: p.vector,
    tail: normalize(
      [0, 1, 2].map((i) => p.vector[i] * p.distanceAu + p.antiSun[i] * L),
    ),
  };
};

const makeCometProblem = (
  rng: () => number,
  s: Settings,
  comet: Comet,
): WanderProblem | null => {
  const from = new Date(`${comet.from}T12:00:00Z`);
  const to = new Date(`${comet.to}T12:00:00Z`);
  const windowDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  const frames = 4;

  for (let attempt = 0; attempt < 60; attempt++) {
    const start = addDays(from, Math.floor(rng() * windowDays));
    const at = (d: Date) => cometPosition(comet, jdOf(d)).vector;
    const speed = angleDeg(at(start), at(addDays(start, 1)));
    const interval = Math.max(1, Math.min(10, Math.round(2.5 / speed)));
    const dates = Array.from({ length: frames }, (_, k) =>
      addDays(start, k * interval),
    );

    if (dates[frames - 1] > to) {
      continue;
    }

    const list = dates.map((d) => cometFrame(comet, d));

    if (list.some((f) => elongationDeg(f.target, jdOf(f.date)) < 25)) {
      continue; // 해 가까이라 하늘이 밝다
    }

    const span = angleDeg(list[0].target, list[frames - 1].target);
    const view = placeView(
      rng,
      list.map((f) => f.target),
      Math.min(100, Math.max(s.fovDeg, span * 1.7)),
    );

    if (!view) {
      continue;
    }

    // 보너스: 해는 어느 쪽? 대각선에 가까워 헷갈리는 장은 피한다
    const asks = list
      .map((f, k) => ({
        k,
        a: sunScreenAngleDeg(view, f.target, jdOf(f.date)),
      }))
      .filter(
        (x): x is { k: number; a: number } =>
          x.a !== null && Math.abs((x.a % 90) - 45) > 15,
      );
    const ask = asks[Math.floor(rng() * asks.length)];
    const answer = ask ? Math.round(ask.a / 90) % 4 : -1;

    return {
      kind: "comet",
      name: comet.name,
      comet,
      frames: list,
      intervalDays: interval,
      view,
      magLimit: s.magLimit,
      targetMag: 1.5,
      color: "215,245,235",
      path: pathBetween(dates[0], interval * (frames - 1), at),
      bonus: ask
        ? {
            question: `보너스: ${ask.k + 1}장째에서 해는 혜성 머리에서 어느 쪽에 있을까요? (해는 지도 밖에 있어요)`,
            options: SUN_DIRECTION_OPTIONS,
            answer,
            explain: `해는 ${SUN_DIRECTION_OPTIONS[answer]}이에요. 혜성 꼬리는 햇빛과 태양풍에 밀려 언제나 해의 반대쪽으로 뻗어요. 그래서 꼬리가 뻗은 반대쪽을 따라가면 해가 있어요.`,
            frameIndex: ask.k,
          }
        : undefined,
    };
  }

  return null;
};

// 한 판의 문제들. 같은 시드·난이도면 같은 문제다
export const makeWanderGame = (
  seed: number,
  difficulty: WanderDifficulty,
): WanderProblem[] => {
  const s = WANDER_SETTINGS[difficulty];
  const rng = createRng(seed);
  // 혜성은 한 판에서 겹치지 않게 차례로
  const cometOffset = Math.floor(rng() * COMETS.length);
  let cometNo = 0;
  const planetOffset = Math.floor(rng() * s.planets.length);
  let planetNo = 0;

  return s.kinds.map((kind) => {
    let p: WanderProblem | null = null;

    if (kind === "comet") {
      for (let k = 0; k < COMETS.length && !p; k++) {
        p = makeCometProblem(
          rng,
          s,
          COMETS[(cometOffset + cometNo++) % COMETS.length],
        );
      }
    } else if (kind === "retro") {
      p = makeRetroProblem(rng, s);
    }

    return (
      p ??
      makePlanetProblem(
        rng,
        s,
        s.planets[(planetOffset + planetNo++) % s.planets.length],
      ) ??
      makePlanetProblem(rng, WANDER_SETTINGS.easy)!
    );
  });
};

// ---------- 채점 ----------

// 누른 자리가 그 장의 떠돌이별인지 (radius: 화면 픽셀)
export const isHit = (
  problem: WanderProblem,
  frameIndex: number,
  [x, y]: Point2D,
  radius: number,
) => {
  const p = projectField(problem.view, problem.frames[frameIndex].target);

  return p !== null && Math.hypot(p[0] - x, p[1] - y) <= radius;
};

export const scoreRound = (r: {
  found: boolean;
  wrongTaps: number;
  usedHint: boolean;
  bonusCorrect: boolean;
}) =>
  (r.found
    ? Math.max(
        MIN_FOUND_POINTS,
        ROUND_POINTS - r.wrongTaps * WRONG_COST - (r.usedHint ? HINT_COST : 0),
      )
    : 0) + (r.bonusCorrect ? BONUS_POINTS : 0);

// 한 판에서 낼 수 있는 가장 높은 점수
export const maxScore = (problems: WanderProblem[]) =>
  problems.reduce((s, p) => s + ROUND_POINTS + (p.bonus ? BONUS_POINTS : 0), 0);

export const dateLabel = (d: Date) =>
  `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
