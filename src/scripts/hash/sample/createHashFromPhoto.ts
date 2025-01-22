import * as hashLib from "./hash";
import * as file from "@/scripts/file";
import * as quadrilateral from "@/scripts/hash/quadrilateral";
import { Quadrilateral, Quadrilateral2D } from "@/scripts/hash/types";

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

type PhotoStar = [number, number, number];

const createHashFromPhoto = (stars: PhotoStar[]) => {
  return quadrilateral
    .create<PhotoStar>(stars)
    .map((quadrilateral: Quadrilateral<PhotoStar>) => {
      const quad: Quadrilateral2D = [
        [quadrilateral.stars[0][0], quadrilateral.stars[0][1]],
        [quadrilateral.stars[1][0], quadrilateral.stars[1][1]],
        [quadrilateral.stars[2][0], quadrilateral.stars[2][1]],
        [quadrilateral.stars[3][0], quadrilateral.stars[3][1]],
      ];
      const hash = hashLib.calculate(quad);

      return {
        ...quadrilateral,
        hash,
      };
    });
};

run();
