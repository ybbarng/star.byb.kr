import type { Point3D } from "@/scripts/hash/types";
import type { CandidateIndex } from "@/search/findCandidatesCore";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCandidateIndex,
  findCandidates,
} from "@/search/findCandidatesCore";
import { findCorrectRank } from "@/test/metrics/candidateMetrics";
import {
  generateSyntheticImage,
  toPhoto,
} from "@/test/synthetic/generateSyntheticImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

const ready = catalogExists() && hashesExist();

const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

// 하늘 전역을 고루 덮는 테스트 방향들
const directions: [number, number][] = [
  [85, 5],
  [50, 40],
  [200, -20],
  [330, 60],
  [150, 10],
  [20, -45],
  [270, 30],
  [110, -10],
];

describe.skipIf(!ready)("매칭: clean 합성 이미지의 정답 quad recall", () => {
  let index: CandidateIndex;
  let catalog: CatalogStar[];

  beforeAll(() => {
    catalog = loadCatalog();
    index = buildCandidateIndex(loadHashes());
  });

  it("현재 매칭(상위 15개·k=3)의 clean 정답 quad 포함률을 측정한다", () => {
    let evaluated = 0;
    let solved = 0;
    const ranks: number[] = [];

    for (let d = 0; d < directions.length; d++) {
      const [ra, dec] = directions[d];
      const img = generateSyntheticImage(catalog, {
        center: skyVector(ra, dec),
        fovDeg: 20,
        rotationDeg: 30,
        width: 1600,
        height: 1200,
        magnitudeLimit: 5,
        seed: 100 + d,
      });

      if (img.trueStars.length < 8) {
        continue; // 별이 너무 적은 방향은 제외
      }

      evaluated++;

      const photo = toPhoto(img);
      const photo15 = { ...photo, stars: photo.stars.slice(0, 15) };
      const cands = findCandidates(photo15, index);
      const trueHrs = new Set(img.trueStars.map((t) => t.hr));
      const rank = findCorrectRank(cands, trueHrs);

      if (rank >= 0) {
        solved++;
        ranks.push(rank);
      }
    }

    console.warn(
      `[clean 매칭] 정답 quad 포함: ${solved}/${evaluated} 방향, ` +
        `정답 순위(distance 정렬): [${ranks.join(", ")}]`,
    );

    // 기준선 측정이 목적. 최소한 일부 방향에서는 정답 quad가 후보에 있어야 한다.
    expect(evaluated).toBeGreaterThan(0);
    expect(solved).toBeGreaterThan(0);
  });
});
