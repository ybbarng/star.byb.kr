import type { Point3D } from "@/scripts/hash/types";
import type { SolveStar } from "@/search/solveCore";
import * as kdtree from "kd-tree-javascript";
import { mat3MulVec, projectionMatrix } from "@/search/utils/wcs";

// 최선 알고리즘(Triangle matching / Geometric Voting)을 위한 카탈로그 기하 인덱스.
// quad geometric hashing과 달리, 별쌍/삼각형의 각거리를 직접 인덱싱한다.

// 삼각형 세 별을 그 중심 접선평면(gnomonic)에 투영한 2D 좌표.
// 사진 별도 gnomonic으로 찍히므로, 형태를 같은 기준으로 재야 큰 삼각형에서도
// 픽셀 형태와 어긋나지 않는다 (각거리로 재면 큰 삼각형이 왜곡됨).
const projectTriangle = (tri: Point3D[]): [number, number][] => {
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const v of tri) {
    cx += v[0];
    cy += v[1];
    cz += v[2];
  }

  const n = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const P = projectionMatrix([cx / n, cy / n, cz / n]);

  return tri.map((v) => {
    const p = mat3MulVec(P, v);

    return [p[0] / p[2], p[1] / p[2]];
  });
};

// === Triangle 인덱스 ===
// 삼각형을 "정점의 마주보는 변 각거리"로 정렬해, 형태를 스케일·회전 불변
// 키 (가장 짧은 마주변/가장 긴 마주변, 중간/가장 긴)로 인코딩한다.

export interface TriangleEntry {
  hrs: [string, string, string]; // 마주변 오름차순으로 정렬된 정점
}

export interface TriangleIndex {
  tree: InstanceType<typeof kdtree.kdTree>;
  entries: TriangleEntry[];
}

// 사진 삼각형도 같은 규약으로 형태 키를 만들기 위한 헬퍼 (변 길이 3개 입력).
// d01=정점0-1, d02=정점0-2, d12=정점1-2. 반환: [정렬된 정점 인덱스, 형태키].
export const triangleShape = (
  d01: number,
  d02: number,
  d12: number,
  idx: [number, number, number],
): { order: [number, number, number]; shape: [number, number] } => {
  // 각 정점의 마주변: 정점0↔d12, 정점1↔d02, 정점2↔d01
  const verts = [
    { i: idx[0], opp: d12 },
    { i: idx[1], opp: d02 },
    { i: idx[2], opp: d01 },
  ].sort((a, b) => a.opp - b.opp);
  const c = verts[2].opp;

  return {
    order: [verts[0].i, verts[1].i, verts[2].i],
    shape: c > 0 ? [verts[0].opp / c, verts[1].opp / c] : [0, 0],
  };
};

export const buildTriangleIndex = (
  stars: SolveStar[],
  maxAngleDeg = 8,
): TriangleIndex => {
  const cosMax = Math.cos((maxAngleDeg * Math.PI) / 180);
  const n = stars.length;

  // maxAngle 이내 이웃 그래프
  const nb: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = stars[i].vector;
      const b = stars[j].vector;

      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > cosMax) {
        nb[i].push(j);
        nb[j].push(i);
      }
    }
  }

  const seen = new Set<string>();
  const entries: TriangleEntry[] = [];
  const points: { i: number; x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const list = nb[i];

    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const tri = [i, list[a], list[b]].sort((x, y) => x - y) as [
          number,
          number,
          number,
        ];
        const key = tri.join(",");

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        // 접선평면 투영 거리로 형태 계산 (사진의 gnomonic 픽셀 형태와 일치)
        const pp = projectTriangle([
          stars[tri[0]].vector,
          stars[tri[1]].vector,
          stars[tri[2]].vector,
        ]);
        const d01 = Math.hypot(pp[0][0] - pp[1][0], pp[0][1] - pp[1][1]);
        const d02 = Math.hypot(pp[0][0] - pp[2][0], pp[0][1] - pp[2][1]);
        const d12 = Math.hypot(pp[1][0] - pp[2][0], pp[1][1] - pp[2][1]);
        const { order, shape } = triangleShape(d01, d02, d12, tri);

        entries.push({
          hrs: [stars[order[0]].hr, stars[order[1]].hr, stars[order[2]].hr],
        });
        points.push({ i: entries.length - 1, x: shape[0], y: shape[1] });
      }
    }
  }

  const tree = new kdtree.kdTree(
    points,
    (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2,
    ["x", "y"],
  );

  return { tree, entries };
};

export const searchTriangle = (
  index: TriangleIndex,
  shape: [number, number],
  k: number,
): TriangleEntry[] => {
  const nearest = index.tree.nearest(
    { i: 0, x: shape[0], y: shape[1] },
    k,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[];

  return nearest.map((r) => index.entries[r[0].i as number]);
};

// === Pair 인덱스 (Geometric Voting용) ===
// maxAngle 이내 카탈로그 별쌍을 각거리 오름차순으로 정렬해, 각거리 범위
// 검색을 이분탐색으로 한다.

export interface PairIndex {
  angles: number[]; // 오름차순 각거리(rad)
  hrA: string[];
  hrB: string[];
}

export const buildPairIndex = (
  stars: SolveStar[],
  maxAngleDeg = 15,
): PairIndex => {
  const cosMax = Math.cos((maxAngleDeg * Math.PI) / 180);
  const items: { a: string; b: string; ang: number }[] = [];

  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const va = stars[i].vector;
      const vb = stars[j].vector;
      const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];

      if (dot > cosMax) {
        items.push({
          a: stars[i].hr,
          b: stars[j].hr,
          ang: Math.acos(Math.min(1, dot)),
        });
      }
    }
  }

  items.sort((x, y) => x.ang - y.ang);

  return {
    angles: items.map((x) => x.ang),
    hrA: items.map((x) => x.a),
    hrB: items.map((x) => x.b),
  };
};

// 각거리 ∈ [lo, hi]인 별쌍 인덱스 범위 [start, end)를 이분탐색으로 찾는다.
export const searchPairRange = (
  index: PairIndex,
  lo: number,
  hi: number,
): [number, number] => {
  const a = index.angles;
  // lo 이상 첫 인덱스
  let s = 0;
  let e = a.length;

  while (s < e) {
    const m = (s + e) >> 1;

    if (a[m] < lo) {
      s = m + 1;
    } else {
      e = m;
    }
  }

  const start = s;
  // hi 초과 첫 인덱스
  e = a.length;
  let s2 = start;

  while (s2 < e) {
    const m = (s2 + e) >> 1;

    if (a[m] <= hi) {
      s2 = m + 1;
    } else {
      e = m;
    }
  }

  return [start, s2];
};
