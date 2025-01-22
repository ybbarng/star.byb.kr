import * as hashLib from "./hash";
import * as quadrilateral from "./quadrilateral";
import * as file from "@/scripts/file";
import * as plane from "@/scripts/hash/plane";
import {
  Point3D,
  Quadrilateral,
  Quadrilateral2D,
  StarVector,
} from "@/scripts/hash/types";

const run = () => {
  const stars = file.loadJson("data/hash/sample", "sample-database.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  const indexes = createHashFromDatabase(stars);
  file.save(
    "build/hash/sample",
    "hashed-sample-database.json",
    JSON.stringify(indexes, null, 2),
  );
};

const createHashFromDatabase = (stars: StarVector[]) => {
  return quadrilateral
    .create<StarVector>(stars)
    .map((quadrilateral: Quadrilateral<StarVector>) => {
      const vectors = quadrilateral.stars.map((star: StarVector): Point3D => {
        return [star.x, star.y, star.z];
      });
      const projectedVectors = plane.projectToTangentPlane(vectors);
      const quad: Quadrilateral2D = [
        [projectedVectors[0][0], projectedVectors[0][1]],
        [projectedVectors[1][0], projectedVectors[1][1]],
        [projectedVectors[2][0], projectedVectors[2][1]],
        [projectedVectors[3][0], projectedVectors[3][1]],
      ];
      const hash = hashLib.calculate(quad);

      return {
        ...quadrilateral,
        hash,
      };
    });
};

run();
