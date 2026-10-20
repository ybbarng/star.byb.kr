import { convertTo3DCoordinates } from "./coordinates";
import { Star } from "./types";
import * as file from "@/scripts/file";

const run = () => {
  const stars = file.loadJson("build/database", "reduced-database.json");
  console.log(
    `로드한 카탈로그에는 총 ${stars.length} 개의 별 정보가 있습니다.`,
  );
  // 앱(풀이 Worker·게임)이 코드에 싣는 파일이라 쓰는 칸만 남기고 줄인다:
  // 번호(HR)·이름(N)·밝기(V)·색온도(K)·방향(x,y,z, 소수 8자리 ≈ 0.002″). 들여쓰기 없이.
  // RA·Dec 문자열, 별자리 약어 등 나머지는 reduced-database.json에 그대로 있다.
  file.save(
    "build/database",
    "vectors-database.json",
    JSON.stringify(toVectors(stars)),
  );
};

const round8 = (v: number) => Math.round(v * 1e8) / 1e8;

const toVectors = (stars: Star[]) =>
  stars.map((star) => {
    const { x, y, z } = convertTo3DCoordinates(star.Dec, star.RA);

    return {
      HR: star.HR,
      ...(star.N ? { N: star.N } : {}),
      V: star.V,
      ...(star.K ? { K: star.K } : {}),
      x: round8(x),
      y: round8(y),
      z: round8(z),
    };
  });

run();
