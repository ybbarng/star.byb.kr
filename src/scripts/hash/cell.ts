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

// 주어진 벡터와 각 별에 대해 내적으로 범위 내에 있는지 확인
function filterStarsByAngle(
  stars: StarVector[],
  vector: Point3D,
  maxArcmin: number,
) {
  // arcmin을 radian으로 변환 후 cos 값으로 비교 (acos 호출 제거)
  const maxAngle = ((maxArcmin / 60) * Math.PI) / 180;
  const cosThreshold = Math.cos(maxAngle);
  const result: SimpleStarVector[] = [];

  for (const star of stars) {
    // 내적이 cosThreshold 이상이면 각도가 maxAngle 이내
    const dot = star.x * vector[0] + star.y * vector[1] + star.z * vector[2];

    if (dot >= cosThreshold) {
      result.push({
        HR: star.HR,
        x: star.x,
        y: star.y,
        z: star.z,
        V: star.V,
      });
    }
  }

  // 밝은 별이 앞에 오도록 정렬, V 값이 작을수록 밝은 별
  // 숫자 변환을 정렬 시 1회만 수행
  result.sort((s1, s2) => parseFloat(s1.V) - parseFloat(s2.V));

  return result;
}
