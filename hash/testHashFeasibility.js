const quadrilateral = require("./quadrilateral");
const hashLib = require("./hash");

const run = () => {
  const database = loadDatabase();
  const sample = loadSample();
  for (let key of database.keys()) {
    console.log(key);
    console.log(database.get(key));
    console.log(sample.get(key));
  }
}

const loadDatabase = () => {
  let stars = require('./build/hashed-database.json');
  console.log(`로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`);
  const database = stars.map((star) => {
    return {
      id: star.id,
      hash: star.hash,
    }
  })
  const result = new Map();
  database.forEach(row => {
    result.set(row.id, row.hash);
  })
  return result;
}

const loadSample = () => {
  const samples = [
    [774.23, 552.60],
    [672.37, 615.33],
    [551.76, 487.30],
    [603.00, 402.77],
    [560.27, 292.60],
    [533.20, 199.98],
    [511.61, 114.12],
  ];
  const database = quadrilateral.create(samples)
    .map((quadrilateral) => {
      const hash = hashLib.calculate(quadrilateral.stars);
      return {
        id: quadrilateral.id,
        hash,
      }
    })
  const result = new Map();
  database.forEach(row => {
    result.set(row.id, row.hash);
  })
  return result;
}
run();
