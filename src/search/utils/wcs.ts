import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";

// WCS(world coordinate solution) 유틸: mathjs 없는 순수 3x3 행렬·투영 연산.
// gnomonic 투영 규약은 시스템의 plane.ts와 동일하다(행이 정규직교 기저 u,v,c).
// 검증 코어(pose 복원)와 합성 생성기(projection.ts)가 함께 쓴다.

const normalize3 = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

const cross3 = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const mat3MulVec = (m: Mat3, v: Point3D): Point3D => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

export const mat3Mul = (a: Mat3, b: Mat3): Mat3 => {
  const r: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;

      for (let k = 0; k < 3; k++) {
        s += a[i][k] * b[k][j];
      }

      r[i][j] = s;
    }
  }

  return r;
};

export const mat3Inv = (m: Mat3): Mat3 => {
  const a = m[0][0];
  const b = m[0][1];
  const c = m[0][2];
  const d = m[1][0];
  const e = m[1][1];
  const f = m[1][2];
  const g = m[2][0];
  const h = m[2][1];
  const i = m[2][2];

  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;

  if (Math.abs(det) < 1e-15) {
    throw new Error("mat3Inv: 행렬을 역변환할 수 없다 (det≈0)");
  }

  const invDet = 1 / det;

  return [
    [A * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [B * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [C * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
};

// 광축 방향으로부터 gnomonic 투영 행렬(행이 정규직교 기저 u,v,c)을 만든다.
// plane.ts의 calculateProjectTransform와 같은 결과(직교행렬이라 inv=transpose).
export const projectionMatrix = (center: Point3D): Mat3 => {
  const c = normalize3(center);
  const arbitrary: Point3D =
    c[0] !== 0 || c[2] !== 0 ? [-c[2], 0, c[1]] : [0, -c[2], c[1]];
  const u = normalize3(cross3(c, arbitrary));
  const v = cross3(c, u);

  return [u, v, c];
};

// 별 벡터 → 사진 픽셀. 광축 반대 반구면 null.
export const projectVecToPhoto = (TP: Mat3, star: Point3D): Point2D | null => {
  const p = mat3MulVec(TP, star);

  if (p[2] <= 0) {
    return null;
  }

  return [p[0] / p[2], p[1] / p[2]];
};

// 사진 픽셀 → 천구 방향(단위 벡터).
export const photoToSky = (TP: Mat3, point: Point2D): Point3D => {
  const inv = mat3Inv(TP);

  return normalize3(mat3MulVec(inv, [point[0], point[1], 1]));
};

// 변환행렬에서 광축 방향 복원 (화면 중앙의 역투영).
export const recoverCenter = (
  TP: Mat3,
  width: number,
  height: number,
): Point3D => photoToSky(TP, [width / 2, height / 2]);

// 변환행렬에서 시야각(짧은 변 기준, 라디안) 복원.
export const recoverFov = (TP: Mat3, width: number, height: number): number => {
  const shortHalf = Math.min(width, height) / 2;
  const c = recoverCenter(TP, width, height);
  const edge =
    width <= height
      ? photoToSky(TP, [width / 2 + shortHalf, height / 2])
      : photoToSky(TP, [width / 2, height / 2 + shortHalf]);
  const dot = Math.max(
    -1,
    Math.min(1, c[0] * edge[0] + c[1] * edge[1] + c[2] * edge[2]),
  );

  return 2 * Math.acos(dot);
};
