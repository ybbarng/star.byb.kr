const quadrilateral = require("./quadrilateral");
const hashLib = require("./hash");

const run = () => {
  let stars = load();
  indexes = createHashFromDatabase(stars);
  save(indexes);
}

const load = () => {
  let stars = require('./data/sample-database.json');
  console.log(`로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`);
  return stars;
}

const createHashFromDatabase = (stars) => {
  let quadrilaterals = quadrilateral.create(stars);
  quadrilaterals = quadrilaterals.map((quadrilateral) => {
    const hash = hashLib.calculate(quadrilateral);
    return {
      ...quadrilateral,
      hash,
    }
  })
  quadrilaterals.forEach((quadrilateral) => {
    to2D(quadrilateral);
  })

  return quadrilaterals;
}

const to2D = (quadrilateral) => {
  const vectors = quadrilateral.stars.map((star) => {
    return [star.x, star.y, star.z];
  });
  const center = findCenter(vectors);
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

const save = (stars) => {
  const fs = require('fs');
  const path = require('path');
  const outputDir = "build";
  const outputName = "database-indexes.json";
  const outputDirPath = path.join(__dirname, outputDir);
  const outputFilePath = path.join(outputDirPath, outputName);

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
    console.log(`디렉토리 생성 완료: ${outputDirPath}`);
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(stars, null, 2), 'utf8');

  console.log(`파일이 성공적으로 저장되었습니다: ${outputFilePath}`);
}


run();
