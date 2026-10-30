import type { Point3D } from "@/scripts/hash/types";
import type { SolveStar } from "@/search/solveCore";
import type { Mat3 } from "@/search/utils/similarity";
import { refineSolution } from "@/search/solveCore";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 이정표 실험 공용 (journey 57장): 하늘 위치를 아는 두 점이 사진 어디에 있는지로 카메라 배치를 세우고,
// 그 배치에서 출발해 검증 코어(refineSolution)로 다듬는다.
export type P = [number, number];

export const skyVec = (raDeg: number, decDeg: number): Point3D => {
  const a = (raDeg * Math.PI) / 180;
  const d = (decDeg * Math.PI) / 180;

  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};

export const LMC = skyVec(80.894, -69.756);
export const SMC = skyVec(13.187, -72.829);

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: Point3D): Point3D => {
  const n = Math.hypot(...a);

  return [a[0] / n, a[1] / n, a[2] / n];
};

const frame = (u: Point3D, v: Point3D) => {
  const t2 = norm(cross(u, v));

  return [u, t2, cross(u, t2)];
};

// 광축을 c에 두고(직선투영), 두 점 사이 각이 하늘의 각거리가 되는 초점 거리(픽셀).
// 각이 초점 거리에 따라 한 방향으로만 변하지 않으므로(두 점이 c에서 같은 쪽이면) 큰 쪽부터 내려오며 처음 넘는 곳을 찾는다
export const focalForPair = (
  pa: P,
  pb: P,
  a: Point3D,
  b: Point3D,
  c: P,
  maxF: number,
): number | null => {
  const theta = Math.acos(dot(a, b));
  const ray = (p: P, f: number) => norm([p[0] - c[0], p[1] - c[1], f]);
  const angleAt = (f: number) =>
    Math.acos(Math.min(1, dot(ray(pa, f), ray(pb, f))));

  for (let hi = maxF, fl = hi / 1.02; fl > 10; fl /= 1.02) {
    if (angleAt(fl) >= theta) {
      let lo = fl;

      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;

        if (angleAt(m) >= theta) {
          lo = m;
        } else {
          hi = m;
        }
      }

      return (lo + hi) / 2;
    }

    hi = fl;
  }

  return null;
};

// 하늘 → 사진 동차좌표 TP = K·M. M은 두 광선을 두 하늘 방향에 맞추는 회전(TRIAD)
export const poseFromPair = (
  pa: P,
  pb: P,
  a: Point3D,
  b: Point3D,
  c: P,
  f: number,
): Mat3 => {
  const ray = (p: P) => norm([p[0] - c[0], p[1] - c[1], f]);
  const T = frame(ray(pa), ray(pb));
  const S = frame(a, b);
  const M = [0, 1, 2].map((i) =>
    [0, 1, 2].map(
      (j) => T[0][i] * S[0][j] + T[1][i] * S[1][j] + T[2][i] * S[2][j],
    ),
  );

  return [
    M[0].map((v, j) => f * v + c[0] * M[2][j]),
    M[1].map((v, j) => f * v + c[1] * M[2][j]),
    M[2],
  ] as Mat3;
};

export interface LandmarkFit {
  logOdds: number;
  inliers: number;
  fovDeg: number;
  rms: number;
  focalScale: number;
  TP: Mat3;
  // 다듬은 답이 두 이정표를 사진 속 자리에서 얼마나 옮겼나(px). 많이 흘렀으면 다른 답으로 간 것
  drift: [number, number];
}

// 두 점으로 세운 배치에서 출발해 허용 오차를 3° → 1.5° → 0.75° → 기본으로 좁히며 다듬는다.
// 초점 거리 추정이 틀릴 수 있어 ±15%를 5%씩 훑고 log-odds가 가장 높은 것을 돌려준다
export const refineFromPair = (
  pa: P,
  pb: P,
  a: Point3D,
  b: Point3D,
  stars: P[],
  catalog: SolveStar[],
  W: number,
  H: number,
): LandmarkFit | null => {
  const c: P = [(W - 1) / 2, (H - 1) / 2];
  const f0 = focalForPair(pa, pb, a, b, c, 100 * Math.max(W, H));

  if (f0 === null) {
    return null;
  }

  let best: LandmarkFit | null = null;

  for (let m = 0.85; m <= 1.151; m += 0.05) {
    const f = f0 * m;
    let TP = poseFromPair(pa, pb, a, b, c, f);
    let fit: LandmarkFit | null = null;

    for (const tolDeg of [3, 1.5, 0.75, 0]) {
      const r = refineSolution(TP, stars, catalog, {
        imageWidth: W,
        imageHeight: H,
        ...(tolDeg
          ? { tolerancePx: f * Math.tan((tolDeg * Math.PI) / 180) }
          : {}),
      });

      if (!r) {
        fit = null;
        break;
      }

      TP = r.TP;

      const drift = [
        [a, pa],
        [b, pb],
      ].map(([v, p]) => {
        const q = projectVecToPhoto(r.TP, v as Point3D);

        return q
          ? Math.hypot(q[0] - (p as P)[0], q[1] - (p as P)[1])
          : Infinity;
      }) as [number, number];

      fit = {
        logOdds: r.logOdds,
        inliers: r.inlierCount,
        fovDeg: r.fovDeg,
        rms: r.rmsError,
        focalScale: m,
        TP: r.TP,
        drift,
      };
    }

    if (fit && (!best || fit.logOdds > best.logOdds)) {
      best = fit;
    }
  }

  return best;
};
