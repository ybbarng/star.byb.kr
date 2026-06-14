import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { CandidateIndex } from "@/search/findCandidatesCore";
import type { SolveStar } from "@/search/solveCore";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCandidateIndex,
  findCandidates,
} from "@/search/findCandidatesCore";
import { solveCandidate } from "@/search/solveCore";
import { comparePose } from "@/test/metrics/poseMetrics";
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

const W = 1600;
const H = 1200;
const SIGNIFICANCE_ACCEPT = 5; // 이 이상이면 "해 찾음"으로 수용
const CENTER_TOLERANCE_DEG = 1.5; // 정답 판정 각오차

const directions: [number, number][] = [
  [85, 5],
  [200, -20],
  [330, 60],
  [150, 10],
  [20, -45],
  [270, 30],
];

const noiseLevels = [
  { name: "L0 clean", noise: {} },
  { name: "L1 약", noise: { jitterPx: 1, falseRatio: 0.3 } },
  { name: "L2 중", noise: { jitterPx: 2, falseRatio: 1.0, missingProb: 0.1 } },
  { name: "L3 강", noise: { jitterPx: 3, falseRatio: 2.0, missingProb: 0.2 } },
];

describe.skipIf(!ready)("e2e: 매칭 + 검증 전체 파이프라인", () => {
  let catalog: CatalogStar[];
  let index: CandidateIndex;
  let solveStars: SolveStar[];
  let byHrVec: Map<string, Point3D>;

  beforeAll(() => {
    catalog = loadCatalog();
    index = buildCandidateIndex(loadHashes());
    solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
    byHrVec = new Map(catalog.map((s) => [s.hr, s.vector]));
  });

  // 한 합성 이미지를 매칭→검증으로 풀어 최대 유의도 후보의 pose를 반환한다.
  const solveImage = (
    allStars: Point2D[],
  ): { significance: number; TP: ReturnType<typeof solveCandidate> } | null => {
    const photo15 = { width: W, height: H, stars: allStars.slice(0, 15) };
    const cands = findCandidates(photo15, index);

    let best: ReturnType<typeof solveCandidate> = null;
    let bestSig = -Infinity;

    for (const cand of cands) {
      const photoQuad: Point2D[] = cand.input.map((i) => photo15.stars[i]);
      const dbQuad = cand.output.map((o) => byHrVec.get(o.hr));

      if (dbQuad.some((v) => !v)) {
        continue;
      }

      const res = solveCandidate(
        photoQuad,
        dbQuad as Point3D[],
        allStars,
        solveStars,
        { imageWidth: W, imageHeight: H },
      );

      // 정렬: inlier 절대수 1순위, 동률 시 유의도. (유의도만 쓰면 sparse 영역의
      // 거짓 quad가 expectedRandom 과소로 폭발하는 함정에 빠진다)
      const isBetter =
        res !== null &&
        (best === null ||
          res.inlierCount > best.inlierCount ||
          (res.inlierCount === best.inlierCount && res.significance > bestSig));

      if (res && isBetter) {
        bestSig = res.significance;
        best = res;
      }
    }

    return best ? { significance: bestSig, TP: best } : null;
  };

  it("노이즈 레벨별 정답률을 측정한다", () => {
    const report: string[] = [];

    for (const lvl of noiseLevels) {
      let total = 0;
      let solved = 0;
      const centerErrs: number[] = [];

      for (let d = 0; d < directions.length; d++) {
        const [ra, dec] = directions[d];
        const img = generateSyntheticImage(catalog, {
          center: skyVector(ra, dec),
          fovDeg: 20,
          rotationDeg: 25,
          width: W,
          height: H,
          magnitudeLimit: 5,
          seed: 1000 + d,
          noise: lvl.noise,
        });

        if (img.trueStars.length < 8) {
          continue;
        }

        total++;

        const allStars = toPhoto(img).stars;
        const best = solveImage(allStars);
        const pose =
          best && best.TP ? comparePose(best.TP.TP, img.groundTruth) : null;

        if (best && best.TP && best.significance > SIGNIFICANCE_ACCEPT) {
          if (pose && pose.centerErrorDeg < CENTER_TOLERANCE_DEG) {
            solved++;
            centerErrs.push(pose.centerErrorDeg);
          }
        }

        if (lvl.name === "L0 clean") {
          console.warn(
            `  방향[${ra},${dec}] 별${img.trueStars.length}개, ` +
              `sig=${best ? best.significance.toFixed(1) : "없음"}, ` +
              `center오차=${pose ? pose.centerErrorDeg.toFixed(2) : "-"}°`,
          );
        }
      }

      const meanErr =
        centerErrs.length > 0
          ? centerErrs.reduce((a, b) => a + b, 0) / centerErrs.length
          : NaN;

      report.push(
        `[${lvl.name}] 정답 ${solved}/${total}` +
          (centerErrs.length > 0
            ? ` (평균 중심오차 ${meanErr.toFixed(3)}°)`
            : ""),
      );
    }

    console.warn("\n=== e2e 파이프라인 정답률 ===\n" + report.join("\n"));

    // clean(L0)에서는 모든 방향을 풀어야 한다 (회귀 게이트)
    const l0 = report[0];

    expect(l0).toMatch(/정답 (\d+)\/\1/); // solved == total
  });
});
