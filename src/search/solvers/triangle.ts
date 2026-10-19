import type { ImageSize, InputStar, Solver, SolverContext } from "./types";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import {
  byReliability,
  isConfident,
  isPlausible,
  topCandidates,
} from "./candidates";
import {
  pixelToCamera3D,
  projectTriangle,
  searchTriangle,
  triangleShape,
} from "@/search/catalogGeometry";
import { solveCandidate, type SolveResult } from "@/search/solveCore";
import { selectTopByBrightness } from "@/search/utils/selectStars";

// 최선B — Triangle matching (star tracker의 고전 패러다임).
// quad(4별) 대신 3별 삼각형의 스케일·회전 불변 형태로 카탈로그를 검색한다.
// 더 적은 별로 동작하며, 찾은 3별 대응을 검증 코어(solveCandidate)로 정밀화한다.

const MATCH_STARS = 10;
// 형태(비율)는 크기를 구분 못 하므로 후보를 넓게 가져와 검증으로 거른다.
// KD_K를 키워도 사진/카탈로그 삼각형 형태가 어긋나면(큰 별자리) 정답을 못 찾는다.
const KD_K = 8;
const MAX_PRESENTED_CANDIDATES = 5;
// blind FOV 후보. 사진 삼각형을 카탈로그와 같은 "삼각형 중심" 기준으로
// 재투영하려면 픽셀→각 스케일(FOV)이 필요한데 모르므로 스캔한다.
const FOV_CANDIDATES = [10, 14, 18, 23, 29, 37, 47];

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
    let best = null as SolveResult | null;
    let evaluated = 0;

    const cx = size.width / 2;
    const cy = size.height / 2;
    const minDim = Math.min(size.width, size.height);

    outer: for (let i = 0; i < photoTop.length - 2; i++) {
      for (let j = i + 1; j < photoTop.length - 1; j++) {
        for (let k = j + 1; k < photoTop.length; k++) {
          // FOV를 모르므로 후보 FOV마다 사진 삼각형을 카탈로그와 같은 기준
          // (삼각형 중심 접선평면)으로 재투영해 형태를 맞춘다.
          for (const fov of FOV_CANDIDATES) {
            const focalPx = minDim / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
            const dirs = [photoTop[i], photoTop[j], photoTop[k]].map((p) =>
              pixelToCamera3D(p[0], p[1], focalPx, cx, cy),
            );
            const pp = projectTriangle(dirs);
            const d01 = Math.hypot(pp[0][0] - pp[1][0], pp[0][1] - pp[1][1]);
            const d02 = Math.hypot(pp[0][0] - pp[2][0], pp[0][1] - pp[2][1]);
            const d12 = Math.hypot(pp[1][0] - pp[2][0], pp[1][1] - pp[2][1]);
            const { order, shape } = triangleShape(d01, d02, d12, [i, j, k]);
            const photo3: Point2D[] = order.map((o) => photoTop[o]);
            const cands = searchTriangle(tri, shape, KD_K);

            for (const ent of cands) {
              const db = ent.hrs.map((hr) => ctx.byHrVec.get(hr));

              if (db.some((v) => !v)) {
                continue;
              }

              const db3 = db as Point3D[];
              // 거울상이 모호하므로 정상/반사 두 정점 순서를 모두 시도
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

                // 그럴듯한 해(거대 FOV·빈약 inlier 제외)만 best 후보로
                if (
                  isPlausible(res) &&
                  (best === null || byReliability(res, best) < 0)
                ) {
                  best = res;
                }
              }
            }
          }

          // 확신할 해를 찾으면 나머지 삼각형은 볼 필요가 없다
          if (best && isConfident(best)) {
            break outer;
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
      found: isConfident(best),
      centerVector: best.centerVector,
      fovDeg: best.fovDeg,
      confidence: best.logOdds,
      inlierCount: best.inlierCount,
      candidatesEvaluated: evaluated,
      timeMs,
      transform: best.TP,
      candidates,
    };
  },
};
