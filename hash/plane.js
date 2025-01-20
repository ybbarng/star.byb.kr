const math = require("mathjs");

const projectToTangentPlane = (vectors) => {
  const center = findCenter(vectors);
  const T = projectTransform(center);
  return vectors.map(vector => math.multiply(T, vector));
}

const findCenter = (vectors) => {
  // 중심 벡터 계산
  const center = math.mean(vectors, 0);
  // 정규화
  return math.divide(center, math.norm(center));
}

const projectTransform = (center) => {
  // center 벡터 정규화
  const cUnit = math.divide(center, math.norm(center));

  // u 계산 (c와 직교하는 벡터 선택)
  const arbitrary = cUnit[0] !== 0 || cUnit[2] !== 0
    ? [ -cUnit[2], 0, cUnit[1] ]
    : [ 0, -cUnit[2], cUnit[1] ]; // 특수 케이스
  let u = math.cross(cUnit, arbitrary);
  // 정규화
  u = math.divide(u, math.norm(u));

  // v 계산
  const v = math.cross(cUnit, u);

  // 변환 행렬 생성
  const transformMatrix = math.transpose([u, v, cUnit]); // 행렬의 열벡터가 [u, v, c]
  return math.inv(transformMatrix); // 역행렬을 적용하여 좌표 변환
}

exports.projectToTangentPlane = projectToTangentPlane;
