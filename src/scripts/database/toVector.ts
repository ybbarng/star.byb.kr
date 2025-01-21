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

function convertTo3DCoordinates(dec: string, ra: string) {
  // 적위(Dec)를 라디안으로 변환
  const decDegrees = parseDMS(dec);
  const decRad = (decDegrees * Math.PI) / 180;

  // 적경(RA)을 라디안으로 변환
  const raDegrees = parseHMS(ra);
  const raRad = (raDegrees * Math.PI) / 180;

  // 3차원 좌표 계산
  const x = Math.cos(decRad) * Math.cos(raRad);
  const y = Math.cos(decRad) * Math.sin(raRad);
  const z = Math.sin(decRad);

  return { x, y, z };
}

function parseDMS(dms: string) {
  // 도, 분, 초 형태를 정규식으로 분리
  const regex = /([+-]?\d+)°\s*(\d+)′\s*(\d+\.?\d*)″/;
  const match = dms.match(regex);

  if (!match) {
    throw new Error(`Invalid DMS format: ${dms}`);
  }

  const degrees = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  const rest = minutes / 60 + seconds / 3600;

  // 부호를 유지하며 도 단위로 변환
  if (degrees > 0) {
    return degrees + rest;
  }

  return degrees - rest;
}

function parseHMS(hms: string) {
  // 시, 분, 초 형태를 정규식으로 분리
  const regex = /(\d+)h\s*(\d+)m\s*(\d+\.?\d*)s/;
  const match = hms.match(regex);

  if (!match) {
    throw new Error(`Invalid HMS format: ${hms}`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  // 시 단위를 도 단위로 변환 (1시간 = 15도)
  return (hours + minutes / 60 + seconds / 3600) * 15;
}

run();
