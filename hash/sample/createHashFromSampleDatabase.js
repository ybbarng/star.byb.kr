const quadrilateral = require("./quadrilateral");
const hashLib = require("./hash");
const plane = require("../plane");

const run = () => {
  let stars = load();
  indexes = createHashFromDatabase(stars);
  save(indexes);
}

const load = () => {
  let stars = require('./data/sample-database.json').splice(0, 30);
  console.log(`로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`);
  return stars;
}

const createHashFromDatabase = (stars) => {
  return quadrilateral.create(stars)
    .map((quadrilateral) => {
      const vectors = quadrilateral.stars.map((star) => {
        return [star.x, star.y, star.z];
      });
      const projectedQuadrilateral = plane.projectToTangentPlane(vectors);
      const hash = hashLib.calculate(projectedQuadrilateral);
      return {
        ...quadrilateral,
        hash,
      }
    });
}

const save = (stars) => {
  const fs = require('fs');
  const path = require('path');
  const outputDir = "build";
  const outputName = "hashed-sample-database.json";
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
