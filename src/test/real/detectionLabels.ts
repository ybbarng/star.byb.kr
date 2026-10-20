import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 저장된 정답 포즈(solvedPoses.json)로 검출 하나하나에 라벨을 붙인다.
// "쓸모 있는 별" = 카탈로그(5등급 이하) 별의 투영 위치와 서로 가장 가까운 검출.
// 카탈로그에 없는 어두운 진짜 별도 풀이에는 쓸모가 없으므로 거짓 검출과 같이 취급한다.

export interface SolvedPose {
  width: number;
  height: number;
  TP: Mat3;
}

export const loadSolvedPoses = (): Record<string, SolvedPose> =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "src/test/real/solvedPoses.json"),
      "utf8",
    ),
  );

// 라벨 허용오차: 풀이 검증(solveCore)과 같은 화면 크기 비례 기준의 1.5배
export const labelTolerancePx = (width: number, height: number): number =>
  1.5 * Math.max(5, Math.hypot(width, height) * 0.006);

// 각 검출이 쓸모 있는 별이면 그 카탈로그 별 번호(HR), 아니면 null
export const labelDetections = (
  detections: Point2D[],
  pose: SolvedPose,
  catalog: { hr: string; vector: Point3D }[],
): (string | null)[] => {
  const tol = labelTolerancePx(pose.width, pose.height);
  const pred: { hr: string; xy: Point2D }[] = [];

  for (const s of catalog) {
    const xy = projectVecToPhoto(pose.TP, s.vector);

    if (
      xy &&
      xy[0] >= -tol &&
      xy[0] < pose.width + tol &&
      xy[1] >= -tol &&
      xy[1] < pose.height + tol
    ) {
      pred.push({ hr: s.hr, xy });
    }
  }

  const nearest = <T>(p: Point2D, list: T[], at: (t: T) => Point2D) => {
    let best = -1;
    let bestD = tol * tol;

    list.forEach((t, k) => {
      const q = at(t);
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;

      if (d <= bestD) {
        bestD = d;
        best = k;
      }
    });

    return best;
  };

  const predToDet = pred.map((p) => nearest(p.xy, detections, (d) => d));

  return detections.map((d, i) => {
    const k = nearest(d, pred, (p) => p.xy);

    return k >= 0 && predToDet[k] === i ? pred[k].hr : null;
  });
};
