import * as cell from "./cell";
import * as hashLib from "./hash";
import * as quadrilateral from "./quadrilateral";
import * as file from "@/scripts/file";
import * as plane from "@/scripts/hash/plane";
import {
  NamedQuadrilateral2D,
  Point3D,
  Quadrilateral,
  SimpleStarVector,
  StarVector,
} from "@/scripts/hash/types";

// quad 내 모든 별 쌍의 각거리가 maxAngleDeg 이하인지 확인
const MAX_PAIR_ANGLE_DEG = 10;
const COS_MAX_PAIR_ANGLE = Math.cos((MAX_PAIR_ANGLE_DEG * Math.PI) / 180);

const isQuadCompact = (quad: Quadrilateral<SimpleStarVector>): boolean => {
  const stars = quad.stars;

  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      const dot =
        stars[i].x * stars[j].x +
        stars[i].y * stars[j].y +
        stars[i].z * stars[j].z;

      if (dot < COS_MAX_PAIR_ANGLE) return false;
    }
  }

  return true;
};

const run = () => {
  const stars = file.loadJson("build/database", "vectors-database.json");
  console.log(`로드한 카탈로그에는 총 ${stars.length}개의 별 정보가 있습니다.`);
  const indexes = createHashFromDatabase(stars);
  console.log(`생성한 전체 사각형 수는 ${indexes.length}개 입니다.`);

  // 바로 사용하면 데이터가 너무 커서 RangeError: Invalid string length 에러가 발생함.
  const result = "[" + indexes.map((el) => JSON.stringify(el)).join(",") + "]";
  file.save("build/hash", "hashed-database.json", result);
};

const createHashFromDatabase = (stars: StarVector[]) => {
  const cells = cell.splitByCells(stars);

  return cells
    .map((cell, i) => {
      const allQuads = quadrilateral.create<SimpleStarVector>(cell);
      const compactQuads = allQuads.filter(isQuadCompact);
      console.log(
        `${i}번째 Cell: 별 ${cell.length}개, quad ${allQuads.length}→${compactQuads.length}개 (${allQuads.length - compactQuads.length}개 제거, max pair ${MAX_PAIR_ANGLE_DEG}°)`,
      );

      return compactQuads
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
