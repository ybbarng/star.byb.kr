import hashLib from "./hash";
import quadrilateral from "./quadrilateral";
import * as file from "@/scripts/file";
import { Star } from "@/scripts/hash/types";

const run = () => {
  const stars = file.loadJson("data/hash/sample", "sample-photo.json");
  console.log(`로드한 데이터에는 총 ${stars.length} 개의 별 정보가 있습니다.`);
  const indexes = createHashFromPhoto(stars);
  file.save(
    "build/hash/sample",
    "hashed-photo.json",
    JSON.stringify(indexes, null, 2),
  );
};

const createHashFromPhoto = (stars: Star[]) => {
  return quadrilateral.create(stars).map((quadrilateral) => {
    const hash = hashLib.calculate(quadrilateral.stars);

    return {
      ...quadrilateral,
      hash,
    };
  });
};

run();
