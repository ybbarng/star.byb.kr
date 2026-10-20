import type { Point2D, Point3D } from "@/scripts/hash/types";
import { detectVariant } from "@/scripts/search/robustnessBench";
import { findCandidates } from "@/search/findCandidatesCore";
import { solveCandidate } from "@/search/solveCore";
import { SEARCH_REGIONS, INPUT_SIZES } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { isConfident } from "@/search/solvers/candidates";
import { rankForSolving, selectByGrid } from "@/search/utils/selectStars";
import { labelDetections, loadSolvedPoses } from "@/test/real/detectionLabels";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 개선 quad 풀이 진단: 영역·입력 크기마다 진짜 별 넷의 quad가 몇 개 만들어지고,
// 정답 대응이 해시 거리 순 몇 위에 오며(검증은 상위 220개), 검증하면 확신하는가.
//   npx tsx src/scripts/search/diagnoseQuads.ts "20220607-berry-seoul.jpg" webp50

const [file, variant] = process.argv.slice(2);
const VERIFY_LIMIT = 220;

const run = async () => {
  const pose = loadSolvedPoses()[file];
  const cat = contextStars(loadCatalog());
  const ctx = buildSolverContext(cat, loadHashes());
  const { stars, width, height } = await detectVariant(file, variant);
  const sorted = rankForSolving(stars, width, height);
  const all: Point2D[] = stars.map((s) => [s.x, s.y]);

  for (const region of SEARCH_REGIONS.slice(0, 2)) {
    const inRegion = sorted.filter((s) => s.y <= height * region.keepTop);

    for (const n of INPUT_SIZES) {
      const input = inRegion.slice(0, n);
      const match = selectByGrid(input, { width, height }, 4, 3, 8, 40);
      const labels = labelDetections(match, pose, cat);
      const cands = findCandidates({ width, height, stars: match }, ctx.index, {
        localNeighbors: 10,
      });
      const correct = cands
        .map((c, rank) => ({ c, rank }))
        .filter(({ c }) => {
          const hrs = new Set(c.output.map((o) => o.hr));

          return c.input.every(
            (i) => labels[i] !== null && hrs.has(labels[i]!),
          );
        });
      const inLimit = correct.filter((x) => x.rank < VERIFY_LIMIT);
      let confident = 0;

      for (const { c } of inLimit) {
        const res = solveCandidate(
          c.input.map((i) => match[i]),
          c.output.map((o) => ctx.byHrVec.get(o.hr) as Point3D),
          all,
          ctx.catalog,
          { imageWidth: width, imageHeight: height },
        );

        if (res && isConfident(res)) {
          confident++;
        }
      }

      console.log(
        `${region.label.padEnd(6)} n=${String(n).padEnd(2)} 고른 별 ${match.length} (진짜 ${labels.filter(Boolean).length}) 후보 ${cands.length}, 정답 대응 ${correct.length}개 (순위 ${correct
          .slice(0, 5)
          .map((x) => x.rank + 1)
          .join(",")}) → 220 안 ${inLimit.length}, 검증 확신 ${confident}`,
      );
    }
  }
};

run();
