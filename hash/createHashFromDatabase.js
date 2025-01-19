const quadrilateral = require("./quadrilateral");
const hashLib = require("./hash");
const cell = require("./cell");
const fs = require('fs');
const path = require('path');
let stars = require('./data/vectors-database.json');

const run = () => {
  console.log(`로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`);
  indexes = createHashFromDatabase(stars);
  save(indexes);
}

const createHashFromDatabase = (stars) => {
  const cells = cell.split(stars);
  return cells.map((cell, i) => {
    console.log(`${i}번째 Cell에 대한 사각형을 생성합니다. 영역 내 별의 갯수는 ${cell.length}개 입니다.`);
    return quadrilateral.create(cell)
      .map((quadrilateral) => {
        const projectedQuadrilateral = to2D(quadrilateral);
        const hash = hashLib.calculate(projectedQuadrilateral);
        return {
          ...quadrilateral,
          hash,
        }
      });
  }).flat();
}

const to2D = (quadrilateral) => {
  const vectors = quadrilateral.stars.map((star) => {
    return [star.x, star.y, star.z];
  });
  const center = findCenter(vectors);
  return project(vectors, center);
}

const findCenter = (vectors) => {
  const sum = vectors.reduce((acc, vec) => {
    acc.x += vec[0];
    acc.y += vec[1];
    acc.z += vec[2];
    return acc;
  }, { x: 0, y: 0, z: 0 });
  const norm = Math.sqrt(sum.x ** 2 + sum.y ** 2 + sum.z ** 2);
  return [sum.x / norm, sum.y / norm, sum.z / norm];
}

const project = (points, center) => {
  // center 벡터 정규화
  const cNorm = Math.sqrt(center[0] ** 2 + center[1] ** 2 + center[2] ** 2);
  const cUnit = [center[0] / cNorm, center[1] / cNorm, center[2] / cNorm];

  // u 계산 (c와 직교하는 벡터 선택)
  const arbitrary = cUnit[0] !== 0 || cUnit[2] !== 0
    ? [ -cUnit[2], 0, cUnit[1] ]
    : [ 0, -cUnit[2], cUnit[1] ]; // 특수 케이스
  let u = crossProduct(cUnit, arbitrary);
  u = normalize(u);

  // v 계산
  const v = crossProduct(cUnit, u);

  // 각 점 투영 후 평면 좌표 계산
  return points.map(point => {
    // p를 평면에 투영
    const dotProduct = point[0] * cUnit[0] + point[1] * cUnit[1] + point[2] * cUnit[2];
    const pProj = [
      point[0] - dotProduct * cUnit[0],
      point[1] - dotProduct * cUnit[1],
      point[2] - dotProduct * cUnit[2],
    ];

    // 평면 좌표계로 변환
    return [
      pProj[0] * u[0] + pProj[1] * u[1] + pProj[2] * u[2],
      pProj[0] * v[0] + pProj[1] * v[1] + pProj[2] * v[2],
    ];
  });
}

function crossProduct(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vec) {
  const norm = Math.sqrt(vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2);
  return [
    vec[0] / norm,
    vec[1] / norm,
    vec[2] / norm,
  ]
}

const save = (stars) => {
  const outputDir = "build";
  const outputName = "hashed-database.json";
  const outputDirPath = path.join(__dirname, outputDir);
  const outputFilePath = path.join(outputDirPath, outputName);

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
    console.log(`디렉토리 생성 완료: ${outputDirPath}`);
  }

  // 바로 사용하면 데이터가 너무 커서 RangeError: Invalid string length 에러가 발생함.
  const result = "[" + stars.map(el => JSON.stringify(el)).join(",") + "]";

  fs.writeFileSync(outputFilePath, result, 'utf8');

  console.log(`파일이 성공적으로 저장되었습니다: ${outputFilePath}`);
}


run();
