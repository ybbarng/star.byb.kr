import type { ImageSize, InputStar, Solver, SolverContext } from "./types";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import { topCandidates } from "./candidates";
import { searchTriangle, triangleShape } from "@/search/catalogGeometry";
import { solveCandidate, type SolveResult } from "@/search/solveCore";
import { selectTopByBrightness } from "@/search/utils/selectStars";

// 최선B — Triangle matching (star tracker의 고전 패러다임).
// quad(4별) 대신 3별 삼각형의 스케일·회전 불변 형태로 카탈로그를 검색한다.
// 더 적은 별로 동작하며, 찾은 3별 대응을 검증 코어(solveCandidate)로 정밀화한다.

const MATCH_STARS = 10;
// 형태(비율)는 크기를 구분 못 하므로 후보를 넓게 가져와 검증으로 거른다.
// KD_K를 키워도 사진/카탈로그 삼각형 형태가 어긋나면(큰 별자리) 정답을 못 찾는다.
const KD_K = 8;
const EARLY_ACCEPT_INLIER = 10; // 충분한 inlier를 찾으면 즉시 채택
const MIN_INLIER = 6;
const MIN_SIGNIFICANCE = 5;
const MAX_PRESENTED_CANDIDATES = 5;

const pixDist = (a: Point2D, b: Point2D): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

export const triangleSolver: Solver = {
  key: "triangle",
  name: "최선B (삼각형 매칭)",
  description:
    "3별 삼각형의 스케일 불변 형태로 카탈로그 검색 → 3별 대응을 RANSAC 검증",

  solve(stars: InputStar[], size: ImageSize, ctx: SolverContext) {
    const t0 = performance.now();
    const tri = ctx.triangleIndex;

    if (!tri) {
      throw new Error("triangleSolver: ctx.triangleIndex가 필요하다");
    }

    const photoTop = selectTopByBrightness(stars, MATCH_STARS);
    const allStars: Point2D[] = stars.map((s) => [s.x, s.y]);

    const results: SolveResult[] = [];
    let best: SolveResult | null = null;
    let bestInlier = -1;
    let bestSig = -Infinity;
    let evaluated = 0;

    outer: for (let i = 0; i < photoTop.length - 2; i++) {
      for (let j = i + 1; j < photoTop.length - 1; j++) {
        for (let k = j + 1; k < photoTop.length; k++) {
          const d01 = pixDist(photoTop[i], photoTop[j]);
          const d02 = pixDist(photoTop[i], photoTop[k]);
          const d12 = pixDist(photoTop[j], photoTop[k]);
          const { order, shape } = triangleShape(d01, d02, d12, [i, j, k]);
          const photo3: Point2D[] = order.map((o) => photoTop[o]);
          const cands = searchTriangle(tri, shape, KD_K);

          for (const ent of cands) {
            const db = ent.hrs.map((hr) => ctx.byHrVec.get(hr));

            if (db.some((v) => !v)) {
              continue;
            }

            const db3 = db as Point3D[];
            // 삼각형은 거울상이 모호하므로 정상/반사 두 정점 순서를 모두 시도
            const orders: Point3D[][] = [db3, [db3[0], db3[2], db3[1]]];

            for (const ord of orders) {
              evaluated++;

              const res = solveCandidate(photo3, ord, allStars, ctx.catalog, {
                imageWidth: size.width,
                imageHeight: size.height,
                ransacIterations: 60,
              });

              if (!res) {
                continue;
              }

              results.push(res);

              if (
                res.inlierCount > bestInlier ||
                (res.inlierCount === bestInlier && res.significance > bestSig)
              ) {
                best = res;
                bestInlier = res.inlierCount;
                bestSig = res.significance;
              }
            }

            if (bestInlier >= EARLY_ACCEPT_INLIER) {
              break outer;
            }
          }
        }
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
        candidatesEvaluated: evaluated,
        timeMs,
        transform: null,
        candidates,
      };
    }

    return {
      found:
        best.significance > MIN_SIGNIFICANCE && best.inlierCount >= MIN_INLIER,
      centerVector: best.centerVector,
      fovDeg: best.fovDeg,
      confidence: best.significance,
      inlierCount: best.inlierCount,
      candidatesEvaluated: evaluated,
      timeMs,
      transform: best.TP,
      candidates,
    };
  },
};
