import type { ShotTime } from "@/plate-solver/shotTime";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { SEA_SCENE } from "@/game/humanVsComputer/seaScene";
import {
  constellationCenter,
  constellationParts,
  STARS,
} from "@/game/sky/catalog";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { createRng } from "@/utils/rng";

// 사람 계산원 vs 컴퓨터 (docs/game-plans.md 3절): 저장소 샘플 사진 한 장마다 "사진에 찍힌 별자리"를 보기 넷 중에서 고른다.
// 같은 순간 컴퓨터는 앱과 같은 풀이(별 찾기 Worker → 풀이 Worker)를 돌린다.
// 마지막 판은 별이 열 개 남짓인 바닷가 사진(직접 만든 장면, seaScene.ts) — 컴퓨터가 별만으로는 확신하지 못하고,
// 사람이 단서를 주면 풀린다.

export interface VersusRound {
  file: string; // public/samples 안의 파일 이름 (반전 판 말고는 src/services/samples.ts와 같다)
  title: string;
  answer: string; // 별자리 데이터의 이름 (vectors-constellations.json label)
  // 사진 안에 별이 두 개 넘게 들어오는 유명한 별자리 — 헷갈리지 않게 오답 보기에서 뺀다.
  // 정답 자세(src/test/real/solvedPoses.json)로 별자리 별을 사진에 투영해 셌다 (2026-10-23)
  inPhoto: string[];
  hint: string; // 답을 낸 뒤 보여 주는 한 줄
  reversal?: boolean; // 반전 판 (컴퓨터가 별만으로는 못 푼다)
  clues?: ReversalClues; // 반전 판에서 사람이 주는 단서
}

export interface ReversalClues {
  shot: ShotTime & { observer: NonNullable<ShotTime["observer"]> }; // 알려 주는 날짜·시각·장소
  place: string;
  revealWith: string[]; // 함께 풀면 정답과 같이 그릴 별자리
}

// 첫 두 판: 별자리 모양이 또렷한 사진
export const EASY_ROUNDS: VersusRound[] = [
  {
    file: "big-dipper.jpg",
    title: "북두칠성",
    answer: "큰곰자리",
    inPhoto: ["큰곰자리", "작은곰자리", "용자리"],
    hint: "국자 모양 일곱 별(북두칠성)이 큰곰의 등과 꼬리예요.",
  },
  {
    file: "cafe-orion.jpg",
    title: "오리온",
    answer: "오리온자리",
    inPhoto: ["오리온자리"],
    hint: "나란한 세 별(삼태성) 위아래로 붉은 베텔게우스와 푸른 리겔.",
  },
  {
    file: "20230904-nike-jeungseun-02.png",
    title: "여름 여행",
    answer: "큰곰자리",
    inPhoto: ["큰곰자리", "작은곰자리", "목동자리", "용자리"],
    hint: "세로로 선 국자 — 북두칠성이에요.",
  },
];

// 다음 두 판: 오로라·은하수·남반구처럼 사람이 찾기 어려운 사진
export const HARD_ROUNDS: VersusRound[] = [
  {
    file: "20230904-nike-jeungseun-03.png",
    title: "여름 여행",
    answer: "카시오페이아자리",
    inPhoto: [
      "카시오페이아자리",
      "안드로메다자리",
      "작은곰자리",
      "페르세우스자리",
      "용자리",
    ],
    hint: "W 모양 다섯 별. 북극성을 사이에 두고 북두칠성 반대편에 있어요.",
  },
  {
    file: "20250117-carl-aurora-03.jpg",
    title: "오로라",
    answer: "카시오페이아자리",
    inPhoto: [
      "카시오페이아자리",
      "안드로메다자리",
      "백조자리",
      "페가수스자리",
      "페르세우스자리",
      "작은곰자리",
      "용자리",
    ],
    hint: "오로라 너머로 W 모양 다섯 별이 보여요.",
  },
  {
    file: "20220328-brice-Milky Way over Buzzvil.jpg",
    title: "석촌호수 은하수",
    answer: "궁수자리",
    inPhoto: ["궁수자리", "전갈자리", "독수리자리"],
    hint: "은하수 가운데의 주전자 모양이 궁수자리예요. 은하의 중심이 그 너머에 있어요.",
  },
  {
    file: "20250117-carl-aurora-01.jpg",
    title: "오로라",
    answer: "페르세우스자리",
    inPhoto: [
      "페르세우스자리",
      "안드로메다자리",
      "황소자리",
      "마차부자리",
      "양자리",
    ],
    hint: "오로라 너머 페르세우스. 아래쪽 작은 별 무리는 좀생이별(플레이아데스)이에요.",
  },
  {
    file: "20250117-carl-aurora-04.jpg",
    title: "오로라",
    answer: "거문고자리",
    inPhoto: [
      "거문고자리",
      "백조자리",
      "독수리자리",
      "용자리",
      "헤르쿨레스자리",
      "세페우스자리",
    ],
    hint: "작은 평행사변형 끝에 아주 밝은 직녀성(베가)이 있어요.",
  },
];

