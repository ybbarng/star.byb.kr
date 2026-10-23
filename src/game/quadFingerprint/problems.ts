import type { Fingerprint, Reading } from "@/game/quadFingerprint/fingerprint";
import type { Point2D } from "@/scripts/hash/types";
import {
  axisTransform,
  equivalentFingerprints,
  isCanonical,
  matchError,
  readingsOf,
} from "@/game/quadFingerprint/fingerprint";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { calculateHash } from "@/scripts/hash/hash";
import { projectToTangentPlane } from "@/scripts/hash/plane";
import { generateQuadDatabase } from "@/search/quadDatabase";
import { createRng } from "@/utils/rng";

// 별 넷 지문 맞추기의 문제: 별 지도의 실제 quad(generateQuadDatabase, 풀이와 같은 규칙)에서 고른다.
//
// 두 가지 문제를 번갈아 낸다.
//   - pick: 지문(좌표판 위 C·D 두 점, 어려움은 숫자만)을 보고 보기 모양 중에서 그 지문의 모양을 고른다
//   - place: 별 넷 모양을 보고 좌표판에 C·D 자리를 찍는다 (가까울수록 점수)
//
// 모양은 하늘을 올려다본 모습 그대로 그린다: 접선 평면 좌표 (u, v)는 하늘 바깥에서 본 거울상이라 x를 뒤집는다.
// 그래서 여기 지문은 별 지도 DB에 적힌 값의 거울상 지문이다 (화면에 그린 모양에 calculateHash를 그대로 쓴 값).

export type Difficulty = "intro" | "easy" | "normal" | "hard";

// 사람 눈대중으로 축을 잡을 때, 가장 먼 쌍보다 이만큼(비율) 짧은 쌍까지 축으로 인정한다
export const AXIS_TOLERANCE = 0.08;
// pick에서 보기가 지문의 모양인지 가르는 거리 (같은 모양이면 계산 오차뿐이라 0에 가깝다)
const SAME_SHAPE = 0.02;

export interface QuadShape {
  hrs: string[];
  points: Point2D[]; // 하늘을 올려다본 모습 (y가 위)
  mags: number[];
  names: (string | undefined)[];
  constellation?: string;
  fingerprint: Fingerprint; // calculateHash 그대로
}

export interface ShownShape {
  shape: QuadShape;
  points: Point2D[]; // 돌린 화면용 좌표 (y가 위, 가장 먼 두 별 거리가 1)
  size: number; // 그릴 크기 (1이 기본, 보통·어려움은 작게도)
  mirrored: boolean; // 거울에 비친 가짜 보기
}

export interface PickRound {
  kind: "pick";
  answer: QuadShape;
  fingerprint: Fingerprint; // 보여 줄 지문 (정답 모양의 calculateHash)
  options: ShownShape[];
  correct: number;
}

export interface PlaceRound {
  kind: "place";
  answer: QuadShape;
  shown: ShownShape;
}

export type Round = PickRound | PlaceRound;

interface Setting {
  maxMag: number; // 정답 quad 별이 모두 이 등급보다 밝다
  minSpread: number; // 정규화한 네 점끼리 이만큼 떨어져 있다 (뭉친 모양은 알아보기 어렵다)
  allowTies: boolean; // 가장 먼 쌍이 거의 같은 모양(지문 둘)도 낸다
  options: number;
  far: number; // 가짜 보기의 지문이 정답 지문과 적어도 이만큼 다르다
  near?: [number, number, number]; // 닮은 가짜: [개수, 최소, 최대 거리]
  mirror: boolean; // 거울상 가짜 보기
  rotate: number; // 돌림 범위 (도, 입문은 축을 비스듬히 둔 채 조금만)
  scaleMin: number; // 크기 변화 (1이면 그대로)
}

export const SETTINGS: Record<Difficulty, Setting> = {
  intro: {
    maxMag: 3,
    minSpread: 0.28,
    allowTies: false,
    options: 3,
    far: 0.45,
    mirror: false,
    rotate: 25,
    scaleMin: 1,
  },
  easy: {
    maxMag: 3.3,
    minSpread: 0.22,
    allowTies: false,
    options: 4,
    far: 0.32,
    mirror: false,
    rotate: 180,
    scaleMin: 1,
  },
  normal: {
    maxMag: 3.6,
    minSpread: 0.18,
    allowTies: true,
    options: 4,
    far: 0.25,
    near: [2, 0.12, 0.25],
    mirror: false,
    rotate: 180,
    scaleMin: 0.6,
  },
  hard: {
    maxMag: 3.8,
    minSpread: 0.15,
    allowTies: true,
    options: 4,
    far: 0.2,
    near: [2, 0.08, 0.2],
    mirror: true,
    rotate: 180,
    scaleMin: 0.55,
  },
};

