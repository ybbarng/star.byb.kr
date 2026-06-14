import type { Point3D } from "@/scripts/hash/types";
import type { SolveStar } from "@/search/solveCore";
import * as kdtree from "kd-tree-javascript";

// 최선 알고리즘(Triangle matching / Geometric Voting)을 위한 카탈로그 기하 인덱스.
// quad geometric hashing과 달리, 별쌍/삼각형의 각거리를 직접 인덱싱한다.

const angDist = (a: Point3D, b: Point3D): number => {
  const dot = Math.max(
    -1,
    Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  );

  return Math.acos(dot);
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

        const d01 = angDist(stars[tri[0]].vector, stars[tri[1]].vector);
        const d02 = angDist(stars[tri[0]].vector, stars[tri[2]].vector);
        const d12 = angDist(stars[tri[1]].vector, stars[tri[2]].vector);
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
