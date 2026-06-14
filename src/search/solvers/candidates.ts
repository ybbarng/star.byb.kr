import type { SolveCandidateResult } from "./types";
import type { SolveResult } from "@/search/solveCore";

// 후보가 "그럴듯한 해"인지 판정하는 공통 게이트. solver의 best 선택·found 판정과
// 사람에게 보여줄 후보 목록이 모두 이 기준을 쓴다(단일 소스).
export const ACCEPT = {
  minInlier: 6, // 매칭된 별이 이보다 적으면 우연/빈약
  minSignificance: 5, // 우연매칭 기대 대비 배수. 1이면 우연 수준
  maxFovDeg: 120, // 이보다 크면 "하늘 전체"가 잡힌 퇴화 해(변환 붕괴)
};

// 거대 FOV(하늘 전체)·빈약 inlier·우연 수준 유의도를 모두 거른다.
export const isPlausible = (
  r: { inlierCount: number; significance: number; fovDeg: number },
  accept = ACCEPT,
): boolean =>
  r.inlierCount >= accept.minInlier &&
  r.significance >= accept.minSignificance &&
  Number.isFinite(r.fovDeg) &&
  r.fovDeg > 0 &&
  r.fovDeg <= accept.maxFovDeg;

// 검증 결과들을 유의도/inlier 순으로 정렬하되, 같은 하늘 위치(서로 dedupeDeg 이내)는
// 하나로 묶어 "서로 다른 상위 후보 N개"를 만든다. 유일한 해를 못 찾아도 사람이
// 이 후보들 중 고를 수 있게 하기 위함이다.
// 그럴듯하지 않은 후보(거대 FOV·빈약 inlier·우연 수준)는 아예 제시하지 않는다.
export const topCandidates = (
  results: SolveResult[],
  maxN: number,
  dedupeDeg = 4,
): SolveCandidateResult[] => {
  const plausible = results.filter((r) => isPlausible(r));
  const sorted = plausible.sort(
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
