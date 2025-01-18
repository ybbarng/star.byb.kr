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
  let quadrilaterals = createQuadrilaterals(stars);
  quadrilaterals = quadrilaterals.map((quadrilateral) => {
    const hash = calculateHash(quadrilateral);
    return {
      ...quadrilateral,
      hash,
    }
  })

  return quadrilaterals;
}

const createQuadrilaterals = (stars) => {
  const result = [];
  for (let s1 = 0; s1 < stars.length - 3; s1++) {
    for (let s2 = s1; s2 < stars.length - 2; s2++) {
      for (let s3 = s2; s3 < stars.length - 1; s3++) {
        for (let s4 = s3; s4 < stars.length; s4++) {
          result.push({
            id: `${s1}-${s2}-${s3}-${s4}`,
            stars: [stars[s1], stars[s2], stars[s3], stars[s4]],
          });
        }
      }
    }
  }
  return result;
}

const calculateHash = (quadrilateral) => {
  const [s1, s2, s3, s4] = quadrilateral.stars;
  return 0;
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