export const ROUNDS = 6;

const vecKey = (v: number[]) => v.map((x) => x.toFixed(5)).join(",");

// 별 → 별자리 이름 (별자리선에 든 별만)
let constellationOf: Map<string, string> | null = null;

const findConstellation = (vectors: number[][]) => {
  if (!constellationOf) {
    constellationOf = new Map();

    for (const c of CONSTELLATIONS) {
      for (const v of c.stars) {
        constellationOf.set(vecKey(v), c.label);
      }
    }
  }

  const counts = new Map<string, number>();

  for (const v of vectors) {
    const label = constellationOf.get(vecKey(v));

    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

// 정규화한 네 점(A·B·C·D)끼리 가장 가까운 거리
const spreadOf = (f: Fingerprint) => {
  const pts: Point2D[] = [
    [0, 0],
    [1, 1],
    [f[0], f[1]],
    [f[2], f[3]],
  ];
  let min = Infinity;

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      min = Math.min(
        min,
        Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]),
      );
    }
  }

  return min;
};

let pool: QuadShape[] | null = null;

// 4등급보다 밝은 별로 만든 quad 전부 (모든 별이 4등급 안인 quad는 전체 DB의 quad와 같다)
export const quadPool = (): QuadShape[] => {
  if (pool) {
    return pool;
  }

  const bright = STARS.filter((s) => s.mag <= 4);
  const byHr = new Map(bright.map((s) => [s.hr, s]));
  const quads = generateQuadDatabase(
    bright.map((s) => ({ hr: s.hr, vector: s.vector })),
  );

  pool = quads.map((q) => {
    const stars = q.stars.map((hr) => byHr.get(hr)!);
    const vectors = stars.map((s) => s.vector);
    // 올려다본 모습이 되도록 x를 뒤집는다
    const points = projectToTangentPlane(vectors).map(
      ([u, v]) => [-u, v] as Point2D,
    );
    const { hash } = calculateHash(
      points.map((vector, i) => ({ label: String(i), vector })) as Parameters<
        typeof calculateHash
      >[0],
    );

    return {
      hrs: stars.map((s) => s.hr),
      points,
      mags: stars.map((s) => s.mag),
      names: stars.map((s) => s.name),
      constellation: findConstellation(vectors),
      fingerprint: hash as Fingerprint,
    };
  });

  return pool;
};

// 지문이 둘 이상인 모양인가 (사람 눈대중으로 축이 헷갈리는 모양)
export const hasTwinFingerprints = (points: Point2D[]) =>
  equivalentFingerprints(points, AXIS_TOLERANCE).length > 1;

// 두 모양이 얼마나 다른가: 한쪽의 모든 읽기에 대해 다른 쪽을 가장 잘 맞춘 거리 중 가장 작은 것
export const shapeGap = (a: Point2D[], b: Point2D[]) =>
  Math.min(
    ...readingsOf(a, AXIS_TOLERANCE).map(
      (r) => matchError(b, r.hash, AXIS_TOLERANCE).error,
    ),
  );

const mirror = (points: Point2D[]): Point2D[] =>
  points.map(([x, y]) => [-x, y]);

// 화면용: 입문은 축 A→B를 비스듬히(좌표판과 같은 방향) 둔 채 조금만 돌리고, 그 밖은 아무렇게나 돌리고 키운다
const showShape = (
  shape: QuadShape,
  points: Point2D[],
  mirrored: boolean,
  setting: Setting,
  rng: () => number,
): ShownShape => {
  const [r] = readingsOf(points).filter(isCanonical);
  // 축 A→B를 (0,0)→(1,1)로 놓은 좌표에서 시작한다 (가장 먼 거리 √2)
  const t = axisTransform(points[r.axis[0]], points[r.axis[1]]);
  const base = points.map(t);
  const angle =
    ((setting.rotate < 180 ? (rng() * 2 - 1) * setting.rotate : rng() * 360) *
      Math.PI) /
    180;
  const cos = Math.cos(angle) / Math.SQRT2;
  const sin = Math.sin(angle) / Math.SQRT2;

  return {
    shape,
    mirrored,
    size: setting.scaleMin + rng() * (1 - setting.scaleMin),
    points: base.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]),
  };
};