// 반전 판: 별이 열 개 남짓, 사람의 단서(촬영 시각·장소, 수평선)가 있어야 풀린다.
// 예전에는 사이판 바다 사진을 썼지만 사람이 크게 찍혀 있어, 같은 상황을 직접 만든 장면으로 바꿨다.
export const REVERSAL_ROUND: VersusRound = {
  file: SEA_SCENE.file,
  title: "여름밤 바다",
  answer: "전갈자리",
  // 정답 자세로 별자리 별을 수평선 위 사진 안에 투영해 셌다 (궁수는 둘이지만 헷갈리지 않게 뺀다)
  inPhoto: [
    "전갈자리",
    "이리자리",
    "뱀주인자리",
    "천칭자리",
    "제단자리",
    "궁수자리",
  ],
  hint: "주황빛 안타레스가 전갈의 심장, 오른쪽 위로 세로로 늘어선 별들이 머리예요. 꼬리는 왼쪽 구름에 숨고 끝의 두 별만 살짝 보여요.",
  reversal: true,
  clues: {
    shot: SEA_SCENE.clue,
    place: SEA_SCENE.place,
    revealWith: [],
  },
};

// 오답 보기로 쓰는 유명한 별자리
export const FAMOUS = [
  "큰곰자리",
  "작은곰자리",
  "카시오페이아자리",
  "오리온자리",
  "황소자리",
  "쌍둥이자리",
  "큰개자리",
  "사자자리",
  "목동자리",
  "거문고자리",
  "백조자리",
  "독수리자리",
  "전갈자리",
  "궁수자리",
  "페가수스자리",
  "남십자자리",
  "페르세우스자리",
];

export const CHOICES = 4;

