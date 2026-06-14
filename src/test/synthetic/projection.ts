import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import {
  mat3Mul,
  photoToSky as wcsPhotoToSky,
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter as wcsRecoverCenter,
  recoverFov as wcsRecoverFov,
} from "@/search/utils/wcs";

// 합성 테스트 사진을 위한 gnomonic 카메라 모델.
// 투영·역투영·pose 복원은 프로덕션 코드 wcs.ts를 그대로 재사용한다
// (생성기-시스템 규약 불일치 차단 + 중복 제거). 이 모듈은 카메라(픽셀)
// 변환 T 구성과, 기존 테스트가 쓰던 함수 시그니처 어댑터만 담는다.

export type { Mat3 };

export interface GroundTruthTransform {
  TP: Mat3; // 별 벡터 → 사진(동차). toCartesian 필요.
  T: Mat3; // 접선평면 → 픽셀 (아핀)
  P: Mat3; // 별 벡터 → 접선평면 (wcs.projectionMatrix)
}

const normalize = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 광축(center), 시야각(fovRad, 짧은 변 기준), 화면 회전(rotationRad), 해상도로
// 정답 변환행렬을 만든다.
export const buildGroundTruthTransform = (
  center: Point3D,
  fovRad: number,
  rotationRad: number,
  width: number,
  height: number,
): GroundTruthTransform => {
  const P = projectionMatrix(normalize(center));

  // 광축에서 fov/2 떨어진 점(접선평면 좌표 반경 tan(fov/2))이 화면 짧은 변의
  // 절반에 오도록 픽셀 스케일 s를 정한다.
  const s = Math.min(width, height) / 2 / Math.tan(fovRad / 2);
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  const T: Mat3 = [
    [s * cos, -s * sin, width / 2],
    [s * sin, s * cos, height / 2],
    [0, 0, 1],
  ];

  return { TP: mat3Mul(T, P), T, P };
};

// 아래는 기존 테스트가 쓰던 시그니처를 유지하는 얇은 어댑터.
export const projectStarToPhoto = (star: Point3D, TP: Mat3): Point2D | null =>
  projectVecToPhoto(TP, star);

export const photoToSky = (point: Point2D, TP: Mat3): Point3D =>
  wcsPhotoToSky(TP, point);

export const recoverCenter = (
  TP: Mat3,
  width: number,
  height: number,
): Point3D => wcsRecoverCenter(TP, width, height);

export const recoverFov = (TP: Mat3, width: number, height: number): number =>
  wcsRecoverFov(TP, width, height);
