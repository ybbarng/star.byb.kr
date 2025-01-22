import * as cell from "./cell";
import * as hashLib from "./hash";
import * as quadrilateral from "./quadrilateral";
import * as file from "@/scripts/file";
import * as plane from "@/scripts/hash/plane";
import {
  NamedQuadrilateral2D,
  Point3D,
  SimpleStarVector,
  StarVector,
} from "@/scripts/hash/types";

const run = () => {
  const stars = file.loadJson("data/hash", "vectors-database.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  const indexes = createHashFromDatabase(stars);

  // 바로 사용하면 데이터가 너무 커서 RangeError: Invalid string length 에러가 발생함.
  const result = "[" + indexes.map((el) => JSON.stringify(el)).join(",") + "]";
  file.save("build/hash", "hashed-database.json", result);
};

const createHashFromDatabase = (stars: StarVector[]) => {
  const cells = cell.splitByCells(stars);

  return cells
    .map((cell, i) => {
      console.log(
        `${i}번째 Cell에 대한 사각형을 생성합니다. 영역 내 별의 갯수는 ${cell.length}개 입니다.`,
      );

      return quadrilateral
        .create<SimpleStarVector>(cell)
        .map((quadrilateral) => {
          const vectors = quadrilateral.stars.map(
            (star: SimpleStarVector): Point3D => {
              return [star.x, star.y, star.z];
            },
          );
          const hrs = quadrilateral.stars.map((star) => star.HR);
          const projectedVectors = plane.projectToTangentPlane(vectors);
          const quad: NamedQuadrilateral2D = projectedVectors.map(
            (projected, i) => ({
              label: hrs[i],
              vector: projected,
            }),
          ) as NamedQuadrilateral2D;

          const hash = hashLib.calculateHash(quad);

          return {
            stars: hash.labels,
            hash: hash.hash,
          };
        });
    })
    .flat();
};

run();
