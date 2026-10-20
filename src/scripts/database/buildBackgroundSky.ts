import * as file from "@/scripts/file";

// 사이트 배경(실제 서울 하늘)용 작은 별 지도. 배경은 모든 페이지가 받으니, 전체 카탈로그(gzip 41KB) 대신
// 4.5등급까지의 별과 별자리선만, 좌표를 소수 셋째 자리(약 0.06°)로 줄여 담는다 (gzip 약 15KB).
//   stars: [x, y, z, 등급, 색 번호(0 붉은 별 ~ 4 푸른 별)]를 이어 붙인 한 줄 배열
//   lines: 별자리선 꺾은선마다 [x, y, z, ...]

const MAG_LIMIT = 4.5;

interface VectorStar {
  V: string;
  K?: string;
  x: number;
  y: number;
  z: number;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

// 표면 온도 → 색 번호 (game/sky/drawSky.ts의 starColor와 같은 구간)
const colorIndex = (kelvin: number) =>
  kelvin < 3600
    ? 0
    : kelvin < 5000
      ? 1
      : kelvin < 6500
        ? 2
        : kelvin < 9000
          ? 3
          : 4;

const run = () => {
  const catalog = JSON.parse(
    file.load("build/database", "vectors-database.json"),
  ) as VectorStar[];
  const constellations = JSON.parse(
    file.load("build/database", "vectors-constellations.json"),
  ) as { stars: number[][] }[];

  const stars = catalog
    .filter((s) => parseFloat(s.V) <= MAG_LIMIT)
    .flatMap((s) => [
      round(s.x),
      round(s.y),
      round(s.z),
      Math.round(parseFloat(s.V) * 10) / 10,
      colorIndex(s.K ? parseFloat(s.K) : 6000),
    ]);
  const lines = constellations.map((c) => c.stars.flat().map(round));

  file.save(
    "build/database",
    "background-sky.json",
    JSON.stringify({ stars, lines }),
  );
};

run();
