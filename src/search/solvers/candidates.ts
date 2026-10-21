import type { SolveCandidateResult } from "./types";
import type { SolveResult } from "@/search/solveCore";

// 후보가 "그럴듯한 해"인지 판정하는 공통 게이트. solver의 best 선택·found 판정과
// 사람에게 보여줄 후보 목록이 모두 이 기준을 쓴다(단일 소스).
export const ACCEPT = {
  minInlier: 6, // 매칭된 별이 이보다 적으면 우연/빈약
  // 사람에게 후보로 보여 줄 최소 기준: 시드 밖 inlier가 우연히 맞을 확률이 1/10 이하.
  // 예전에는 배수(유의도 ≥ 5)를 썼지만, 기대치가 작은 가짜일수록 배수가 치솟아 같은 잣대(확률)로 바꿨다
  minCandidateLogOdds: 1,
  // 일반 사진의 대각 시야는 이 정도를 넘지 않는다. 더 넓게 나오는 해는
  // 변환이 느슨/붕괴해 넓은 하늘이 우연히 맞은 비현실적 결과다.
  maxFovDeg: 80,
  // "해를 찾았다"고 확신하려면 시드 밖 inlier가 우연히 맞을 확률이 10^-9 이하여야 한다.
  // 풀이는 후보를 많이 검사하고(쉬운 사진은 수십 개, 못 푸는 사진은 8초 동안 3만 개 안팎) 최댓값을 고르므로, 배수(유의도)만으로는 우연히
  // 높은 값이 쉽게 나온다. 실측(샘플 16장, 2026-10-21)에서 진짜 해는 17.7 이상, 가짜는 모두 4.3 이하였다.
  minLogOdds: 9,
};

type Judged = Pick<SolveResult, "inlierCount" | "fovDeg" | "logOdds">;

// 사람에게 후보로 보여줄 만한가. 거대 FOV(하늘 전체)·빈약 inlier·우연 수준인 해를 거른다.
export const isPlausible = (r: Judged, accept = ACCEPT): boolean =>
  r.inlierCount >= accept.minInlier &&
  r.logOdds >= accept.minCandidateLogOdds &&
  Number.isFinite(r.fovDeg) &&
  r.fovDeg > 0 &&
  r.fovDeg <= accept.maxFovDeg;

// 컴퓨터가 "해를 찾았다"고 확신해도 되는가. 아니면 후보만 제시하고 사람이 고른다.
export const isConfident = (r: Judged, accept = ACCEPT): boolean =>
  isPlausible(r, accept) && r.logOdds >= accept.minLogOdds;

// 더 믿을 만한 해가 앞에 오도록 정렬하는 비교 함수. 우연일 확률이 낮은 순, 같으면 inlier 많은 순.
export const byReliability = (
  a: Pick<SolveResult, "logOdds" | "inlierCount">,
  b: Pick<SolveResult, "logOdds" | "inlierCount">,
): number => b.logOdds - a.logOdds || b.inlierCount - a.inlierCount;

// 그럴듯한 결과 중 가장 믿을 만한 것 (없으면 null)
export const pickBest = (results: SolveResult[]): SolveResult | null =>
  results.filter((r) => isPlausible(r)).sort(byReliability)[0] ?? null;

// 검증 결과들을 믿을 만한 순으로 정렬하되, 같은 하늘 위치(서로 dedupeDeg 이내)는
// 하나로 묶어 "서로 다른 상위 후보 N개"를 만든다. 유일한 해를 못 찾아도 사람이
// 이 후보들 중 고를 수 있게 하기 위함이다.
// 그럴듯하지 않은 후보(거대 FOV·빈약 inlier·우연 수준)는 아예 제시하지 않는다.
export const topCandidates = (
  results: SolveResult[],
  maxN: number,
  dedupeDeg = 4,
): SolveCandidateResult[] =>
  dedupeBySky(
    results
      .filter((r) => isPlausible(r))
      .sort(byReliability)
      .map((r) => ({
        centerVector: r.centerVector,
        fovDeg: r.fovDeg,
        transform: r.TP,
        confidence: r.logOdds,
        inlierCount: r.inlierCount,
      })),
    maxN,
    dedupeDeg,
  );

// 이미 믿을 만한 순으로 정렬된 후보에서, 앞선 후보와 같은 하늘 위치(dedupeDeg 이내)는
// 버리고 서로 다른 위치 maxN개를 고른다.
export const dedupeBySky = <
  T extends { centerVector: SolveResult["centerVector"] },
>(
  sorted: T[],
  maxN: number,
  dedupeDeg = 4,
): T[] => {
  const cosThresh = Math.cos((dedupeDeg * Math.PI) / 180);
  const picked: T[] = [];

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

  return picked;
};
