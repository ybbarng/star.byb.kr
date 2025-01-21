const run = () => {
  let stars = load();
  stars = reduce(stars);
  save(stars);
};

const load = () => {
  const stars = require("../../../data/database/bsc5-short.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );

  return stars;
};

const reduce = (stars) => {
  stars = stars
    .map((star) => ({ ...star, V: (star.V = parseInt(star.V, 10)) }))
    .filter((star) => star.V <= minBright);
  console.log(
    `밝기가 ${minBright} 이상인 별들만 남깁니다. 현재 별 수: ${stars.length}`,
  );
  stars = removeSameCoordinate(stars);
  console.log(
    `데이터 중 중복된 좌표를 가지는 것들을 제거합니다. 현재 별 수: ${stars.length}`,
  );

  return stars;
};

const removeSameCoordinate = (stars) => {
  const seen = new Set();
  const uniqueStars = [];
  stars.forEach((star) => {
    const key = `${star.Dec}-${star.RA}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueStars.push(star);
    }
  });

  return uniqueStars;
};

const save = (stars) => {
  const fs = require("fs");
  const path = require("path");
  const outputDir = "build";
  const outputName = "reduced-database.json";
  const outputDirPath = path.join(__dirname, outputDir);
  const outputFilePath = path.join(outputDirPath, outputName);

  // 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
    console.log(`디렉토리 생성 완료: ${outputDirPath}`);
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(stars, null, 2), "utf8");

  console.log(`파일이 성공적으로 저장되었습니다: ${outputFilePath}`);
};

run((minBright = 4));
