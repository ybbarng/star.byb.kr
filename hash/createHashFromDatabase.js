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

  return quadrilaterals;
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
