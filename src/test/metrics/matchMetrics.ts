import type { Point2D } from "@/scripts/hash/types";

// 두 점 집합(검출 결과 vs 정답)을 tolerance 내에서 greedy 매칭한 정밀도/재현율/오차.

export interface MatchMetrics {
  matched: number;
  precision: number; // matched / detected
  recall: number; // matched / truth
  meanCentroidError: number; // 매칭된 쌍의 평균 거리(px)
}

export const matchPointSets = (
  detected: Point2D[],
  truth: Point2D[],
  tolerancePx: number,
): MatchMetrics => {
  const used = new Array<boolean>(detected.length).fill(false);
  const tol2 = tolerancePx * tolerancePx;
  let matched = 0;
  let errSum = 0;

  for (const t of truth) {
    let best = -1;
    let bestD = Infinity;

    for (let i = 0; i < detected.length; i++) {
      if (used[i]) {
        continue;
      }

      const dx = detected[i][0] - t[0];
      const dy = detected[i][1] - t[1];
      const d = dx * dx + dy * dy;

      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }

    if (best >= 0 && bestD <= tol2) {
      used[best] = true;
      matched++;
      errSum += Math.sqrt(bestD);
    }
  }

  return {
    matched,
    precision: detected.length ? matched / detected.length : 0,
    recall: truth.length ? matched / truth.length : 0,
    meanCentroidError: matched ? errSum / matched : 0,
  };
};
