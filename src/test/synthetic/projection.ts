import * as math from "mathjs";
import { calculateProjectTransform } from "@/scripts/hash/plane";
import type { Point2D, Point3D } from "@/scripts/hash/types";

// 합성 테스트 사진을 위한 gnomonic(접선평면 중심투영) 카메라 모델.
//
// 시스템의 투영 규약과 한 글자도 다르지 않게 하기 위해, 접선평면 투영부 P는
// src/scripts/hash/plane.ts의 calculateProjectTransform를 그대로 재사용한다.
// 카메라(픽셀) 변환부 T만 FOV/회전/화면중심으로부터 직접 구성한다.
//
// 좌표 흐름(검증 단계 transform.ts와 동일):
//   별 벡터(3D) → TP·v (3D 동차) → toCartesian([X/Z, Y/Z]) → 사진 픽셀 좌표(2D)
// T가 마지막 행 [0,0,1]을 유지하므로 P 뒤에 행렬곱하고 마지막에 한 번 나눠도
// "s·R·(접선평면 좌표) + 화면중심"이 된다.

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export interface GroundTruthTransform {
  TP: Mat3; // 별 벡터 → 사진(동차). toCartesian 필요.
  T: Mat3; // 접선평면 → 픽셀 (아핀)
  P: Mat3; // 별 벡터 → 접선평면 (plane.ts 재사용)
}

const normalize = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 광축 방향(center), 시야각(fovRad), 화면 회전(rotationRad), 해상도로부터
// 정답 변환행렬을 만든다. fovRad는 화면 짧은 변(min(w,h))이 덮는 각도.
export const buildGroundTruthTransform = (
  center: Point3D,
  fovRad: number,
  rotationRad: number,
  width: number,
  height: number,
): GroundTruthTransform => {
  const P = calculateProjectTransform(normalize(center)) as unknown as Mat3;

  // 접선평면에서 광축으로부터 fov/2 떨어진 점의 좌표 반경 = tan(fov/2).
  // 그 점이 화면 짧은 변의 절반(min(w,h)/2)에 오도록 픽셀 스케일 s를 정한다.
  const s = Math.min(width, height) / 2 / Math.tan(fovRad / 2);
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  const T: Mat3 = [
    [s * cos, -s * sin, width / 2],
    [s * sin, s * cos, height / 2],
    [0, 0, 1],
  ];

  const TP = math.multiply(T, P) as unknown as Mat3;

  return { TP, T, P };
};

// 별 벡터를 사진 픽셀 좌표로 투영한다. 광축 반대 반구(뒤쪽)면 null.
// 화면 범위(0..width, 0..height) 판정은 호출 측에서 한다.
export const projectStarToPhoto = (star: Point3D, TP: Mat3): Point2D | null => {
  const p = math.multiply(TP, star) as unknown as number[];

  // p[2] = center·star (광축과의 내적). 0 이하면 반대 반구라 투영 불가.
  if (p[2] <= 0) {
    return null;
  }

  return [p[0] / p[2], p[1] / p[2]];
};

// 사진 픽셀 좌표를 천구 방향(단위 벡터)으로 역변환한다.
export const photoToSky = (point: Point2D, TP: Mat3): Point3D => {
  const inv = math.inv(TP) as unknown as Mat3;
  const v = math.multiply(inv, [point[0], point[1], 1]) as unknown as Point3D;

  return normalize(v);
};

// 추정/정답 변환행렬에서 광축 방향을 복원한다 (화면 중앙의 역투영).
export const recoverCenter = (
  TP: Mat3,
  width: number,
  height: number,
): Point3D => {
  return photoToSky([width / 2, height / 2], TP);
};

// 변환행렬에서 시야각(짧은 변 기준, 라디안)을 복원한다.
// 화면 중앙과 짧은 변 가장자리 중점 사이의 천구 각거리 × 2.
export const recoverFov = (TP: Mat3, width: number, height: number): number => {
  const shortHalf = Math.min(width, height) / 2;
  const c = recoverCenter(TP, width, height);
  const edge =
    width <= height
      ? photoToSky([width / 2 + shortHalf, height / 2], TP)
      : photoToSky([width / 2, height / 2 + shortHalf], TP);
  const dot = Math.max(
    -1,
    Math.min(1, c[0] * edge[0] + c[1] * edge[1] + c[2] * edge[2]),
  );

  return 2 * Math.acos(dot);
};
