import type { ImageSize, InputStar, Solver, SolverContext } from "./types";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import { isPlausible, topCandidates } from "./candidates";
import { findCandidates } from "@/search/findCandidatesCore";
import { solveCandidate } from "@/search/solveCore";
import { selectByGrid } from "@/search/utils/selectStars";

// 개선 알고리즘 (내 quad geometric hashing 유지 + robustness 보강).
// 1) 격자 균등 선택으로 가짜 별이 진짜 별을 밀어내는 것을 완화
// 2) 각 후보를 RANSAC·유의도로 검증해 inlier 최다 후보 채택 (검증 단계 신설)

const MATCH_STARS = 40;
const LOCAL_NEIGHBORS = 10; // 각 별의 가까운 이웃으로 compact quad (큰 FOV 대응)
const MAX_PRESENTED_CANDIDATES = 5; // 사람에게 제시할 상위 후보 수
// 후보는 hash 거리 오름차순. 정답 quad는 보통 거리가 작아 상위에 온다.
// 전부 검증하면 느리므로(30초 목표) 상위 일부만 검증한다.
const MAX_CANDIDATES_TO_VERIFY = 220;

export const improvedSolver: Solver = {
  key: "improved",
  name: "개선 (quad + RANSAC 검증)",
  description:
    "격자 균등 선택 20개 quad → 각 후보를 RANSAC·유의도로 검증, inlier 최다 채택",

  solve(stars: InputStar[], size: ImageSize, ctx: SolverContext) {
    const t0 = performance.now();
    const matchStars = selectByGrid(stars, size, 4, 3, 8, MATCH_STARS);
    const photo = { width: size.width, height: size.height, stars: matchStars };
    const cands = findCandidates(photo, ctx.index, {
      localNeighbors: LOCAL_NEIGHBORS,
    });
    const allStars: Point2D[] = stars.map((s) => [s.x, s.y]);

    const results: NonNullable<ReturnType<typeof solveCandidate>>[] = [];
    let best: ReturnType<typeof solveCandidate> = null;
    let bestInlier = -1;
    let bestSig = -Infinity;

    for (const cand of cands.slice(0, MAX_CANDIDATES_TO_VERIFY)) {
      const photoQuad: Point2D[] = cand.input.map((i) => matchStars[i]);
      const dbQuad = cand.output.map((o) => ctx.byHrVec.get(o.hr));

      if (dbQuad.some((v) => !v)) {
        continue;
      }

      const res = solveCandidate(
        photoQuad,
        dbQuad as Point3D[],
        allStars,
        ctx.catalog,
        { imageWidth: size.width, imageHeight: size.height },
      );

      if (!res) {
        continue;
      }

      results.push(res);

      // 그럴듯한 해(거대 FOV·빈약 inlier 제외)만 best 후보로. inlier 1순위, 동률 시 유의도
      if (
        isPlausible(res) &&
        (res.inlierCount > bestInlier ||
          (res.inlierCount === bestInlier && res.significance > bestSig))
      ) {
        best = res;
        bestInlier = res.inlierCount;
        bestSig = res.significance;
      }
    }

    const timeMs = performance.now() - t0;
    const candidates = topCandidates(results, MAX_PRESENTED_CANDIDATES);

    if (!best) {
      return {
        found: false,
        centerVector: null,
        fovDeg: null,
        confidence: 0,
        inlierCount: 0,
        candidatesEvaluated: cands.length,
        timeMs,
        transform: null,
        candidates,
      };
    }

    return {
      // best는 이미 그럴듯한 해(isPlausible)만 통과시켜 선택했다
      found: isPlausible(best),
      centerVector: best.centerVector,
      fovDeg: best.fovDeg,
      confidence: best.significance,
      inlierCount: best.inlierCount,
      candidatesEvaluated: cands.length,
      timeMs,
      transform: best.TP,
      candidates,
    };
  },
};
