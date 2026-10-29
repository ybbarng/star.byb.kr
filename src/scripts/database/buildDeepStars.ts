import { convertTo3DCoordinates } from "./coordinates";
import { Star } from "./types";
import * as file from "@/scripts/file";

// 검증에만 쓰는 어두운 별 (journey 48장): 풀이 카탈로그(5등급까지, reduceDatabase) 밖의 5등급 초과 ~ 6등급 별.
// 찾기 인덱스에는 넣지 않고, 확신 못 한 후보를 다시 채점할 때만 5등급 카탈로그에 더해 쓴다 (SolverContext.verifyCatalog).
// 앱이 코드에 싣는 파일이라 방향만 소수 5자리(약 2″, 채점 허용오차보다 훨씬 작다)로 줄여 [x, y, z, ...] 한 줄 배열로 담는다.
const MIN_MAG = 5;
const MAX_MAG = 6;

// reduceDatabase와 같이: 재발 신성 북쪽왕관자리 T는 평소 밝기(10등급 남짓)라 넣지 않는다
const USUAL_MAG: Record<string, number> = { "5958": 10.2 };

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

const run = () => {
  const stars = file.loadJson("data/database", "bsc5-short.json") as Star[];
  const seen = new Set<string>();
  const flat: number[] = [];

  for (const star of stars) {
    const mag = USUAL_MAG[star.HR] ?? parseFloat(star.V);
    const key = `${star.Dec}-${star.RA}`;

    if (!(mag > MIN_MAG && mag <= MAX_MAG) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const { x, y, z } = convertTo3DCoordinates(star.Dec, star.RA);
    flat.push(round5(x), round5(y), round5(z));
  }

  console.log(
    `${MIN_MAG}등급 초과 ${MAX_MAG}등급 이하 별 ${flat.length / 3}개를 저장합니다.`,
  );
  file.save("build/database", "deep-stars.json", JSON.stringify(flat));
};

run();
