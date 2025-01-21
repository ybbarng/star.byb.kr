const math = require("mathjs");

const calculateHash = (quadrilateral) => {
  if (quadrilateral.length !== 4) {
    throw new Error("해시를 계산하려면 4개의 점이 필요합니다.");
  }

  const labels = quadrilateral.map((item) => item.label);
  const points = quadrilateral.map((item) => item.vector);
  const [ip1, ip2] = findPointsOfMaxDistance(points);
  const transform = buildTransform(points[ip1], points[ip2]);
  const transformedPoints = points.map(transform);
  const [ip3, ip4] = findRest(transformedPoints);
  const transformed = [
    [0, 0],
    [1, 1],
    transformedPoints[ip3],
    transformedPoints[ip4],
  ];
  let [indexes, [pA, pB, pC, pD]] = removeSymmetric(
    [ip1, ip2, ip3, ip4],
    transformed,
  );

  return {
    labels: indexes.map((index) => labels[index]),
    hash: [...pC, ...pD],
  };
};

const findPointsOfMaxDistance = (points) => {
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

  return [p1, p2];
};

/**
 * p1을 원점으로, p2를 (1, 1)로 하는 좌표 변환 함수 생성
 * @param p1 원점이 될 점
 * @param p2 (1, 1)이 될 점
 */
const buildTransform = (p1, p2) => {
  // 평행 이동 행렬 T: p1을 원점으로 이동
  const T = math.matrix([
    [1, 0, -p1[0]],
    [0, 1, -p1[1]],
    [0, 0, 1],
  ]);

  // 이후의 연산을 위해서 vector(p1, p2)를 준비
  // 이 벡터 값은 T * p2 와 같다.
  const v12 = [p2[0] - p1[0], p2[1] - p1[1]];

  // 회전 행렬 R: v12를 회전시켜서 y=x 선분에 위치
  const angle = -Math.atan2(v12[1] - v12[0], v12[0] + v12[1]);
  const R = math.matrix([
    [Math.cos(angle), -Math.sin(angle), 0],
    [Math.sin(angle), Math.cos(angle), 0],
    [0, 0, 1],
  ]);

  // 스케일 행렬 S: 회전한 v12를 (1, 1)로 위치시키기 위해 스케일
  const hv12 = [v12[0], v12[1], 1];
  const scale = 1 / math.multiply(R, hv12).get([0]);
  const S = math.matrix([
    [scale, 0, 0],
    [0, scale, 0],
    [0, 0, 1],
  ]);

  // 최종 변환 행렬 M 준비 완료
  const M = math.multiply(S, R, T);

  return (point) => {
    const homogeneousPoint = [point[0], point[1], 1];
    const transformedPoint = math.multiply(M, homogeneousPoint);

    return [transformedPoint.get([0]), transformedPoint.get([1])];
  };
};

const findRest = (transformedPoints) => {
  // 3. 나머지 두 점 중 x 좌표가 작은 점을 p3, 큰 점을 p4로 설정
  const remainingPoints = transformedPoints.filter(
    (p) => !arePointsEqual(p, [0, 0]) && !arePointsEqual(p, [1, 1]),
  );
  remainingPoints.sort((a, b) => a[0] - b[0]);

  return [
    transformedPoints.indexOf(remainingPoints[0]),
    transformedPoints.indexOf(remainingPoints[1]),
  ];
};

const removeSymmetric = (indexes, transformedPoints) => {
  const [p1, p2, p3, p4] = transformedPoints;

  if (p3[0] + p4[0] <= 1) {
    return [indexes, transformedPoints];
  }

  const result = [p2, p1, [1 - p4[0], 1 - p4[1]], [1 - p3[0], 1 - p3[1]]];

  return [[indexes[1], indexes[0], indexes[3], indexes[2]], result];
};

function arePointsEqual(p1, p2, tolerance = 1e-6) {
  return (
    Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance
  );
}

exports.calculate = calculateHash;
