import type { SolveCandidateResult } from "./types";
import type { SolveResult } from "@/search/solveCore";

// 검증 결과들을 유의도/inlier 순으로 정렬하되, 같은 하늘 위치(서로 dedupeDeg 이내)는
// 하나로 묶어 "서로 다른 상위 후보 N개"를 만든다. 유일한 해를 못 찾아도 사람이
// 이 후보들 중 고를 수 있게 하기 위함이다.
export const topCandidates = (
  results: SolveResult[],
  maxN: number,
  dedupeDeg = 4,
): SolveCandidateResult[] => {
  const sorted = [...results].sort(
    (a, b) => b.inlierCount - a.inlierCount || b.significance - a.significance,
  );
  const cosThresh = Math.cos((dedupeDeg * Math.PI) / 180);
  const picked: SolveResult[] = [];

  for (const r of sorted) {
    if (picked.length >= maxN) {
      break;
    }

    const dup = picked.some((p) => {
      const dot =
        p.centerVector[0] * r.centerVector[0] +
        p.centerVector[1] * r.centerVector[1] +
        p.centerVector[2] * r.centerVector[2];

      return dot >= cosThresh;
    });

    if (!dup) {
      picked.push(r);
    }
  }

  return picked.map((r) => ({
    centerVector: r.centerVector,
    fovDeg: r.fovDeg,
    transform: r.TP,
    confidence: r.significance,
    inlierCount: r.inlierCount,
  }));
};
