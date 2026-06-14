import { convertTo3DCoordinates } from "./coordinates";
import { Star } from "./types";
import * as file from "@/scripts/file";

const run = () => {
  let stars = file.loadJson("build/database", "reduced-database.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  stars = toVectors(stars);
  file.save(
    "build/database",
    "vectors-database.json",
    JSON.stringify(stars, null, 2),
  );
};

const toVectors = (stars: Star[]) => {
  stars = stars.map((star) => ({
    ...star,
    ...convertTo3DCoordinates(star.Dec, star.RA),
  }));

  return stars;
};

run();
