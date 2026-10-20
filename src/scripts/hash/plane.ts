import { Point2D, Point3D } from "@/scripts/hash/types";

// 별 방향들을 그 중심에 닿는 접선 평면으로 투영한다 (gnomonic). 사진의 직선투영과 같은 모양이 된다.
// 순수 JS (예전에는 mathjs 행렬 연산이었다 — 브라우저 Worker에 mathjs를 싣지 않으려고 바꿨다).

export const projectToTangentPlane = (vectors: Point3D[]): Point2D[] => {
  const [u, v, c] = tangentBasis(findCenter(vectors));

  return vectors.map((x) => {
    const w = dot(c, x);

    return [dot(u, x) / w, dot(v, x) / w];
  });
};

export const findCenter = (vectors: Point3D[]): Point3D => {
  const sum: Point3D = [0, 0, 0];

  for (const v of vectors) {
    sum[0] += v[0];
    sum[1] += v[1];
    sum[2] += v[2];
  }

  return normalize(sum);
};

// 중심 c에 직교하는 단위 벡터 u, v와 c. [u, v, c]가 정규직교라, 좌표 변환(역행렬)은 각 축과의 내적이다.
export const tangentBasis = (center: Point3D): [Point3D, Point3D, Point3D] => {
  const c = center;
  const arbitrary: Point3D =
    c[0] !== 0 || c[2] !== 0 ? [-c[2], 0, c[1]] : [0, -c[2], c[1]];
  const u = normalize(cross(c, arbitrary));
  const v = cross(c, u);

  return [u, v, c];
};

// 접선 평면 투영 행렬 (행이 u, v, c — 3D 방향에 곱하면 [u·x, v·x, c·x])
export const calculateProjectTransform = (center: Point3D): Point3D[] =>
  tangentBasis(center);

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const normalize = (v: Point3D): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};
