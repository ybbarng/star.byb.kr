import { Star } from "./types";
import * as file from "@/scripts/file";

const run = ({ minBright = 10 }: { minBright: number }) => {
  let stars = file.loadJson("data/database", "bsc5-short.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  stars = reduce(stars, minBright);
  file.save(
    "build/database",
    "reduced-database.json",
    JSON.stringify(stars, null, 2),
  );
};

// BSC5가 평소가 아닌 때의 밝기로 실은 별 → 평소 밝기. 재발 신성 북쪽왕관자리 T(HR 5958)는 1866년 폭발 때의
// 2.0등급으로 실려 있지만 평소에는 10등급 남짓이라 맨눈에 안 보인다 (약 80년마다 며칠 동안만 2~3등급)
const USUAL_MAG: Record<string, string> = { "5958": "10.2" };

const reduce = (stars: Star[], minBright: number) => {
  let result = stars
    .map((star) =>
      USUAL_MAG[star.HR] ? { ...star, V: USUAL_MAG[star.HR] } : star,
    )
    .filter((star) => parseFloat(star.V) <= minBright);
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

run({ minBright: 5 });
