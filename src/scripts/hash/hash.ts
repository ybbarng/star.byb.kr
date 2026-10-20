import {
  NamedQuadrilateral2D,
  Point2D,
  Quadrilateral2D,
} from "@/scripts/hash/types";

export const calculateHash = (quadrilateral: NamedQuadrilateral2D) => {
  if (quadrilateral.length !== 4) {
    throw new Error("해시를 계산하려면 4개의 점이 필요합니다.");
  }

  const labels = quadrilateral.map((item) => item.label);
  const points = quadrilateral.map((item) => item.vector);
  const [ip1, ip2] = findPointsOfMaxDistance(points);
  const transform = buildTransform(points[ip1], points[ip2]);
  const transformedPoints = points.map(transform);
  const [ip3, ip4] = findRest(transformedPoints);
  const transformed: Quadrilateral2D = [
    [0, 0],
    [1, 1],
    transformedPoints[ip3],
    transformedPoints[ip4],
  ];
  const [indexes, [, , pC, pD]] = removeSymmetric(
    [ip1, ip2, ip3, ip4],
    transformed,
  );

  return {
    labels: indexes.map((index) => labels[index]),
    hash: [...pC, ...pD],
  };
};

const findPointsOfMaxDistance = (points: Point2D[]): [number, number] => {
  let maxDistance = -Infinity;
  let p1 = null,
    p2 = null;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      // 대소 계산에는 영향을 주지 않으므로, 연산을 줄이기 위해 거리 대신 거리의 제곱을 사용함
      const distance = dx ** 2 + dy ** 2;

      if (distance > maxDistance) {
        maxDistance = distance;
        p1 = i;
        p2 = j;
      }
    }
  }

  if (p1 === null || p2 === null) {
    throw Error("가장 긴 거리의 두 점을 찾는데 실패했습니다.");
  }

  return [p1, p2];
};

/**
 * p1을 원점으로, p2를 (1, 1)로 하는 좌표 변환 함수 생성 (평행 이동 → 회전 → 확대).
 * 순수 JS (예전에는 mathjs 3×3 행렬 곱이었다 — 브라우저 Worker에 mathjs를 싣지 않으려고 바꿨다).
 * @param p1 원점이 될 점
 * @param p2 (1, 1)이 될 점
 */
const buildTransform = (p1: Point2D, p2: Point2D) => {
  const v12 = [p2[0] - p1[0], p2[1] - p1[1]];
  // v12를 y=x 방향으로 돌리는 각
  const angle = -Math.atan2(v12[1] - v12[0], v12[0] + v12[1]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // 돌린 v12의 x가 1이 되도록 확대
  const scale = 1 / (cos * v12[0] - sin * v12[1]);

  return (point: Point2D): Point2D => {
    const x = point[0] - p1[0];
    const y = point[1] - p1[1];

    return [scale * (cos * x - sin * y), scale * (sin * x + cos * y)];
  };
};

const findRest = (transformedPoints: Point2D[]): number[] => {
  // 나머지 두 점의 인덱스를 직접 추적
  const restIndexes: number[] = [];

  for (let i = 0; i < transformedPoints.length; i++) {
    const p = transformedPoints[i];

    if (!arePointsEqual(p, [0, 0]) && !arePointsEqual(p, [1, 1])) {
      restIndexes.push(i);
    }
  }

  // x 좌표가 작은 점을 p3, 큰 점을 p4로 설정
  if (
    transformedPoints[restIndexes[0]][0] > transformedPoints[restIndexes[1]][0]
  ) {
    return [restIndexes[1], restIndexes[0]];
  }

  return restIndexes;
};

const removeSymmetric = (
  indexes: [number, number, number, number],
  transformedPoints: Quadrilateral2D,
): [[number, number, number, number], Quadrilateral2D] => {
  const [p1, p2, p3, p4] = transformedPoints;

  if (p3[0] + p4[0] <= 1) {
    return [indexes, transformedPoints];
  }

  const result: Quadrilateral2D = [
    p2,
    p1,
    [1 - p4[0], 1 - p4[1]],
    [1 - p3[0], 1 - p3[1]],
  ];

  return [[indexes[1], indexes[0], indexes[3], indexes[2]], result];
};

function arePointsEqual(p1: Point2D, p2: Point2D, tolerance = 1e-6) {
  return (
    Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance
  );
}