const shuffle = <T>(list: T[], rng: () => number) =>
  list
    .map((v) => ({ v, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(({ v }) => v);

const candidatesFor = (setting: Setting) =>
  quadPool().filter(
    (q) =>
      q.mags.every((m) => m <= setting.maxMag) &&
      spreadOf(q.fingerprint) >= setting.minSpread &&
      (setting.allowTies || !hasTwinFingerprints(q.points)),
  );

// 가짜 보기 고르기: 닮은 것(near) 먼저, 나머지는 충분히 다른 것. 가짜끼리도 서로 다른 모양이어야 한다
const pickDecoys = (
  answer: QuadShape,
  setting: Setting,
  rng: () => number,
): Omit<ShownShape, "size">[] => {
  const decoys: Omit<ShownShape, "size">[] = [];
  const used: Point2D[][] = [answer.points];
  const distinct = (p: Point2D[]) =>
    used.every((u) => shapeGap(u, p) >= Math.min(0.08, setting.far));

  if (setting.mirror) {
    const m = mirror(answer.points);

    if (shapeGap(answer.points, m) >= 0.1) {
      decoys.push({ shape: answer, points: m, mirrored: true });
      used.push(m);
    }
  }

  const others = shuffle(
    quadPool().filter(
      (q) =>
        q !== answer &&
        spreadOf(q.fingerprint) >= setting.minSpread * 0.7 &&
        !q.hrs.every((hr) => answer.hrs.includes(hr)),
    ),
    rng,
  );

  if (setting.near) {
    const [count, lo, hi] = setting.near;
    let found = 0;

    for (const q of others) {
      if (found >= count || decoys.length >= setting.options - 1) {
        break;
      }

      const gap = shapeGap(answer.points, q.points);

      if (gap >= lo && gap <= hi && distinct(q.points)) {
        decoys.push({ shape: q, points: q.points, mirrored: false });
        used.push(q.points);
        found++;
      }
    }
  }

  for (const q of others) {
    if (decoys.length >= setting.options - 1) {
      break;
    }

    if (
      shapeGap(answer.points, q.points) >= setting.far &&
      distinct(q.points)
    ) {
      decoys.push({ shape: q, points: q.points, mirrored: false });
      used.push(q.points);
    }
  }

  return decoys;
};

export const makeRounds = (difficulty: Difficulty, seed: number): Round[] => {
  const setting = SETTINGS[difficulty];
  const rng = createRng(seed);
  const answers = shuffle(candidatesFor(setting), rng);
  const rounds: Round[] = [];
  const usedStars = new Set<string>();

  for (const answer of answers) {
    if (rounds.length >= ROUNDS) {
      break;
    }

    // 한 판에 같은 별이 두 번 나오지 않게 (비슷한 문제가 이어지지 않도록)
    if (answer.hrs.some((hr) => usedStars.has(hr))) {
      continue;
    }

    answer.hrs.forEach((hr) => usedStars.add(hr));

    if (rounds.length % 2 === 0) {
      const decoys = pickDecoys(answer, setting, rng);
      const options = shuffle(
        [{ shape: answer, points: answer.points, mirrored: false }, ...decoys],
        rng,
      ).map((o) => showShape(o.shape, o.points, o.mirrored, setting, rng));

      rounds.push({
        kind: "pick",
        answer,
        fingerprint: answer.fingerprint,
        options,
        correct: options.findIndex((o) => o.shape === answer && !o.mirrored),
      });
    } else {
      rounds.push({
        kind: "place",
        answer,
        shown: showShape(answer, answer.points, false, setting, rng),
      });
    }
  }

  return rounds;
};

// pick 채점: 고른 보기가 지문의 모양인가 (돌리고 키운 것만 다르면 같은 모양)
export const isSameShape = (points: Point2D[], f: Fingerprint) =>
  matchError(points, f, AXIS_TOLERANCE).error < SAME_SHAPE;

export const PLACE_FULL = 0.03; // 이만큼 안이면 만점
export const PLACE_ZERO = 0.35; // 이만큼 넘으면 0점
export const MAX_POINTS = 1000;

/**
 * place 채점: 찍은 두 점(C·D 순서 상관없음)이 이 모양의 어느 읽기와 가장 가까운가.
 * 축은 거의 같은 거리의 쌍까지, A·B는 어느 방향이든 (사람이 A·B를 거꾸로 잡으면 (1-x, 1-y) 자리가 된다).
 */
export const gradePlace = (
  points: Point2D[],
  c: Point2D,
  d: Point2D,
): { error: number; score: number; reading: Reading } => {
  const { error, reading } = matchError(points, [...c, ...d], AXIS_TOLERANCE);
  const k = Math.min(
    1,
    Math.max(0, (PLACE_ZERO - error) / (PLACE_ZERO - PLACE_FULL)),
  );

  return { error, reading, score: Math.round(k * MAX_POINTS) };
};
