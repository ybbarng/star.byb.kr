import * as math from "mathjs";
import { Point2D, Point3D } from "@/scripts/hash/types";

export const projectToTangentPlane = (vectors: Point3D[]) => {
  const center = findCenter(vectors);
  const T = calculateProjectTransform(center);

  return vectors.map((vector) => toCartesian(math.multiply(T, vector)));
};

export const findCenter = (vectors: Point3D[]): Point3D => {
  // 중심 벡터 계산
  const center = mean(vectors);

  // 정규화
  return normalize(center);
};

export const calculateProjectTransform = (center: Point3D) => {
  // center 벡터 정규화
  const cUnit = normalize(center);

  // u 계산 (c와 직교하는 벡터 선택)
  const arbitrary =
    cUnit[0] !== 0 || cUnit[2] !== 0
      ? [-cUnit[2], 0, cUnit[1]]
      : [0, -cUnit[2], cUnit[1]]; // 특수 케이스
  let u = math.cross(cUnit, arbitrary) as Point3D;
  // 정규화
  u = normalize(u);

  // v 계산
  const v = math.cross(cUnit, u) as Point3D;

  // 변환 행렬 생성
  const transformMatrix = math.transpose([u, v, cUnit]); // 행렬의 열벡터가 [u, v, c]

  return math.inv(transformMatrix); // 역행렬을 적용하여 좌표 변환
};

/**
 * 동차 좌표를 2차원 좌표로 변환합니다.
 */
export const toCartesian = (vector: Point3D): Point2D => {
  return [vector[0] / vector[2], vector[1] / vector[2]];
};

const mean = (vectors: Point3D[]): Point3D => {
  // math.mean() 계산 결과 3차원 벡터가 나오는데, 타입은 MathNumericType이라고 하여 호환되지 않으므로 강제 캐스팅한다.
  // https://github.com/josdejong/mathjs/issues/3160
  return math.mean(vectors, 0) as unknown as Point3D;
};

const normalize = (vector: Point3D): Point3D => {
  // math.divide() 계산 결과 3차원 벡터가 나오는데, 타입은 MathType이라고 하여 호환되지 않으므로 강제 캐스팅한다.
  return math.divide(vector, math.norm(vector)) as unknown as Point3D;
};