const shuffle = <T>(list: T[], rng: () => number): T[] =>
  list
    .map((item) => ({ item, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(({ item }) => item);

// 한 판의 보기: 정답 하나 + 사진에 없는 유명한 별자리 셋 (섞어서)
export const choicesFor = (round: VersusRound, rng: () => number): string[] =>
  shuffle(
    [
      round.answer,
      ...shuffle(
        FAMOUS.filter((label) => !round.inPhoto.includes(label)),
        rng,
      ).slice(0, CHOICES - 1),
    ],
    rng,
  );

export interface PlannedRound extends VersusRound {
  choices: string[];
}

// 한 게임: 쉬운 사진 둘 → 어려운 사진 둘 → 반전 판. 같은 별자리가 정답인 판은 한 번만
// (반전 판의 정답이 앞에서 나오면 마지막 판의 답이 쉬워지므로 앞 판에서도 뺀다)
export const planGame = (seed: number): PlannedRound[] => {
  const rng = createRng(seed);
  const picked: VersusRound[] = [];

  for (const [pool, n] of [
    [EASY_ROUNDS, 2],
    [HARD_ROUNDS, 2],
  ] as const) {
    for (const round of shuffle(pool, rng)) {
      if (
        picked.filter((r) => pool.includes(r)).length < n &&
        ![...picked, REVERSAL_ROUND].some((r) => r.answer === round.answer)
      ) {
        picked.push(round);
      }
    }
  }

  return [...picked, REVERSAL_ROUND].map((round) => ({
    ...round,
    choices: choicesFor(round, rng),
  }));
};

// ---------- 점수 ----------

export const BASE_POINTS = 1000;
export const POINTS_PER_SECOND = 20;
export const MISS_PENALTY = 200;
export const MIN_POINTS = 100;
// 반전 판에서 사람이 단서를 줘 함께 풀면 더 받는 점수
export const TEAM_BONUS = 500;

export const pointsFor = (seconds: number, misses: number) =>
  Math.max(
    MIN_POINTS,
    Math.round(
      BASE_POINTS -
        Math.max(0, seconds) * POINTS_PER_SECOND -
        misses * MISS_PENALTY,
    ),
  );

// "컴퓨터 0.4초 vs 나 12초"를 사람이 읽기 좋게: 1초 아래는 소수 둘째 자리까지
export const formatSeconds = (ms: number) => {
  const s = ms / 1000;

  return s < 1
    ? `${s.toFixed(2)}초`
    : s < 10
      ? `${s.toFixed(1)}초`
      : `${Math.round(s)}초`;
};

// 사람 시간 ÷ 컴퓨터 시간 (몇 배 빨랐나)
export const speedRatio = (humanMs: number, computerMs: number) =>
  computerMs > 0 ? humanMs / computerMs : Infinity;

// ---------- 보기 카드의 별자리 모양 ----------

// 별자리 가운데에서 본 접선 평면 (북쪽이 위, 하늘을 올려다본 방향이라 동쪽이 왼쪽)
export const constellationShape = (label: string): Point2D[][] => {
  const parts = constellationParts(label);

  if (parts.length === 0) {
    return [];
  }

  const c = constellationCenter(parts);
  const east = normalize(cross([0, 0, 1], c));
  const north = cross(c, east);

  return parts.map((part) =>
    part.stars.map((v): Point2D => {
      const z = dot(v, c);

      return [-dot(v, east) / z, -dot(v, north) / z];
    }),
  );
};

// ---------- 컴퓨터가 푼 과정 보여 주기 ----------

export interface PhotoStar {
  x: number;
  y: number;
}

export interface MatchedStar {
  photo: Point2D;
  map: Point2D;
  vector: Point3D;
  mag: number;
  name?: string;
  rank: number; // 사진 별 순서 (풀이 우선순위)
}

// 확인 단계의 겹침: 답(TP)대로 별 지도를 사진에 겹쳐, 허용 반경 안에서 만난 사진 별과 지도 별.
// 허용 반경은 풀이(solveCore)와 같은 max(5, 대각선×0.006)
export const overlapOf = (
  TP: Mat3,
  photo: PhotoStar[],
  width: number,
  height: number,
) => {
  const tol = Math.max(5, Math.hypot(width, height) * 0.006);
  const map = STARS.flatMap((s) => {
    const p = projectVecToPhoto(TP, s.vector);

    return p && p[0] >= 0 && p[0] < width && p[1] >= 0 && p[1] < height
      ? [{ p, star: s }]
      : [];
  });
  const pairs: MatchedStar[] = [];
  const used = new Set<number>();

  photo.forEach((s, rank) => {
    let best = -1;
    let bestD = tol;

    map.forEach((m, k) => {
      const d = Math.hypot(m.p[0] - s.x, m.p[1] - s.y);

      if (d < bestD && !used.has(k)) {
        bestD = d;
        best = k;
      }
    });

    if (best >= 0) {
      used.add(best);
      pairs.push({
        photo: [s.x, s.y],
        map: map[best].p,
        vector: map[best].star.vector,
        mag: map[best].star.mag,
        name: map[best].star.name,
        rank,
      });
    }
  });

  return { tol, map: map.map((m) => m.p), pairs };
};

const triangleArea = (a: Point2D, b: Point2D, c: Point2D) =>
  Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

// 모양 맞추기 단계의 예: 풀이가 먼저 보는 밝은 별(앞쪽 10개) 가운데 지도와 겹친 별로 만든,
// 너무 납작하지 않은 가장 큰 삼각형. 컴퓨터가 실제로 짝지은 삼각형과 같지는 않지만 같은 원리다.
export const exampleTriangle = (
  pairs: MatchedStar[],
  width: number,
  height: number,
  firstN = 10,
): MatchedStar[] | null => {
  const front = pairs.filter((p) => p.rank < firstN);
  const pool = front.length >= 3 ? front : pairs.slice(0, 8);
  const minSide = Math.hypot(width, height) * 0.05;
  let best: MatchedStar[] | null = null;
  let bestScore = 0;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const [a, b, c] = [pool[i], pool[j], pool[k]];
        const sides = [
          Math.hypot(a.photo[0] - b.photo[0], a.photo[1] - b.photo[1]),
          Math.hypot(b.photo[0] - c.photo[0], b.photo[1] - c.photo[1]),
          Math.hypot(c.photo[0] - a.photo[0], c.photo[1] - a.photo[1]),
        ];

        if (Math.min(...sides) < minSide) {
          continue;
        }

        const area = triangleArea(a.photo, b.photo, c.photo);
        // 넓이를 가장 긴 변의 제곱으로 나눈 값으로 납작함을 본다 (정삼각형 약 0.43)
        const fat = area / Math.max(...sides) ** 2;
        const score = fat > 0.12 ? area : 0;

        if (score > bestScore) {
          bestScore = score;
          best = [a, b, c];
        }
      }
    }
  }

  return best;
};

// ---------- 작은 벡터 계산 ----------

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const normalize = (v: Point3D): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 별 지도(천구) 위 삼각형을 북쪽이 위인 평면으로 (모양 맞추기 단계의 "별 지도 속 같은 삼각형")
export const skyTriangle = (stars: Point3D[]): Point2D[] => {
  const c = normalize(
    stars.reduce<Point3D>(
      (s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]],
      [0, 0, 0],
    ),
  );
  const east = normalize(cross([0, 0, 1], c));
  const north = cross(c, east);

  return stars.map((v): Point2D => {
    const z = dot(v, c);

    return [-dot(v, east) / z, -dot(v, north) / z];
  });
};
