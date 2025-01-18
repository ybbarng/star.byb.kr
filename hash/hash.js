const calculateHash = (quadrilateral) => {
  if (quadrilateral.length !== 4) {
    throw new Error("해시를 계산하려면 4개의 점이 필요합니다.");
  }
  const [p1, p2] = findPointsOfMaxDistance(quadrilateral);
  const transform = buildTransform(p1, p2);
  const transformedPoints = quadrilateral.map(transform);
  const [p3, p4] = findRest(transformedPoints);
  const transformed = [[0, 0], [1, 1], p3, p4];
  let [pA, pB, pC, pD] = removeSymmetric(transformed);
  return [...pC, ...pD];
}

const findPointsOfMaxDistance = (points) => {
  let maxDistance = -Infinity;
  let p1 = null, p2 = null;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      // 대소 계산에는 영향을 주지 않으므로, 연산을 줄이기 위해 거리 대신 거리의 제곱을 사용함
      const distance = dx ** 2 + dy ** 2;
      if (distance > maxDistance) {
        maxDistance = distance;
        p1 = points[i];
        p2 = points[j];
      }
    }
  }
  return [p1, p2];
}

/**
 * p1을 원점으로, p2를 (1, 1)로 하는 좌표 변환 함수 생성
 * @param p1 원점이 될 점
 * @param p2 (1, 1)이 될 점
 */
const buildTransform = (p1, p2) => {
  const [x1, y1] = p1;
  const [x2, y2] = p2;

  return (point) => {
    const [x, y] = point;
    const tx = (x - x1) / (x2 - x1);
    const ty = (y - y1) / (y2 - y1);
    return [tx, ty];
  };
}

const findRest = (transformedPoints) => {
  // 3. 나머지 두 점 중 x 좌표가 작은 점을 p3, 큰 점을 p4로 설정
  const remainingPoints = transformedPoints.filter(
    (p) => !arePointsEqual(p, [0, 0]) && !arePointsEqual(p, [1, 1])
  );
  remainingPoints.sort((a, b) => a[0] - b[0]);

  return remainingPoints;
}

const removeSymmetric = (transformedPoints) => {
  const [p1, p2, p3, p4] = transformedPoints;
  if (p3[0] + p4[0] <= 1) {
    return transformedPoints;
  }
  const result = [
    p2,
    p1,
    [1 - p4[0], 1-p4[1]],
    [1 - p3[0], 1-p3[1]],
  ]
  return result;
}

function arePointsEqual(p1, p2, tolerance = 1e-6) {
  return Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance;
}

exports.calculate = calculateHash;
