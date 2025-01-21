import * as file from "@/scripts/file";

const run = ({ minBright = 10 }: { minBright: number }) => {
  let stars = file.loadJson("data/database", "bsc5-short.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  stars = reduce(stars, minBright);
  file.saveJson(
    "build/database",
    "reduced-database.json",
    JSON.stringify(stars, null, 2),
  );
};

interface Star {
  C?: string; // "Peg"
  Dec: string; // "+13° 23′ 46″"
  F?: string; // "86"
  HR: string; // "4"
  K: string; // "5500"
  RA: string; // "00h 05m 42.0s"
  V: string; // "5.51"
}

const reduce = (stars: Star[], minBright: number) => {
  let result = stars.filter((star) => parseInt(star.V) <= minBright);
  console.log(
    `밝기가 ${minBright} 보다 밝은 별들만 남깁니다. 현재 별 수: ${result.length}`,
  );
  result = removeSameCoordinate(result);
  console.log(
    `데이터 중 중복된 좌표를 가지는 것들을 제거합니다. 현재 별 수: ${result.length}`,
  );

  return result;
};

const removeSameCoordinate = (stars: Star[]) => {
  const seen = new Set();
  const uniqueStars: Star[] = [];
  stars.forEach((star) => {
    const key = `${star.Dec}-${star.RA}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueStars.push(star);
    }
  });

  return uniqueStars;
};

run({ minBright: 4 });
