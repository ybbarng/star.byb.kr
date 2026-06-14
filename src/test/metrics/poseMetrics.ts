import type { Mat3 } from "@/test/synthetic/projection";
import type { SyntheticGroundTruth } from "@/test/synthetic/types";
import { recoverCenter, recoverFov } from "@/test/synthetic/projection";

// 추정 변환행렬(TP)을 정답 pose와 비교한다.

export interface PoseMetrics {
  centerErrorDeg: number; // 광축 방향 각오차(도)
  fovErrorPct: number; // 시야각 오차(%)
}

const normalize = (v: [number, number, number]): [number, number, number] => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

export const comparePose = (
  estTP: Mat3,
  gt: SyntheticGroundTruth,
): PoseMetrics => {
  const c = recoverCenter(estTP, gt.width, gt.height);
  const gtc = normalize(gt.centerVector);
  const dot = Math.max(
    -1,
    Math.min(1, c[0] * gtc[0] + c[1] * gtc[1] + c[2] * gtc[2]),
  );
  const centerErrorDeg = (Math.acos(dot) * 180) / Math.PI;

  const estFovDeg = (recoverFov(estTP, gt.width, gt.height) * 180) / Math.PI;
  const fovErrorPct = (Math.abs(estFovDeg - gt.fovDeg) / gt.fovDeg) * 100;

  return { centerErrorDeg, fovErrorPct };
};
