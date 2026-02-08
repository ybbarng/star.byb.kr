import { Matrix } from "mathjs";
import * as math from "mathjs";
import * as plane from "@/scripts/hash/plane";
import { Point2D, Point3D } from "@/scripts/hash/types";

/** math.multiply 결과를 안전하게 배열로 변환 */
const toArray = (result: math.MathType): number[] => {
  if (typeof (result as Matrix).toArray === "function") {
    return (result as Matrix).toArray() as number[];
  }

  return result as unknown as number[];
};

const calculateRotationAngle = (A: Point2D, B: Point2D) => {
  const dotProduct = math.dot(A, B);
  const crossProduct = A[0] * B[1] - A[1] * B[0];

  return Math.atan2(crossProduct, dotProduct);
};

const getRotationMatrix = (theta: number) => {
  return math.matrix([
    [Math.cos(theta), -Math.sin(theta), 0],
    [Math.sin(theta), Math.cos(theta), 0],
    [0, 0, 1],
  ]);
};

/**
 * DB 별 4개의 3D 벡터로부터 접선 평면 투영 행렬 P를 계산
 */
function calculateProjectTransform(quad: Point3D[]): Matrix {
  const center = plane.findCenter(quad);

  return plane.calculateProjectTransform(center) as unknown as Matrix;
}

/**
 * 투영된 DB 좌표 → 사진 좌표 아핀 변환 행렬 T를 계산
 */
function calculateToPhotoTransform(
  photo: Point2D[],
  database: Point2D[],
): Matrix {
  const centroidPhoto = math.mean(photo, 0) as unknown as Point2D;
  const centroidDatabase = math.mean(database, 0) as unknown as Point2D;

  const centeredPhoto = photo.map(
    (point) => math.subtract(point, centroidPhoto) as Point2D,
  );
  const centeredDatabase = database.map(
    (point) => math.subtract(point, centroidDatabase) as Point2D,
  );

  const scalePhoto = math.norm(centeredPhoto[0]);
  const scaleDatabase = math.norm(centeredDatabase[0]) as number;

  const normalPhoto0 = math.divide(centeredPhoto[0], scalePhoto) as Point2D;
  const normalDatabase0 = math.divide(
    centeredDatabase[0],
    scaleDatabase,
  ) as Point2D;

  const angle = -calculateRotationAngle(normalPhoto0, normalDatabase0);

  const DtoZero = [
    [1, 0, -centroidDatabase[0]],
    [0, 1, -centroidDatabase[1]],
    [0, 0, 1],
  ];

  const SDtoN = [
    [1 / scaleDatabase, 0, 0],
    [0, 1 / scaleDatabase, 0],
    [0, 0, 1],
  ];

  const R = getRotationMatrix(angle);

  const NtoSP = [
    [scalePhoto, 0, 0],
    [0, scalePhoto, 0],
    [0, 0, 1],
  ];

  const zeroToP = [
    [1, 0, centroidPhoto[0]],
    [0, 1, centroidPhoto[1]],
    [0, 0, 1],
  ];

  return math.multiply(zeroToP, NtoSP, R, SDtoN, DtoZero) as Matrix;
}

/**
 * 후보 quad에 대한 변환 행렬 TP를 계산
 * @param photoQuad 사진에서의 4개 별 좌표
 * @param databaseQuad DB에서의 4개 별 3D 벡터
 * @returns T × P 행렬
 */
export function computeTransformMatrix(
  photoQuad: Point2D[],
  databaseQuad: Point3D[],
): Matrix {
  const P = calculateProjectTransform(databaseQuad);
  const projectedDatabase = databaseQuad.map(
    (star) => toArray(math.multiply(P, star)).slice(0, 2) as Point2D,
  );
  const T = calculateToPhotoTransform(photoQuad, projectedDatabase);

  return math.multiply(T, P) as Matrix;
}
