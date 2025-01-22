import * as healpix from "@hscmap/healpix";
import { Point3D, SimpleStarVector, StarVector } from "@/scripts/hash/types";

export const splitByCells = (stars: StarVector[]) => {
  const nside = 4;
  const npix = healpix.nside2npix(nside);
  const arcmin = 600;
  console.log(
    `전체 지역을 ${npix}개의 ${arcmin} arcmin 범위의 영역으로 분리합니다.`,
  );
  const centers = createCenters(nside, npix);
  const cells = createAndSplitCells(stars, centers, arcmin);
  console.log(`${cells.length}개의 영역으로 분리하였습니다.`);

  return cells;
};

const createCenters = (nside: number, npix: number): Point3D[] => {
  const centers: Point3D[] = [];

  for (let ipix = 0; ipix < npix; ipix++) {
    const vector = healpix.pix2vec_nest(nside, ipix);
    centers.push(vector);
  }

  return centers;
};

const createAndSplitCells = (
  stars: StarVector[],
  centers: Point3D[],
  arcmin: number,
) => {
  const cells: SimpleStarVector[][] = [];
  centers.forEach((center) => {
    const cell = filterStarsByAngle(stars, center, arcmin);
    cells.push(cell);
  });

  return cells;
};

// 벡터 간 각도 계산 (단위 벡터)
function angleBetweenVectors(v1: StarVector, v2: Point3D) {
  // 내적
  const dotProduct = v1.x * v2[0] + v1.y * v2[1] + v1.z * v2[2];

  // 라디안 각도 계산
  return Math.acos(dotProduct); // 각도 계산 (라디안)
}

// 주어진 벡터와 각 별에 대해 angle을 구하고 범위 내에 있는지 확인
function filterStarsByAngle(
  stars: StarVector[],
  vector: Point3D,
  maxArcmin: number,
) {
  // arcmin을 radian으로 변환
  const maxAngle = ((maxArcmin / 60) * Math.PI) / 180;
  const result: SimpleStarVector[] = [];

  for (const star of stars) {
    const angle = angleBetweenVectors(star, vector); // 벡터 간 각도 계산

    if (angle <= maxAngle) {
      result.push({
        HR: star.HR,
        x: star.x,
        y: star.y,
        z: star.z,
        V: star.V,
      }); // 범위 내의 별을 추가
    }
  }

  // 밝은 별이 앞에 오도록 정렬, V 값이 작을수록 밝은 별
  result.sort((s1, s2) => Number(s1.V) - Number(s2.V));

  return result;
}
