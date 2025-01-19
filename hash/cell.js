const healpix = require("@hscmap/healpix");

const splitByCells = (stars) => {
  const nside = 4;
  const npix = healpix.nside2npix(nside);
  const arcmin = 600;
  console.log(`전체 지역을 ${npix}개의 ${arcmin} arcmin 범위의 영역으로 분리합니다.`);
  const centers = createCenters(nside, npix);
  const cells = createAndSplitCells(stars, centers, arcmin);
  console.log(`${cells.length}개의 영역으로 분리하였습니다.`);
  return cells;
}

const createCenters = (nside, npix) => {
  const centers = [];
  for (let ipix = 0; ipix < npix; ipix++) {
    const vector = healpix.pix2vec_nest(nside, ipix);
    centers.push({
      x: vector[0],
      y: vector[1],
      z: vector[2],
    });
  }
  return centers;
}

const createAndSplitCells = (stars, centers, arcmin) => {
  const cells = [];
  centers.forEach(center => {
    const cell = filterStarsByAngle(stars, center, arcmin);
    cells.push(cell);
  })
  return cells;
}

// 벡터 간 각도 계산 (단위 벡터)
function angleBetweenVectors(v1, v2) {
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;  // 내적 계산
  const angleRad = Math.acos(dotProduct);  // 각도 계산 (라디안)
  return angleRad;
}

// 주어진 벡터와 각 별에 대해 angle을 구하고 범위 내에 있는지 확인
function filterStarsByAngle(stars, vector, maxArcmin) {
  // arcmin을 radian으로 변환
  const maxAngle = (maxArcmin / 60) * Math.PI / 180;
  const result = [];

  for (const star of stars) {
    const angle = angleBetweenVectors(star, vector);  // 벡터 간 각도 계산
    if (angle <= maxAngle) {
      result.push({
        HR: star.HR,
        x: star.x,
        y: star.y,
        z: star.z,
        V: star.V,
      });  // 범위 내의 별을 추가
    }
  }

  // 밝은 별이 앞에 오도록 정렬, V 값이 작을수록 밝은 별
  result.sort((s1, s2) => s1.V - s2.V);
  return result;
}


exports.split = splitByCells;
