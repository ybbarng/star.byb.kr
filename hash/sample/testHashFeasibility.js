const run = () => {
  const database = loadDatabase();
  const sample = loadSample();

  for (let key of database.keys()) {
    console.log(key);
    console.log(database.get(key));
    console.log(sample.get(key));
  }
};

const loadDatabase = () => {
  let stars = require("./build/hashed-sample-database.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  const database = stars.map((star) => {
    return {
      id: star.id,
      hash: star.hash,
    };
  });
  const result = new Map();
  database.forEach((row) => {
    result.set(row.id, row.hash);
  });

  return result;
};

const loadSample = () => {
  const stars = require(`./build/hashed-photo.json`);
  console.log(
    `로드한 사진 데이터에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  const database = stars.map((star) => {
    return {
      id: star.id,
      hash: star.hash,
    };
  });
  const result = new Map();
  database.forEach((row) => {
    result.set(row.id, row.hash);
  });

  return result;
};

run();
