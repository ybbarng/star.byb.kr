import type { ImageSize, InputStar, Solver, SolverContext } from "./types";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { findCandidates } from "@/search/findCandidatesCore";
import { selectTopByBrightness } from "@/search/utils/selectStars";
import { computeTransformMatrix } from "@/search/utils/transform";
import { recoverCenter, recoverFov } from "@/search/utils/wcs";

// 원본 알고리즘 (v2.0.0 발표 버전 재현).
// 밝기 상위 15개로 quad를 만들어 hash 거리 최소 후보의 변환을 그대로 쓴다.
// 검증 단계가 없어 거리 최소가 오답이면 그대로 오답을 낸다.

const TOP_N = 15;

export const baselineSolver: Solver = {
  key: "baseline",
  name: "원본 (v2.0.0 발표)",
  description:
    "밝기 상위 15개 quad → hash 거리 최소 후보의 변환을 그대로 사용 (검증 없음)",

  solve(stars: InputStar[], size: ImageSize, ctx: SolverContext) {
    const t0 = performance.now();
    const empty = (candidates: number) => ({
      found: false,
      centerVector: null,
      fovDeg: null,
      confidence: 0,
      inlierCount: 0,
      candidatesEvaluated: candidates,
      timeMs: performance.now() - t0,
      transform: null,
    });

    const photoTop = selectTopByBrightness(stars, TOP_N);
    const photo = { width: size.width, height: size.height, stars: photoTop };
    const cands = findCandidates(photo, ctx.index);

    if (cands.length === 0) {
      return empty(0);
    }

    // 검증 없이 hash 거리 최소 후보를 그대로 채택
    const top = cands[0];
    const photoQuad: Point2D[] = top.input.map((i) => photoTop[i]);
    const dbQuad = top.output.map((o) => ctx.byHrVec.get(o.hr));

    if (dbQuad.some((v) => !v)) {
      return empty(cands.length);
    }

    const TPm = computeTransformMatrix(photoQuad, dbQuad as Point3D[]);
    const TP = (TPm as unknown as { toArray(): number[][] }).toArray() as Mat3;

    const centerVector = recoverCenter(TP, size.width, size.height);
    const fovDeg = (recoverFov(TP, size.width, size.height) * 180) / Math.PI;

    return {
      found: true, // 원본은 항상 "찾았다"고 본다 (검증이 없으므로)
      centerVector,
      fovDeg,
      confidence: 1 / (1 + top.distance),
      inlierCount: 0,
      candidatesEvaluated: cands.length,
      timeMs: performance.now() - t0,
      transform: TP,
    };
  },
};
